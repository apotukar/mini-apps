import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultProfile } from '@motis-project/motis-fptf-client/lib/default-profile.js';
import { withDepartureRadius } from '../src/lib/transport-profile.js';
import { TransportService } from '../src/services/transport-service.js';
import { registerDeparturesRoutes } from '../src/routes/departures.js';
import nunjucks from 'nunjucks';

test('departures default to 300 meters and select 0.3 km in the view', async () => {
  const routes = new Map();
  registerDeparturesRoutes(
    { get: (path, handler) => routes.set(path, handler), post() {} },
    { config: { favorites: {} } }
  );
  const favorites = { getFavorites: async () => [], getHideFlag: async () => true };
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/views/default'));
  env.addFilter('split', (value, separator) => (value || '').split(separator));
  for (const radius of [undefined, '', 'invalid', '0', '-1', 'Infinity', '0.3', '0.5']) {
    await routes.get('/departures')(
      { query: { radius }, services: { get: () => favorites } },
      {
        locals: {},
        render(template, data) {
          const expected = radius === '0.5' ? 0.5 : 0.3;
          assert.equal(data.radius, expected);
          const html = env.render('departures/index.njk', data);
          assert.ok(html.includes(`<option value="${expected}" selected>`));
          assert.ok(html.includes('>300 m</option>'));
          assert.ok(html.includes('>500 m</option>'));
          assert.ok(html.includes('>1 km</option>'));
        }
      }
    );
  }
  const service = new TransportService(
    async () => ({
      async departures(id, opts) {
        assert.equal(opts.radius, 300);
        return { departures: [{ when: opts.when.toISOString(), stop: { name: 'Station' } }] };
      }
    }),
    {}
  );
  await service.init();
  await service.fetchDeparturesUntilFound({ id: 'station' }, undefined, 1);
});

test('legacy departures offer the same radii and preserve the radius in favorite links', () => {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(['src/views/default', 'src/views/ns4'])
  );
  env.addFilter('split', (value, separator) => (value || '').split(separator));
  for (const radius of [undefined, 0.3, 0.5, 1, 2, 3, 5, 10]) {
    const html = env.render('departures/index.ns4', {
      radius,
      favs: ['Berlin'],
      station: 'Berlin'
    });
    assert.ok(html.includes(`<option value="${radius ?? 0.3}" selected>`));
    assert.ok(html.includes('>300 m</option>'));
    assert.ok(html.includes('>500 m</option>'));
    assert.ok(html.includes('>1 km</option>'));
    assert.ok(html.includes(`station=Berlin&radius=${radius ?? 0.3}`));
    assert.ok(html.includes('onchange="updateDepartureRadius(this)"'));
  }
});

test('results show the radius for both single and multiple stations', () => {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/views/default'));
  env.addFilter('split', (value, separator) => (value || '').split(separator));
  for (const stationCount of [1, 2]) {
    for (const [radius, label] of [
      [0.3, '300 m'],
      [0.5, '500 m'],
      [2, '2 km']
    ]) {
      const html = env.render('departures/results.njk', {
        stationCount,
        radius,
        departures: []
      });
      assert.ok(html.includes(`<small>${label}</small>`));
    }
  }
});

test('departure request uses the selected radius and preserves other parameters', () => {
  const profile = withDepartureRadius(defaultProfile);
  for (const radius of [300, 500, 1000, 5000]) {
    const ctx = {
      profile,
      opt: { radius, includeRelatedStations: true, when: new Date(0), duration: 60 }
    };
    const original = defaultProfile.formatStationBoardReq(ctx, 'station-id', 'departures');
    const request = profile.formatStationBoardReq(ctx, 'station-id', 'departures');
    assert.deepEqual(request, { ...original, query: { ...original.query, radius } });
    ctx.opt.includeRelatedStations = false;
    assert.equal(
      profile.formatStationBoardReq(ctx, 'station-id', 'departures').query.radius,
      undefined
    );
  }
});

for (const type of ['location', 'station', 'stop']) {
  test(`radius filters ${type} results and is passed to the client in meters`, async () => {
    // Coordinates on the equator also ensure that zero is accepted as a valid coordinate.
    const location = { type: 'location', latitude: 0, longitude: 0 };
    const station =
      type === 'location' ? { ...location, id: 'center' } : { type, id: 'center', location };
    const departures = [
      { stop: { name: 'Near', location: { latitude: 0.001, longitude: 0 } } },
      { stop: { name: 'Further', location: { latitude: 0.0072, longitude: 0 } } }
    ];
    for (const [radius, expected] of [
      [0.5, ['Near']],
      [1, ['Near', 'Further']],
      [5, ['Near', 'Further']]
    ]) {
      const client = {
        async departures(id, opts) {
          assert.equal(id, 'center');
          assert.equal(opts.radius, radius * 1000);
          return {
            departures: departures.map(departure => ({
              ...departure,
              when: opts.when.toISOString()
            }))
          };
        }
      };
      const service = new TransportService(async () => client, {});
      await service.init();
      const result = await service.fetchDeparturesUntilFound(
        station,
        undefined,
        expected.length,
        radius
      );
      assert.deepEqual(result.stationNames, expected);
    }
  });
}
