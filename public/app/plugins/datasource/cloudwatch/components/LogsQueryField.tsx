import {css} from '@emotion/css';
import {unionBy, debounce} from 'lodash';
import React, {ReactNode, useState} from 'react';

import {AbsoluteTimeRange, QueryEditorProps, SelectableValue} from '@grafana/data';
import {LegacyForms, MultiSelect} from '@grafana/ui';
import {InputActionMeta} from '@grafana/ui/src/components/Select/types';
import {notifyApp} from 'app/core/actions';
import {createErrorNotification} from 'app/core/copy/appNotification';
import {dispatch} from 'app/store/store';
import {ExploreId} from 'app/types';

// Utils & Services
// dom also includes Element polyfills
import {CloudWatchDatasource} from '../datasource';
import {CloudWatchJsonData, CloudWatchLogsQuery, CloudWatchQuery} from '../types';
import {appendTemplateVariables} from '../utils/utils';

import QueryHeader from './QueryHeader';

export interface CloudWatchLogsQueryFieldProps
  extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  absoluteRange: AbsoluteTimeRange;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
  exploreId: ExploreId;
  allowCustomValue?: boolean;
}

const containerClass = css`
  flex-grow: 1;
  min-height: 35px;
`;

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
  const [invalidLogGroups, setInvalidLogGroups] = useState(false);
  const [loadingLogGroups, setLoadingLogGroups] = useState(false);

  const onChange = (query: CloudWatchQuery) => {
    const { onChange, onRunQuery } = props;
    onChange(query);
    onRunQuery();
  };

  const onLogGroupSearchDebounced = (searchTerm: string, region: string, actionMeta: InputActionMeta) => {
    debounce(onLogGroupSearch, 300)
  };

  const fetchLogGroupOptions = async (region: string, logGroupNamePrefix?: string) => {
    try {
      const logGroups: string[] = await props.datasource.describeLogGroups({
        refId: props.query.refId,
        region,
        logGroupNamePrefix,
      });

      return logGroups.map((logGroup) => ({
        value: logGroup,
        label: logGroup,
      }));
    } catch (err) {
      let errMessage = 'unknown error';
      if (typeof err !== 'string') {
        try {
          errMessage = JSON.stringify(err);
        } catch (e) {}
      } else {
        errMessage = err;
      }
      dispatch(notifyApp(createErrorNotification(errMessage)));
      return [];
    }
  };

  const onLogGroupSearch = (searchTerm: string, region: string, actionMeta: InputActionMeta) => {
    if (actionMeta.action !== 'input-change') {
      return Promise.resolve();
    }

    // No need to fetch matching log groups if the search term isn't valid
    // This is also useful for preventing searches when a user is typing out a log group with template vars
    // See https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_LogGroup.html for the source of the pattern below
    const logGroupNamePattern = /^[\.\-_/#A-Za-z0-9]+$/;
    if (!logGroupNamePattern.test(searchTerm)) {
      return Promise.resolve();
    }

    setLoadingLogGroups(true);

    return fetchLogGroupOptions(region, searchTerm)
      .then((matchingLogGroups) => {
        setAvailableLogGroups(unionBy(availableLogGroups, matchingLogGroups, 'value'));
      })
      .finally(() => {
        setLoadingLogGroups(true);
      });
  };

  const changeSelectedLogGroups = (v: Array<SelectableValue<string>>) => {
    setSelectedLogGroups(v)

    const { onChange, query } = props;
    onChange?.({
      ...(query as CloudWatchLogsQuery),
      logGroupNames: selectedLogGroups.map((logGroupName) => logGroupName.value!) ?? [],
    });
  };

  const setCustomLogGroups = (v: string) => {
    const customLogGroup: SelectableValue<string> = { value: v, label: v };
    const combinedGroups = [...selectedLogGroups, customLogGroup];
    changeSelectedLogGroups(combinedGroups);
  };

  const MAX_LOG_GROUPS = 20;

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
                changeSelectedLogGroups(v);
              }}
              onCreateOption={(v) => {
                setCustomLogGroups(v);
              }}
              onBlur={props.onRunQuery}
              className={containerClass}
              closeMenuOnSelect={false}
              isClearable={true}
              invalid={invalidLogGroups}
              isOptionDisabled={() => selectedLogGroups.length >= MAX_LOG_GROUPS}
              placeholder="Choose Log Groups"
              maxVisibleValues={4}
              noOptionsMessage="No log groups available"
              isLoading={loadingLogGroups}
              onOpenMenu={() => {setInvalidLogGroups(false)}}
              onInputChange={(value, actionMeta) => {
                onLogGroupSearchDebounced(value, query.region, actionMeta);
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
