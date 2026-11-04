import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultProfile } from '@motis-project/motis-fptf-client/lib/default-profile.js';
import { TransportService } from '../src/services/transport-service.js';
import { withDepartureRadius } from '../src/lib/transport-profile.js';
import { registerDeparturesRoutes } from '../src/routes/departures.js';

test('Landshut Ländtor searches only stops instead of using a place ID for departures', async () => {
  const station = { type: 'station', id: 'test-feed_laendtor', name: 'Ländtorplatz, Landshut' };
  const service = new TransportService(
    async () => ({
      async locations(name, opt) {
        assert.equal(name, 'Landshut Ländtor');
        assert.equal(opt.results, 1);
        const request = defaultProfile.formatLocationsReq({ opt }, name);
        assert.equal(request.query.text, name);
        assert.equal(request.query.type, 'STOP');
        return [station];
      },
      async departures(id, opt) {
        assert.equal(id, station.id);
        return { departures: [{ when: opt.when.toISOString(), stop: station }] };
      }
    }),
    {}
  );
  await service.init();
  const found = await service.findStation('Landshut Ländtor');
  assert.equal(found.normalizedName, station.name);
  const result = await service.fetchDeparturesUntilFound(found, undefined, 1);
  assert.equal(result.departures.length, 1);
});

for (const poi of [false, true]) {
  test(`departures use coordinates for ${poi ? 'Landshut Ländtor as a POI' : 'München Lucile-Grahn-Str. 26'}`, async () => {
    const input = poi ? 'Landshut Ländtor' : 'München Lucile-Grahn-Str. 26';
    // Also cover valid zero coordinates and locations without a geocoder ID.
    const location = { type: 'location', name: 'Geocoder name', latitude: 0, longitude: 0, poi };
    if (poi) {
      location.id = 'osm_place_id';
    }
    const profile = withDepartureRadius(defaultProfile);
    const start = new Date('2026-11-04T12:00:00Z');
    let calls = 0;
    const stop = { id: 'feed_stop', name: 'Nearby', location: { latitude: 0.001, longitude: 0 } };
    const service = new TransportService(
      async () => ({
        async locations(name, opt) {
          assert.equal(name, input);
          assert.equal(opt.addresses, true);
          assert.equal(opt.poi, true);
          assert.equal(opt.stops, true);
          assert.equal(defaultProfile.formatLocationsReq({ opt }, name).query.type, undefined);
          return [location];
        },
        async departures(id, opt) {
          assert.equal(id, '0,0');
          assert.equal(opt.center, '0,0');
          assert.equal(opt.radius, 500);
          assert.equal(opt.results, null);
          const request = profile.formatStationBoardReq(
            { profile, opt: { ...opt, includeRelatedStations: true } },
            id,
            'departures'
          );
          assert.equal('stopId' in request.query, false);
          assert.equal(request.query.center, '0,0');
          assert.equal(request.query.radius, 500);
          assert.equal(request.query.exactRadius, true);
          calls++;
          if (calls === 1) {
            return { departures: [] };
          }
          assert.equal(opt.when.getTime(), start.getTime() + 30 * 60_000);
          const departure = { tripId: 'trip', when: opt.when.toISOString(), stop };
          return {
            departures: [
              departure,
              departure,
              { ...departure, stop: { ...stop, location: { latitude: 1, longitude: 0 } } }
            ]
          };
        }
      }),
      {}
    );
    await service.init();
    const found = await service.findStation(input, { allowLocations: true });
    assert.equal(found.normalizedName, input);
    const result = await service.fetchDeparturesUntilFound(found, start, 1, 0.5);
    assert.equal(calls, 2);
    assert.equal(result.departures.length, 1);
    assert.deepEqual(result.stationNames, ['Nearby']);
  });
}

test('address search rejects locations without usable coordinates before requesting departures', async () => {
  const service = new TransportService(
    async () => ({ locations: async () => [{ type: 'location', id: 'osm-id' }] }),
    {}
  );
  await service.init();
  await assert.rejects(
    service.findStation('Adresse', { allowLocations: true }),
    /Ort hat keine gültigen Koordinaten/
  );
});

test('departure searches and favorites both allow addresses and preserve the full input', async () => {
  const gets = new Map();
  const posts = new Map();
  registerDeparturesRoutes(
    {
      get: (path, handler) => gets.set(path, handler),
      post: (path, handler) => posts.set(path, handler)
    },
    { config: { favorites: {} }, route: { name: 'departures' } }
  );
  const input = 'München Lucile-Grahn-Str. 26';
  const transport = {
    async init() {},
    async findStation(name, options) {
      assert.equal(name, input);
      assert.equal(options.allowLocations, true);
      return { normalizedName: input };
    },
    async fetchDeparturesUntilFound() {
      return { departures: [], stationNames: [] };
    },
    buildDeparturesView: () => ({ departures: [] })
  };
  const favorites = {
    getFavorites: async () => [],
    dedupeFavs: values => values,
    async saveFavorites(res, values) {
      assert.deepEqual(values, [input]);
    }
  };
  const req = {
    query: { station: input },
    body: { station: input },
    services: { get: name => (name === 'transportService' ? transport : favorites) }
  };
  let rendered = false;
  await gets.get('/departures/search')(req, {
    render(template, data) {
      assert.equal(template, 'departures/no-results.njk');
      assert.equal(data.stationName, input);
      rendered = true;
    }
  });
  assert.equal(rendered, true);
  await posts.get('/departures/save-fav')(req, {
    redirect(url) {
      assert.equal(url, `/departures?station=${encodeURIComponent(input)}`);
    }
  });
});
