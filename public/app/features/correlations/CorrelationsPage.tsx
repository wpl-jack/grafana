import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import Page from 'app/core/components/Page/Page';

import { useNavModel } from '../../core/hooks/useNavModel';

import { AddCorrelationForm } from './AddCorrelationForm';
import { useCorrelations } from './useCorrelations';

// FIXME: this is copied over from alerting, and we are using these styles potentially
// in a bunch of different places, maybe move to @grafana/ui?
const getTableStyles = (theme: GrafanaTheme2) => ({
  root: css`
    width: 100%;
    border-radius: ${theme.shape.borderRadius()};
    border: solid 1px ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};

    th {
      padding: ${theme.spacing(1)};
    }

    td {
      padding: 0 ${theme.spacing(1)};
    }

    tr {
      height: 38px;
    }
  `,
  oddRow: css`
    background-color: ${theme.colors.background.primary};
  `,
});

export default function CorrelationsPage() {
  const navModel = useNavModel('correlations');
  const [isAdding, setIsAdding] = useState(false);
  const tableStyles = useStyles2(getTableStyles);
  const correlations = useCorrelations();

  return (
    <>
      <Page navModel={navModel}>
        <Page.Contents>
          {correlations.length === 0 && !isAdding && (
            <EmptyListCTA
              title="You haven't defined any correlation yet."
              buttonIcon="sitemap"
              onClick={() => setIsAdding(true)}
              buttonTitle="Add correlation"
            />
          )}

          {correlations.length >= 1 && (
            <div>
              <HorizontalGroup justify="space-between">
                <div>
                  <h4>Correlations</h4>
                  <p>description</p>
                </div>
                <Button icon="plus" onClick={() => setIsAdding(true)} disabled={isAdding}>
                  Add new
                </Button>
              </HorizontalGroup>
            </div>
          )}

          <AddCorrelationForm onClose={() => setIsAdding(false)} show={isAdding} />

          {correlations.length >= 1 && (
            <table className={tableStyles.root}>
              <thead>
                <tr>
                  <th>Source Datasource</th>
                  <th>Target Datasource</th>
                  <th>Label</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((ds, i) =>
                  ds.correlations.map((correlation, j) => (
                    <tr
                      className={cx({ [tableStyles.oddRow]: (i + j) % 2 === 0 })}
                      key={`${ds.uid}-${correlation.target.uid}`}
                    >
                      <td>
                        <img src={ds.meta.info.logos.small} height={18} />
                        {ds.name}
                      </td>
                      <td>
                        <img
                          src={getDataSourceSrv().getInstanceSettings(correlation.target)?.meta.info.logos.small}
                          height={18}
                        />
                        {getDataSourceSrv().getInstanceSettings(correlation.target)?.name}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </Page.Contents>
      </Page>
    </>
  );
}
