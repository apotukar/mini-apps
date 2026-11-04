import assert from 'node:assert/strict';
import test from 'node:test';
import { TransportService } from '../src/services/transport-service.js';

const service = new TransportService(async () => ({}), {
  transportLabels: {},
  transportCssTypeAppendices: {}
});
const plannedDeparture = '2026-11-04T12:00:00Z';
const plannedArrival = '2026-11-04T13:00:00Z';

for (const value of [undefined, null, '', 'invalid']) {
  test(`journey times fall back to the schedule for realtime value ${JSON.stringify(value)}`, () => {
    const view = service.buildJourneyView(
      [{ departure: value, arrival: value, plannedDeparture, plannedArrival }],
      0
    );
    assert.equal(view.departure.getTime(), Date.parse(plannedDeparture));
    assert.equal(view.arrival.getTime(), Date.parse(plannedArrival));
    assert.equal(view.duration, '60');
    assert.deepEqual(view.legs[0].depTime, view.departure);
    assert.deepEqual(view.legs[0].arrTime, view.arrival);
  });
}

test('journey times prefer realtime and fall back to realtime when the schedule is invalid', () => {
  const departure = '2026-11-04T12:05:00Z';
  const arrival = '2026-11-04T13:10:00Z';
  for (const planned of [plannedDeparture, null, 'invalid']) {
    const view = service.buildJourneyView(
      [{ departure, arrival, plannedDeparture: planned, plannedArrival: planned }],
      0
    );
    assert.equal(view.departure.getTime(), Date.parse(departure));
    assert.equal(view.arrival.getTime(), Date.parse(arrival));
    assert.equal(view.duration, '65');
    const expected = planned === plannedDeparture ? new Date(planned) : view.departure;
    assert.deepEqual(view.plannedDeparture, expected);
    assert.deepEqual(view.legs[0].depPlannedTime, expected);
  }
});

test('journey duration uses the first departure and last arrival across multiple legs', () => {
  const view = service.buildJourneyView(
    [
      { plannedDeparture, plannedArrival: '2026-11-04T12:20:00Z' },
      { plannedDeparture: '2026-11-04T12:30:00Z', plannedArrival }
    ],
    0
  );
  assert.equal(view.duration, '60');
  assert.equal(view.transfers, 1);
});

test('missing journey times stay null rather than becoming epoch dates or invalid dates', () => {
  const view = service.buildJourneyView([{ departure: 'invalid', arrival: null }], 0);
  assert.equal(view.departure, null);
  assert.equal(view.arrival, null);
  assert.equal(view.plannedDeparture, null);
  assert.equal(view.plannedArrival, null);
  assert.equal(view.duration, null);
  assert.equal(view.legs[0].depTime, null);
  assert.equal(view.legs[0].arrTime, null);
  assert.equal(service.buildJourneyView([], 0), null);
});

test('fetchJourneys forwards arguments and preserves results and errors', async () => {
  const from = { id: 'from' };
  const to = { id: 'to' };
  const options = { results: 5 };
  const result = { journeys: [] };
  const error = new Error('API failure');
  let fail = false;
  const transport = new TransportService(
    async () => ({
      async journeys(...args) {
        assert.deepEqual(args, [from, to, options]);
        if (fail) {
          throw error;
        }
        return result;
      }
    }),
    {}
  );
  await transport.init();
  assert.equal(await transport.fetchJourneys(from, to, options), result);
  fail = true;
  await assert.rejects(transport.fetchJourneys(from, to, options), error);
});
