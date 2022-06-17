import { EventBusExtended } from '@grafana/data';

import { DashboardState, StoreState } from '../../../types';
import { DashboardModel } from '../../dashboard/state';
import { initialState } from '../../dashboard/state/reducers';
import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { constantBuilder, customBuilder } from '../shared/testing/builders';
import { VariableModel } from '../types';
import { ExtendedUrlQueryMap } from '../utils';

import { templateVarsChangedInUrl } from './actions';
import { getPreloadedState } from './helpers';
import { VariablesState } from './types';

const dashboardModel = new DashboardModel({});

variableAdapters.setInit(() => [createCustomVariableAdapter(), createConstantVariableAdapter()]);

async function getTestContext(urlQueryMap: ExtendedUrlQueryMap = {}, variable: VariableModel | undefined = undefined) {
  jest.clearAllMocks();

  const key = 'key';
  if (!variable) {
    variable = customBuilder()
      .withId('variable')
      .withRootStateKey(key)
      .withName('variable')
      .withCurrent(['A', 'C'])
      .withOptions('A', 'B', 'C')
      .build();
  }

  const setValueFromUrlMock = jest.fn();
  variableAdapters.get(variable.type).setValueFromUrl = setValueFromUrlMock;

  const templateVariableValueUpdatedMock = jest.fn();
  const startRefreshMock = jest.fn();
  const dashboard: DashboardState = {
    ...initialState,
    getModel: () => {
      dashboardModel.templateVariableValueUpdated = templateVariableValueUpdatedMock;
      dashboardModel.startRefresh = startRefreshMock;
      dashboardModel.templating = { list: [variable] };
      return dashboardModel;
    },
  };

  const variables: VariablesState = { variable };
  const state: Partial<StoreState> = {
    dashboard,
    ...getPreloadedState(key, { variables }),
  };
  const getState = () => state as unknown as StoreState;

  const dispatch = jest.fn();
  const eventsMock = { publish: jest.fn() } as unknown as EventBusExtended;
  const thunk = templateVarsChangedInUrl(key, urlQueryMap, eventsMock);

  await thunk(dispatch, getState, undefined);

  return { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, variable, eventsMock };
}

describe('templateVarsChangedInUrl', () => {
  describe('when called with no variables in url query map', () => {
    it('then no value should change and dashboard should not be refreshed', async () => {
      const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, eventsMock } =
        await getTestContext();

      expect(setValueFromUrlMock).not.toHaveBeenCalled();
      expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
      expect(startRefreshMock).not.toHaveBeenCalled();
      expect(eventsMock.publish).not.toHaveBeenCalled();
    });
  });

  describe('when called with no variables in url query map matching variables in state', () => {
    it('then no value should change and dashboard should not be refreshed', async () => {
      const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, eventsMock } =
        await getTestContext({
          'var-query': { value: 'A' },
        });

      expect(setValueFromUrlMock).not.toHaveBeenCalled();
      expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
      expect(startRefreshMock).not.toHaveBeenCalled();
      expect(eventsMock.publish).not.toHaveBeenCalled();
    });
  });

  describe('when called with variables in url query map matching variables in state', () => {
    describe('and the values in url query map are the same as current in state', () => {
      it('then no value should change and dashboard should not be refreshed', async () => {
        const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock } = await getTestContext({
          'var-variable': { value: ['A', 'C'] },
        });

        expect(setValueFromUrlMock).not.toHaveBeenCalled();
        expect(templateVariableValueUpdatedMock).not.toHaveBeenCalled();
        expect(startRefreshMock).not.toHaveBeenCalled();
      });
    });

    describe('and the values in url query map are the not the same as current in state', () => {
      it('then the value should change to the value in url query map and dashboard should be refreshed', async () => {
        const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, variable, eventsMock } =
          await getTestContext({
            'var-variable': { value: 'B' },
          });

        expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
        expect(setValueFromUrlMock).toHaveBeenCalledWith(variable, 'B');
        expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
        expect(startRefreshMock).toHaveBeenCalledTimes(1);
        expect(eventsMock.publish).toHaveBeenCalledTimes(1);
      });

      describe('but the values in url query map were removed', () => {
        it('then the value should change to the value in dashboard json and dashboard should be refreshed', async () => {
          const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, variable } =
            await getTestContext({
              'var-variable': { value: '', removed: true },
            });

          expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
          expect(setValueFromUrlMock).toHaveBeenCalledWith(variable, ['A', 'C']);
          expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
          expect(startRefreshMock).toHaveBeenCalledTimes(1);
        });
      });

      describe('and the variable is a constant', () => {
        it('then the value should change to the value in dashboard json and dashboard should be refreshed', async () => {
          const constant = constantBuilder()
            .withId('variable')
            .withRootStateKey('key')
            .withName('variable')
            .withQuery('default value in dash.json')
            .build();
          const { setValueFromUrlMock, templateVariableValueUpdatedMock, startRefreshMock, variable } =
            await getTestContext(
              {
                'var-variable': { value: '', removed: true },
              },
              constant
            );

          expect(setValueFromUrlMock).toHaveBeenCalledTimes(1);
          expect(setValueFromUrlMock).toHaveBeenCalledWith(variable, 'default value in dash.json');
          expect(templateVariableValueUpdatedMock).toHaveBeenCalledTimes(1);
          expect(startRefreshMock).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
