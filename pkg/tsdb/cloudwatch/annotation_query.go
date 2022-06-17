package cloudwatch

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/cloudwatch"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type annotationEvent struct {
	Title string
	Time  time.Time
	Tags  string
	Text  string
}

func (e *cloudWatchExecutor) executeAnnotationQuery(pluginCtx backend.PluginContext, model QueryBody, query backend.DataQuery) (*backend.QueryDataResponse, error) {
	result := backend.NewQueryDataResponse()

	usePrefixMatch := model.PrefixMatching
	region := model.Region
	namespace := model.Namespace
	metricName := model.MetricName
	dimensions := model.Dimensions
	statistic := ""

	if model.Statistic != nil {
		statistic = *model.Statistic
	}

	var period int64
	if model.Period != "" {
		p, err := strconv.Atoi(model.Period)
		if err != nil {
			return nil, err
		}
		period = int64(p)
	}

	if period == 0 && !usePrefixMatch {
		period = 300
	}

	actionPrefix := model.ActionPrefix
	alarmNamePrefix := model.AlarmNamePrefix

	cli, err := e.getCWClient(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	var alarmNames []*string
	if usePrefixMatch {
		params := &cloudwatch.DescribeAlarmsInput{
			MaxRecords:      aws.Int64(100),
			ActionPrefix:    aws.String(actionPrefix),
			AlarmNamePrefix: aws.String(alarmNamePrefix),
		}
		resp, err := cli.DescribeAlarms(params)
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarms", err)
		}
		alarmNames = filterAlarms(resp, namespace, metricName, dimensions, statistic, period)
	} else {
		if region == "" || namespace == "" || metricName == "" || statistic == "" {
			return result, errors.New("invalid annotations query")
		}

		var qd []*cloudwatch.Dimension
		for k, v := range dimensions {
			if vv, ok := v.([]interface{}); ok {
				for _, vvv := range vv {
					if vvvv, ok := vvv.(string); ok {
						qd = append(qd, &cloudwatch.Dimension{
							Name:  aws.String(k),
							Value: aws.String(vvvv),
						})
					}
				}
			}
		}
		params := &cloudwatch.DescribeAlarmsForMetricInput{
			Namespace:  aws.String(namespace),
			MetricName: aws.String(metricName),
			Dimensions: qd,
			Statistic:  aws.String(statistic),
			Period:     aws.Int64(period),
		}
		resp, err := cli.DescribeAlarmsForMetric(params)
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmsForMetric", err)
		}
		for _, alarm := range resp.MetricAlarms {
			alarmNames = append(alarmNames, alarm.AlarmName)
		}
	}

	annotations := make([]*annotationEvent, 0)
	for _, alarmName := range alarmNames {
		params := &cloudwatch.DescribeAlarmHistoryInput{
			AlarmName:  alarmName,
			StartDate:  aws.Time(query.TimeRange.From),
			EndDate:    aws.Time(query.TimeRange.To),
			MaxRecords: aws.Int64(100),
		}
		resp, err := cli.DescribeAlarmHistory(params)
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "failed to call cloudwatch:DescribeAlarmHistory", err)
		}
		for _, history := range resp.AlarmHistoryItems {
			annotations = append(annotations, &annotationEvent{
				Time:  *history.Timestamp,
				Title: *history.AlarmName,
				Tags:  *history.HistoryItemType,
				Text:  *history.HistorySummary,
			})
		}
	}

	respD := result.Responses[query.RefID]
	respD.Frames = append(respD.Frames, transformAnnotationToTable(annotations, query))
	result.Responses[query.RefID] = respD

	return result, err
}

func transformAnnotationToTable(annotations []*annotationEvent, query backend.DataQuery) *data.Frame {
	frame := data.NewFrame(query.RefID,
		data.NewField("time", nil, []time.Time{}),
		data.NewField("title", nil, []string{}),
		data.NewField("tags", nil, []string{}),
		data.NewField("text", nil, []string{}),
	)

	for _, a := range annotations {
		frame.AppendRow(a.Time, a.Title, a.Tags, a.Text)
	}

	frame.Meta = &data.FrameMeta{
		Custom: map[string]interface{}{
			"rowCount": len(annotations),
		},
	}

	return frame
}

func filterAlarms(alarms *cloudwatch.DescribeAlarmsOutput, namespace string, metricName string,
	dimensions map[string]interface{}, statistic string, period int64) []*string {
	alarmNames := make([]*string, 0)

	for _, alarm := range alarms.MetricAlarms {
		if namespace != "" && *alarm.Namespace != namespace {
			continue
		}
		if metricName != "" && *alarm.MetricName != metricName {
			continue
		}

		matchDimension := true
		if len(dimensions) != 0 {
			if len(alarm.Dimensions) != len(dimensions) {
				matchDimension = false
			} else {
				for _, d := range alarm.Dimensions {
					if _, ok := dimensions[*d.Name]; !ok {
						matchDimension = false
					}
				}
			}
		}
		if !matchDimension {
			continue
		}

		if *alarm.Statistic != statistic {
			continue
		}

		if period != 0 && *alarm.Period != period {
			continue
		}

		alarmNames = append(alarmNames, alarm.AlarmName)
	}

	return alarmNames
}
