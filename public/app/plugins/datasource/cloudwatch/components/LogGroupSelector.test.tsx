import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import lodash from 'lodash'; // eslint-disable-line lodash/import-scope
import React from 'react';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { DescribeLogGroupsRequest } from '../types';

import { LogGroupSelector, LogGroupSelectorProps } from './LogGroupSelector';

const ds = setupMockedDataSource();

describe('LogGroupSelector', () => {
  const onChange = jest.fn();
  const defaultProps: LogGroupSelectorProps = {
    region: 'region1',
    datasource: ds.datasource,
    selectedLogGroups: [],
    onChange,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('updates upstream query log groups on region change', async () => {
    ds.datasource.describeLogGroups = jest.fn().mockImplementation(async (params: DescribeLogGroupsRequest) => {
      if (params.region === 'region1') {
        return Promise.resolve(['log_group_1']);
      } else {
        return Promise.resolve(['log_group_2']);
      }
    });
    const props = {
      ...defaultProps,
      selectedLogGroups: ['log_group_1'],
    };

    const { rerender } = render(<LogGroupSelector {...props} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith(['log_group_1']);
    expect(await screen.findByText('log_group_1')).toBeInTheDocument();

    act(() => rerender(<LogGroupSelector {...props} region="region2" />));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('does not update upstream query log groups if saved is false', async () => {
    ds.datasource.describeLogGroups = jest.fn().mockImplementation(async (params: DescribeLogGroupsRequest) => {
      if (params.region === 'region1') {
        return Promise.resolve(['log_group_1']);
      } else {
        return Promise.resolve(['log_group_2']);
      }
    });
    const props = {
      ...defaultProps,
      selectedLogGroups: ['log_group_1'],
    };

    const { rerender } = render(<LogGroupSelector {...props} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith(['log_group_1']);
    expect(await screen.findByText('log_group_1')).toBeInTheDocument();

    act(() => rerender(<LogGroupSelector {...props} region="region2" saved={false} />));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenLastCalledWith(['log_group_1']);
  });

  it('should merge results of remote log groups search with existing results', async () => {
    lodash.debounce = jest.fn().mockImplementation((fn) => fn);
    const allLogGroups = [
      'AmazingGroup',
      'AmazingGroup2',
      'AmazingGroup3',
      'BeautifulGroup',
      'BeautifulGroup2',
      'BeautifulGroup3',
      'CrazyGroup',
      'CrazyGroup2',
      'CrazyGroup3',
      'DeliciousGroup',
      'DeliciousGroup2',
      'DeliciousGroup3',
      'EnjoyableGroup',
      'EnjoyableGroup2',
      'EnjoyableGroup3',
      'FavouriteGroup',
      'FavouriteGroup2',
      'FavouriteGroup3',
      'GorgeousGroup',
      'GorgeousGroup2',
      'GorgeousGroup3',
      'HappyGroup',
      'HappyGroup2',
      'HappyGroup3',
      'IncredibleGroup',
      'IncredibleGroup2',
      'IncredibleGroup3',
      'JollyGroup',
      'JollyGroup2',
      'JollyGroup3',
      'KoolGroup',
      'KoolGroup2',
      'KoolGroup3',
      'LovelyGroup',
      'LovelyGroup2',
      'LovelyGroup3',
      'MagnificentGroup',
      'MagnificentGroup2',
      'MagnificentGroup3',
      'NiceGroup',
      'NiceGroup2',
      'NiceGroup3',
      'OddGroup',
      'OddGroup2',
      'OddGroup3',
      'PerfectGroup',
      'PerfectGroup2',
      'PerfectGroup3',
      'QuietGroup',
      'QuietGroup2',
      'QuietGroup3',
      'RestlessGroup',
      'RestlessGroup2',
      'RestlessGroup3',
      'SurpriseGroup',
      'SurpriseGroup2',
      'SurpriseGroup3',
      'TestingGroup',
      'TestingGroup2',
      'TestingGroup3',
      'UmbrellaGroup',
      'UmbrellaGroup2',
      'UmbrellaGroup3',
      'VelvetGroup',
      'VelvetGroup2',
      'VelvetGroup3',
      'WaterGroup',
      'WaterGroup2',
      'WaterGroup3',
      'XylophoneGroup',
      'XylophoneGroup2',
      'XylophoneGroup3',
      'YellowGroup',
      'YellowGroup2',
      'YellowGroup3',
      'ZebraGroup',
      'ZebraGroup2',
      'ZebraGroup3',
    ];

    ds.datasource.describeLogGroups = jest.fn().mockImplementation(async (params: DescribeLogGroupsRequest) => {
      const theLogGroups = allLogGroups
        .filter((logGroupName) => logGroupName.startsWith(params.logGroupNamePrefix ?? ''))
        .slice(0, Math.max(params.limit ?? 50, 50));
      return Promise.resolve(theLogGroups);
    });
    const props = {
      ...defaultProps,
    };
    render(<LogGroupSelector {...props} />);
    const multiselect = await screen.findByLabelText('Log Groups');

    // Adds the 3 water groups to the 50 loaded in initially
    await userEvent.type(multiselect, 'Water');
    expect(screen.getAllByLabelText('Select option').length).toBe(3);
    await userEvent.clear(multiselect);
    expect(screen.getAllByLabelText('Select option').length).toBe(53);

    // Adds the three Velvet groups to the previous 53
    await userEvent.type(multiselect, 'Velv');
    expect(screen.getAllByLabelText('Select option').length).toBe(3);
    await userEvent.clear(multiselect);
    expect(screen.getAllByLabelText('Select option').length).toBe(56);
  });
});
