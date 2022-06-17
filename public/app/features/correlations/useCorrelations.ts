import { getDataSourceSrv } from '@grafana/runtime';

export const useCorrelations = () => {
  // return [];

  return (
    getDataSourceSrv()
      .getList()
      // FIXME: the filter parameter in `getList` behaves a bit funny, returning datasources nor matching the filters.
      //   so we filter after getting the whole list
      .filter((ds) => ds.correlations.length >= 1)
  );
};
