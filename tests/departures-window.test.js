import assert from 'node:assert/strict';
import test from 'node:test';
import { TransportService } from '../src/services/transport-service.js';

const start = new Date('2026-11-03T23:30:00Z');
const station = {
  id: 'center',
  type: 'station',
  location: { latitude: 0, longitude: 0 }
};

function departure(minute, id = String(minute), latitude = 0.001) {
  return {
    tripId: id,
    when: new Date(start.getTime() + minute * 60_000).toISOString(),
    stop: { id: 'near', name: 'Near', location: { latitude, longitude: 0 } }
  };
}

async function run(batches) {
  const calls = [];
  const client = {
    async departures(id, opts) {
      assert.equal(id, station.id);
      assert.equal(opts.duration, 30);
      assert.equal(opts.results, null);
      calls.push(opts);
      return { departures: batches[calls.length - 1] || [] };
    }
  };
  const service = new TransportService(async () => client, {});
  await service.init();
  const result = await service.fetchDeparturesUntilFound(station, start);
  return { calls, result };
}

test('returns the first ten sorted departures from a complete 30-minute window', async () => {
  const batch = Array.from({ length: 20 }, (_, i) => departure(i + 1)).reverse();
  const { calls, result } = await run([batch]);
  assert.equal(calls.length, 1);
  assert.deepEqual(
    result.departures.map(d => d.tripId),
    batch
      .slice()
      .reverse()
      .slice(0, 10)
      .map(d => d.tripId)
  );
});

test('extends the window beyond six results and handles midnight and boundaries', async () => {
  const early = Array.from({ length: 6 }, (_, i) => departure(i + 1));
  const boundary = departure(30);
  const later = [boundary, departure(30.1), departure(31), departure(32)];
  const { calls, result } = await run([
    [departure(-1), ...early, early[0], boundary],
    [early[5], ...later]
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].when.toISOString(), '2026-11-04T00:00:00.000Z');
  assert.equal(result.departures.length, 10);
  assert.deepEqual(result.departures, [...early, ...later]);
});

test('applies the result limit after radius filtering', async () => {
  const outside = Array.from({ length: 12 }, (_, i) => departure(i, `outside-${i}`, 1));
  const inside = Array.from({ length: 10 }, (_, i) => departure(i + 15));
  const { calls, result } = await run([[...outside, ...inside]]);
  assert.equal(calls.length, 1);
  assert.deepEqual(result.departures, inside);
});

test('continues through empty windows but stops after six hours', async () => {
  const { calls, result } = await run([[], [departure(31)]]);
  assert.equal(calls.length, 12);
  assert.equal(calls[11].when.getTime(), start.getTime() + 330 * 60_000);
  assert.deepEqual(result.departures, [departure(31)]);
  assert.deepEqual(result.stationNames, ['Near']);
  assert.equal(calls[0].when.getTime(), start.getTime());
});

test('ignores invalid times and uses planned times when realtime is absent', async () => {
  const planned = { ...departure(1), when: null, plannedWhen: departure(1).when };
  const { result } = await run([[{ ...departure(2), when: 'invalid' }, planned]]);
  assert.deepEqual(result.departures, [planned]);
});
