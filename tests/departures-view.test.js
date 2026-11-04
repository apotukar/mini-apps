import assert from 'node:assert/strict';
import test from 'node:test';
import nunjucks from 'nunjucks';
import { registerDeparturesRoutes } from '../src/routes/departures.js';

for (const isNS4 of [false, true]) {
  test(`departure station names are visible for address searches even with one stop (${isNS4 ? 'NS4' : 'default'})`, async () => {
    const routes = new Map();
    registerDeparturesRoutes(
      { get: (path, handler) => routes.set(path, handler), post() {} },
      { config: { favorites: {} } }
    );
    const env = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(['src/views/default', 'src/views/ns4'])
    );
    env.addFilter('split', (value, separator) => (value || '').split(separator));
    env.addFilter('formatTime', () => '12:00');
    env.addFilter('formatDuration', value => value);
    for (const searchByCoordinates of [false, true]) {
      for (const stationCount of [1, 2]) {
        const departure = { stationName: 'Testhaltestelle', lineText: 'Bus 1', delay: 0 };
        const transport = {
          async init() {},
          findStation: async () => ({ normalizedName: 'Suchort', searchByCoordinates }),
          fetchDeparturesUntilFound: async () => ({
            departures: [departure],
            stationNames: Array.from({ length: stationCount }, (_, index) => `Stop ${index}`)
          }),
          buildDeparturesView: () => ({ departures: [departure] })
        };
        let rendered = false;
        await routes.get('/departures/search')(
          { query: { station: 'Suchort', radius: '1' }, services: { get: () => transport } },
          {
            locals: { isNS4 },
            render(template, data) {
              assert.equal(template, `departures/results.${isNS4 ? 'ns4' : 'njk'}`);
              assert.equal(data.showStationNames, searchByCoordinates);
              const html = env.render(template, data);
              const expected = searchByCoordinates || stationCount > 1;
              assert.equal(html.includes('Testhaltestelle'), expected);
              assert.equal(html.includes('nearbyred.min'), expected);
              rendered = true;
            }
          }
        );
        assert.equal(rendered, true);
      }
    }
  });
}
