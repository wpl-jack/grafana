package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/loganalytics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/metrics"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/resourcegraph"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func ProvideService(cfg *setting.Cfg, httpClientProvider *httpclient.Provider, tracer tracing.Tracer) *Service {
	proxy := &httpServiceProxy{}
	executors := map[string]azDatasourceExecutor{
		azureMonitor:       &metrics.AzureMonitorDatasource{Proxy: proxy},
		azureLogAnalytics:  &loganalytics.AzureLogAnalyticsDatasource{Proxy: proxy},
		azureResourceGraph: &resourcegraph.AzureResourceGraphDatasource{Proxy: proxy},
	}

	im := datasource.NewInstanceManager(NewInstanceSettings(cfg, httpClientProvider, executors))

	s := &Service{
		im:        im,
		executors: executors,
		tracer:    tracer,
	}

	s.queryMux = s.newQueryMux()
	s.resourceHandler = httpadapter.New(s.newResourceMux())

	return s
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return s.queryMux.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}

type Service struct {
	im        instancemgmt.InstanceManager
	executors map[string]azDatasourceExecutor

	queryMux        *datasource.QueryTypeMux
	resourceHandler backend.CallResourceHandler
	tracer          tracing.Tracer
}

func getDatasourceService(cfg *setting.Cfg, clientProvider *httpclient.Provider, dsInfo types.DatasourceInfo, routeName string) (types.DatasourceService, error) {
	route := dsInfo.Routes[routeName]
	client, err := newHTTPClient(route, dsInfo, cfg, clientProvider)
	if err != nil {
		return types.DatasourceService{}, err
	}
	return types.DatasourceService{
		URL:        dsInfo.Routes[routeName].URL,
		HTTPClient: client,
	}, nil
}

func NewInstanceSettings(cfg *setting.Cfg, clientProvider *httpclient.Provider, executors map[string]azDatasourceExecutor) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData, err := simplejson.NewJson(settings.JSONData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		jsonDataObj := map[string]interface{}{}
		err = json.Unmarshal(settings.JSONData, &jsonDataObj)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		azMonitorSettings := types.AzureMonitorSettings{}
		err = json.Unmarshal(settings.JSONData, &azMonitorSettings)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		cloud, err := getAzureCloud(cfg, jsonData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		credentials, err := getAzureCredentials(cfg, jsonData, settings.DecryptedSecureJSONData)
		if err != nil {
			return nil, fmt.Errorf("error getting credentials: %w", err)
		}

		model := types.DatasourceInfo{
			Cloud:                   cloud,
			Credentials:             credentials,
			Settings:                azMonitorSettings,
			JSONData:                jsonDataObj,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			DatasourceID:            settings.ID,
			Routes:                  routes[cloud],
			Services:                map[string]types.DatasourceService{},
		}

		for routeName := range executors {
			service, err := getDatasourceService(cfg, clientProvider, model, routeName)
			if err != nil {
				return nil, err
			}
			model.Services[routeName] = service
		}

		return model, nil
	}
}

type azDatasourceExecutor interface {
	ExecuteTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo types.DatasourceInfo, client *http.Client, url string, tracer tracing.Tracer) (*backend.QueryDataResponse, error)
	ResourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client)
}

func (s *Service) getDataSourceFromPluginReq(req *backend.QueryDataRequest) (types.DatasourceInfo, error) {
	i, err := s.im.Get(req.PluginContext)
	if err != nil {
		return types.DatasourceInfo{}, err
	}
	dsInfo, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("unable to convert datasource from service instance")
	}
	dsInfo.OrgID = req.PluginContext.OrgID
	return dsInfo, nil
}

func (s *Service) newQueryMux() *datasource.QueryTypeMux {
	mux := datasource.NewQueryTypeMux()
	for dsType := range s.executors {
		// Make a copy of the string to keep the reference after the iterator
		dst := dsType
		mux.HandleFunc(dsType, func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			executor := s.executors[dst]
			dsInfo, err := s.getDataSourceFromPluginReq(req)
			if err != nil {
				return nil, err
			}
			service, ok := dsInfo.Services[dst]
			if !ok {
				return nil, fmt.Errorf("missing service for %s", dst)
			}
			return executor.ExecuteTimeSeriesQuery(ctx, req.Queries, dsInfo, service.HTTPClient, service.URL, s.tracer)
		})
	}
	return mux
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (types.DatasourceInfo, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return types.DatasourceInfo{}, err
	}

	instance, ok := i.(types.DatasourceInfo)
	if !ok {
		return types.DatasourceInfo{}, fmt.Errorf("failed to cast datsource info")
	}

	return instance, nil
}

func checkAzureMonitorMetricsHealth(dsInfo types.DatasourceInfo) (*http.Response, error) {
	url := fmt.Sprintf("%v/subscriptions?api-version=2019-03-01", dsInfo.Routes["Azure Monitor"].URL)
	request, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(request)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func checkAzureLogAnalyticsHealth(dsInfo types.DatasourceInfo) (*http.Response, error) {
	defaultWorkspaceId := dsInfo.Settings.LogAnalyticsDefaultWorkspace

	if defaultWorkspaceId == "" {
		workspacesUrl := fmt.Sprintf("%v/subscriptions/%v/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview", dsInfo.Routes["Azure Monitor"].URL, dsInfo.Settings.SubscriptionId)
		workspacesReq, err := http.NewRequest(http.MethodGet, workspacesUrl, nil)
		if err != nil {
			return nil, err
		}
		res, err := dsInfo.Services["Azure Monitor"].HTTPClient.Do(workspacesReq)
		if err != nil {
			return nil, err
		}
		var target struct {
			Value []types.LogAnalyticsWorkspaceResponse
		}
		err = json.NewDecoder(res.Body).Decode(&target)
		if err != nil {
			return nil, err
		}

		if len(target.Value) == 0 {
			return nil, errors.New("no default workspace found")
		}
		defaultWorkspaceId = target.Value[0].Properties.CustomerId
	}

	workspaceUrl := fmt.Sprintf("%v/v1/workspaces/%v/metadata", dsInfo.Routes["Azure Log Analytics"].URL, defaultWorkspaceId)
	workspaceReq, err := http.NewRequest(http.MethodGet, workspaceUrl, nil)
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Log Analytics"].HTTPClient.Do(workspaceReq)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func checkAzureMonitorGraphHealth(dsInfo types.DatasourceInfo) (*http.Response, error) {
	body, err := json.Marshal(map[string]interface{}{
		"query":         "Resources | project id | limit 1",
		"subscriptions": []string{dsInfo.Settings.SubscriptionId},
	})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%v/providers/Microsoft.ResourceGraph/resources?api-version=2021-06-01-preview", dsInfo.Routes["Azure Resource Graph"].URL)
	request, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	request.Header.Set("Content-Type", "application/json")
	if err != nil {
		return nil, err
	}

	res, err := dsInfo.Services["Azure Resource Graph"].HTTPClient.Do(request)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	status := backend.HealthStatusOk
	message := ""

	metricsRes, err := checkAzureMonitorMetricsHealth(dsInfo)
	if err != nil || metricsRes.StatusCode != 200 {
		if err != nil {
			return nil, err
		} else {
			body, err := io.ReadAll(metricsRes.Body)
			if err != nil {
				return nil, err
			}
			backend.Logger.Error(string(body))
		}
		status = backend.HealthStatusError
		message = "1. Error connecting to Azure Monitor endpoint."
	} else {
		message = "1. Successfully connected to Azure Monitor endpoint."
	}

	logsRes, err := checkAzureLogAnalyticsHealth(dsInfo)
	if err != nil || logsRes.StatusCode != 200 {
		if err != nil {
			return nil, err
		} else {
			body, err := io.ReadAll(logsRes.Body)
			if err != nil {
				return nil, err
			}
			backend.Logger.Error(string(body))
		}
		status = backend.HealthStatusError
		message = fmt.Sprintf("%v\n 2. Error connecting to Azure Log Analytics endpoint.", message)
	} else {
		message = fmt.Sprintf("%v\n 2. Successfully connected to Azure Log Analytics endpoint.", message)
	}

	resourceGraphRes, err := checkAzureMonitorGraphHealth(dsInfo)
	if err != nil || resourceGraphRes.StatusCode != 200 {
		if err != nil {
			return nil, err
		} else {
			body, err := io.ReadAll(resourceGraphRes.Body)
			if err != nil {
				return nil, err
			}
			backend.Logger.Error(string(body))
		}
		status = backend.HealthStatusError
		message = fmt.Sprintf("%v\n 3. Error connecting to Azure Resource Graph endpoint.", message)
	} else {
		message = fmt.Sprintf("%v\n 3. Successfully connected to Azure Resource Graph endpoint.", message)
	}

	defer func() {
		if err := metricsRes.Body.Close(); err != nil {
			backend.Logger.Error("Failed to close response body", "err", err)
		}
		if err := logsRes.Body.Close(); err != nil {
			backend.Logger.Error("Failed to close response body", "err", err)
		}
		if err := resourceGraphRes.Body.Close(); err != nil {
			backend.Logger.Error("Failed to close response body", "err", err)
		}
	}()

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}
