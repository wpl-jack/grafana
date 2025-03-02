import React from 'react';

import { SIGV4ConnectionConfig } from '@grafana/aws-sdk';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import { DataSourceHttpSettings, InlineFormLabel, Select } from '@grafana/ui';
import { config } from 'app/core/config';

import { AlertManagerDataSourceJsonData, AlertManagerImplementation } from './types';

export type Props = DataSourcePluginOptionsEditorProps<AlertManagerDataSourceJsonData>;

const IMPL_OPTIONS: SelectableValue[] = [
  {
    value: AlertManagerImplementation.cortex,
    label: 'Cortex',
    description: `https://cortexmetrics.io/`,
  },
  {
    value: AlertManagerImplementation.prometheus,
    label: 'Prometheus',
    description:
      'https://prometheus.io/. Does not support editing configuration via API, so contact points and notification policies are read-only.',
  },
];

export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  return (
    <>
      <h3 className="page-heading">Alertmanager</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineFormLabel width={13}>Implementation</InlineFormLabel>
            <Select
              width={40}
              options={IMPL_OPTIONS}
              value={options.jsonData.implementation || AlertManagerImplementation.cortex}
              onChange={(value) =>
                onOptionsChange({
                  ...options,
                  jsonData: {
                    ...options.jsonData,
                    implementation: value.value as AlertManagerImplementation,
                  },
                })
              }
            />
          </div>
        </div>
      </div>
      <DataSourceHttpSettings
        defaultUrl={''}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
        sigV4AuthToggleEnabled={config.sigV4AuthEnabled}
        renderSigV4Editor={<SIGV4ConnectionConfig {...props}></SIGV4ConnectionConfig>}
      />
    </>
  );
};
