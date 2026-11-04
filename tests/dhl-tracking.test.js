import assert from 'node:assert/strict';
import test from 'node:test';
import { DhlApiError, fetchShipment } from '../src/lib/tracking/dhl.js';
import { registerTrackRoutes } from '../src/routes/track.js';

test('DHL detects the service automatically and maps shipment data', async t => {
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get('trackingNumber'), 'JJD000000000000000000');
    assert.equal(url.searchParams.has('service'), false);
    assert.equal(url.searchParams.get('requesterCountryCode'), 'DE');
    assert.equal(url.searchParams.get('language'), 'de');
    assert.equal(options.headers['DHL-API-Key'], 'test-key');
    return new Response(
      JSON.stringify({
        shipments: [
          {
            id: 'test-shipment',
            service: 'parcel-de',
            status: { description: 'Unterwegs', timestamp: '2026-11-04T12:00:00Z' },
            events: [{ description: 'Angekündigt' }]
          }
        ]
      })
    );
  });
  const shipment = await fetchShipment('JJD000000000000000000', { apiKey: 'test-key' });
  assert.equal(shipment.id, 'test-shipment');
  assert.equal(shipment.status.description, 'Unterwegs');
  assert.equal(shipment.events[0].description, 'Angekündigt');
});

test('DHL still supports an explicit service', async t => {
  t.mock.method(globalThis, 'fetch', async input => {
    assert.equal(new URL(input).searchParams.get('service'), 'express');
    return new Response(JSON.stringify({ shipments: [] }));
  });
  assert.equal(await fetchShipment('test', { apiKey: 'test-key', service: 'express' }), null);
});

test('DHL preserves the HTTP status and problem details without inferring a shipment status', async t => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ title: 'Not Found', detail: 'No shipment found' }), {
        status: 404
      })
  );
  await assert.rejects(fetchShipment('test', { apiKey: 'test-key' }), error => {
    assert.ok(error instanceof DhlApiError);
    assert.equal(error.status, 404);
    assert.equal(error.title, 'Not Found');
    assert.equal(error.detail, 'No shipment found');
    return true;
  });
});

test('DHL preserves the status even for empty, HTML or unexpected error bodies', async t => {
  for (const body of ['', '<html>Not Found</html>', 'null', '{"detail":{},"title":42}']) {
    const mock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response(body, { status: 404 })
    );
    await assert.rejects(fetchShipment('test', { apiKey: 'test-key' }), error => {
      assert.ok(error instanceof DhlApiError);
      assert.equal(error.status, 404);
      assert.equal(error.title, '');
      assert.equal(error.detail, '');
      return true;
    });
    mock.mock.restore();
  }
});

test('DHL authentication, rate-limit and server errors are not hidden as missing shipments', async t => {
  for (const status of [401, 403, 429, 500]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    await assert.rejects(fetchShipment('test', { apiKey: 'test-key' }), {
      message: `DHL-API antwortete mit Status ${status}`,
      status
    });
    mock.mock.restore();
  }
});

for (const viewExt of ['njk', 'ns4']) {
  test(`tracking route displays a missing shipment in the ${viewExt} view`, async () => {
    const routes = new Map();
    registerTrackRoutes(
      { get: (path, handler) => routes.set(path, handler) },
      {
        route: { name: 'track' }
      }
    );
    const favorites = { getFavorites: async () => [] };
    let rendered = false;
    await routes.get('/track')(
      {
        query: { q: 'test' },
        services: {
          get: name =>
            name === 'trackService' ? { dhlFetchShipment: async () => null } : favorites
        }
      },
      {
        locals: { viewExt },
        render(view, data) {
          rendered = true;
          assert.equal(view, `track/index.${viewExt}`);
          assert.equal(
            data.error,
            'Keine Sendungsdaten verfügbar. Bitte Nummer prüfen oder später erneut versuchen.'
          );
          assert.equal(data.shipment, null);
          assert.equal(data.query, 'test');
        }
      }
    );
    assert.equal(rendered, true);
  });
}

for (const viewExt of ['njk', 'ns4']) {
  for (const status of [404, 401, 429, 500]) {
    test(`tracking route handles DHL ${status} in the ${viewExt} view`, async t => {
      const routes = new Map();
      registerTrackRoutes(
        { get: (path, handler) => routes.set(path, handler) },
        { route: { name: 'track' } }
      );
      t.mock.method(console, 'error', () => {});
      const apiError = new DhlApiError(status, { detail: '<b>Internal API detail</b>' });
      const favorites = { getFavorites: async () => [] };
      let rendered = false;
      await routes.get('/track')(
        {
          query: { q: 'test' },
          services: {
            get: name =>
              name === 'trackService'
                ? {
                    dhlFetchShipment: async () => {
                      throw apiError;
                    }
                  }
                : favorites
          }
        },
        {
          locals: { viewExt },
          render(view, data) {
            rendered = true;
            assert.equal(view, `track/index.${viewExt}`);
            assert.equal(
              data.error,
              status === 404
                ? 'Keine Sendungsdaten verfügbar. Bitte Nummer prüfen oder später erneut versuchen.'
                : 'Fehler beim Abruf der DHL-Daten.'
            );
            assert.equal(data.shipment, null);
            assert.equal(data.query, 'test');
          }
        }
      );
      assert.equal(rendered, true);
      assert.equal(console.error.mock.calls[0].arguments[1], apiError);
    });
  }
}
