import { getDataSourceSrv } from '@grafana/runtime';

export const useCorrelations = () => {
  return (
    getDataSourceSrv()
      .getList()
      // FIXME: the filter parameter in `getList` behaves a bit funny, returning datasources nor matching the filters.
      //   so we filter after getting the whole list
      .filter((ds) => ds.correlations.length >= 1)
    //   .flatMap((a) => {
    //     return {
    //       source: { uid: a.uid, type: a.type },
    //       targets: a.correlations,
    //     };
    //   })
  );
};
