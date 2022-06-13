import { css } from '@emotion/css';
import { unionBy } from 'lodash';
import React, { ReactNode, useState } from 'react';

import { AbsoluteTimeRange, QueryEditorProps, SelectableValue } from '@grafana/data';
import { LegacyForms, MultiSelect } from '@grafana/ui';
import { ExploreId } from 'app/types';

// Utils & Services
// dom also includes Element polyfills
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { appendTemplateVariables } from '../utils/utils';

import QueryHeader from './QueryHeader';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  exploreId: ExploreId;
  allowCustomValue?: boolean;
}
//
// const containerClass = css`
//   flex-grow: 1;
//   min-height: 35px;
// `;

const rowGap = css`
  gap: 3px;
`;

export const CloudWatchLogsQueryField = (props: CloudWatchLogsQueryFieldProps) => {
  const { query, onRunQuery, datasource, allowCustomValue } = props;
  const [availableLogGroups, setAvailableLogGroups] = useState([]);
  const [selectedLogGroups, setSelectedLogGroups] = useState(
    (props.query as CloudWatchLogsQuery).logGroupNames?.map((logGroup) => ({
      value: logGroup,
      label: logGroup,
    })) ?? []
  );

  const onChange = (query: CloudWatchQuery) => {
    const { onChange, onRunQuery } = props;
    onChange(query);
    onRunQuery();
  };

  return (
    <>
      <QueryHeader
        query={query}
        onRunQuery={onRunQuery}
        datasource={datasource}
        onChange={onChange}
        sqlCodeEditorIsDirty={false}
      />
      <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
        <LegacyForms.FormField
          label="Log Groups"
          labelWidth={6}
          className="flex-grow-1"
          inputEl={
            <MultiSelect
              aria-label="Log Groups"
              allowCustomValue={allowCustomValue}
              options={appendTemplateVariables(datasource, unionBy(availableLogGroups, selectedLogGroups, 'value'))}
              value={selectedLogGroups}
              onChange={(v) => {
                setSelectedLogGroups(v);
              }}
              onCreateOption={(v) => {
                const customLogGroup: SelectableValue<string> = { value: v, label: v };
                const selectedLogGroups = [...this.state.selectedLogGroups, customLogGroup];
                setSelectedLogGroups(selectedLogGroups);
              }}
              onBlur={this.props.onRunQuery}
              className={containerClass}
              closeMenuOnSelect={false}
              isClearable={true}
              invalid={invalidLogGroups}
              isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
              placeholder="Choose Log Groups"
              maxVisibleValues={4}
              noOptionsMessage="No log groups available"
              isLoading={loadingLogGroups}
              onOpenMenu={this.onOpenLogGroupMenu}
              onInputChange={(value, actionMeta) => {
                this.onLogGroupSearchDebounced(value, query.region, actionMeta);
              }}
            />
          }
        />
      </div>
      {/*<div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">*/}
      {/*  <div className="gf-form gf-form--grow flex-shrink-1">*/}
      {/*    <QueryField*/}
      {/*      additionalPlugins={this.plugins}*/}
      {/*      query={(query as CloudWatchLogsQuery).expression ?? ''}*/}
      {/*      onChange={this.onChangeQuery}*/}
      {/*      onClick={this.onQueryFieldClick}*/}
      {/*      onRunQuery={this.props.onRunQuery}*/}
      {/*      onTypeahead={this.onTypeahead}*/}
      {/*      cleanText={cleanText}*/}
      {/*      placeholder="Enter a CloudWatch Logs Insights query (run with Shift+Enter)"*/}
      {/*      portalOrigin="cloudwatch"*/}
      {/*      disabled={loadingLogGroups || selectedLogGroups.length === 0}*/}
      {/*    />*/}
      {/*  </div>*/}
      {/*  {ExtraFieldElement}*/}
      {/*</div>*/}
      {/*{hint && (*/}
      {/*  <div className="query-row-break">*/}
      {/*    <div className="text-warning">*/}
      {/*      {hint.message}*/}
      {/*      <a className="text-link muted" onClick={hint.fix.action}>*/}
      {/*        {hint.fix.label}*/}
      {/*      </a>*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}
      {/*{showError ? (*/}
      {/*  <div className="query-row-break">*/}
      {/*    <div className="prom-query-field-info text-error">{data?.error?.message}</div>*/}
      {/*  </div>*/}
      {/*) : null}*/}
    </>
  );
  // }
};
