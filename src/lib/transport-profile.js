import { defaultProfile } from '@motis-project/motis-fptf-client/lib/default-profile.js';

export function withDepartureRadius(profile) {
  const formatStationBoardReq =
    profile.formatStationBoardReq || defaultProfile.formatStationBoardReq;

  return {
    ...profile,
    formatStationBoardReq(ctx, station, type) {
      const request = formatStationBoardReq(ctx, station, type);
      const radius = ctx.opt.radius;

      if (ctx.opt.center && Number.isFinite(radius) && radius > 0) {
        const query = { ...request.query, center: ctx.opt.center, radius, exactRadius: true };
        delete query.stopId;
        return { ...request, query };
      }

      if (ctx.opt.includeRelatedStations !== false && Number.isFinite(radius) && radius > 0) {
        return { ...request, query: { ...request.query, radius } };
      }

      return request;
    }
  };
}
