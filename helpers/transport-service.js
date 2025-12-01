// TODO: complete class
export class TransportService {
  constructor(client, transportLabels = {}, transportCssTypeAppendices = {}) {
    this.client = client;
    this.transportLabels = transportLabels;
    this.transportCssTypeAppendices = transportCssTypeAppendices;
  }
}

export function buildJourneyView(legs, index, transportLabels) {
  if (!legs.length) {
    return null;
  }

  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];

  const dep = new Date(firstLeg.departure);
  const depPlanned = new Date(firstLeg.plannedDeparture);
  const depDelayMin =
    firstLeg.departureDelay !== null ? Math.round(firstLeg.departureDelay / 60) : 0;
  const arr = new Date(lastLeg.arrival);
  const arrPlanned = new Date(lastLeg.plannedArrival);
  const arrDelayMin =
    legs.length > 1
      ? lastLeg.arrivalDelay !== null
        ? Math.round(lastLeg.arrivalDelay / 60)
        : 0
      : null;

  const durationMinutes = ((arr - dep) / 60000).toFixed(0);
  const transfers = Math.max(0, legs.length - 1);

  const legsView = legs.map((leg, idx) => {
    const dep = leg.departure ? new Date(leg.departure) : null;
    const depPlanned = leg.plannedDeparture ? new Date(leg.plannedDeparture) : null;
    const depDelayMin = leg.departureDelay !== null ? Math.round(leg.departureDelay / 60) : 0;
    const arr = leg.arrival ? new Date(leg.arrival) : null;
    const arrPlanned = leg.plannedArrival ? new Date(leg.plannedArrival) : null;
    const arrDelayMin = leg.arrivalDelay !== null ? Math.round(leg.arrivalDelay / 60) : 0;
    const line = leg.line || {};
    const productKey = line.product || line.mode || '';
    const product = transportLabels[productKey] || productKey;
    const lineName = line.name || line.label || line.id || '';
    const lineText = [product, lineName].filter(Boolean).join(' ');

    const statusRemarks = (leg.remarks || [])
      .filter(r => r.type === 'status')
      .map(r => r.summary || r.text);

    const hintRemarks = (leg.remarks || [])
      .filter(r => r.type === 'hint')
      .map(r => r.summary || r.text);

    const isWalking = !!leg.walking;
    const isDelayed = depDelayMin > 0 || arrDelayMin > 0;

    return {
      idx: idx + 1,
      originName: leg.origin?.name || '',
      destName: leg.destination?.name || '',
      direction: leg.direction || '',
      product,
      lineName,
      lineText,
      isWalking,
      distance: leg.distance || null,
      isPublic: leg.public !== false,
      loadFactor: leg.loadFactor || null,

      depTime: dep,
      depPlannedTime: depPlanned,
      depDelayMin,
      depPlatform: leg.departurePlatform || null,
      depPlatformPlanned: leg.plannedDeparturePlatform || null,

      arrTime: arr,
      arrPlannedTime: arrPlanned,
      arrDelayMin,
      arrPlatform: leg.arrivalPlatform || null,
      arrPlatformPlanned: leg.plannedArrivalPlatform || null,

      isDelayed,
      statusRemarks,
      hintRemarks
    };
  });

  return {
    number: index + 1,
    departure: dep,
    plannedDeparture: depPlanned,
    departureDelayMin: depDelayMin,
    arrival: arr,
    plannedArrival: arrPlanned,
    arrivalDelayMin: arrDelayMin,
    duration: durationMinutes,
    transfers,
    legs: legsView
  };
}

function normalizeIfUpper(word) {
  if (word === word.toUpperCase()) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }
  return word;
}

export async function findStation(client, name) {
  const list = await client.locations(name, { results: 1 });
  if (!list || list.length === 0) {
    throw new Error('Station nicht gefunden: ' + name);
  }

  const station = list[0];
  if (!station.id) {
    throw new Error('Station hat keine ID: ' + name);
  }

  const enrichedStation = {
    ...station,
    normalizedName: normalizeIfUpper(station.name || '')
  };

  return enrichedStation;
}

function doBuildDeparturesView(
  transportLabels,
  transportCssTypeAppendices,
  stationName,
  departures
) {
  function translateProduct(product) {
    return transportLabels[product] || product || '';
  }

  function mapType(transportCssTypeAppendices, product) {
    return transportCssTypeAppendices[product] || 'other';
  }

  function formatLine(productGerman, raw) {
    if (!raw) {
      return productGerman;
    }
    const cleaned = raw
      .replace(/^STR\s*/i, '')
      .replace(/^BUS\s*/i, '')
      .replace(/^TRAM\s*/i, '')
      .replace(/^SUBWAY\s*/i, '')
      .replace(/^SUBURBAN\s*/i, '');
    const alreadyHasProduct = cleaned.toLowerCase().startsWith(productGerman.toLowerCase());
    if (alreadyHasProduct) {
      return cleaned;
    }
    if (/^\d+/.test(cleaned)) {
      return `${productGerman} ${cleaned}`;
    }
    if (/^[SU]\s*\d+/i.test(cleaned)) {
      return cleaned;
    }
    return `${productGerman} ${cleaned}`;
  }

  const items = departures.map(departure => {
    const plannedWhen = departure.plannedWhen;
    const plannedTime = plannedWhen ? new Date(plannedWhen) : null;
    const actualWhen = departure.when;
    const actualTime = actualWhen ? new Date(actualWhen) : null;
    const delay = departure.delay !== null ? Math.round(departure.delay / 60) : 0;
    const line = departure.line || {};
    const productRaw = line.product || line.mode || '';
    const productGerman = translateProduct(productRaw);
    const type = mapType(transportCssTypeAppendices, productRaw);
    const lineName = line.name || line.label || line.id || '';
    const lineText = formatLine(productGerman, lineName);

    return {
      time: plannedTime || '–',
      actualTime: actualTime || '–',
      delay,
      direction: departure.direction || '',
      lineText,
      platform: departure.platform || departure.plannedPlatform || '',
      type,
      rawWhen: actualWhen || plannedWhen
    };
  });

  const validTimes = items
    .map(i => i.rawWhen)
    .filter(Boolean)
    .map(w => new Date(w))
    .sort((a, b) => a - b);

  let earlierIso = null;
  let laterIso = null;

  if (validTimes.length > 0) {
    const first = validTimes[0];
    const last = validTimes[validTimes.length - 1];
    const halfHour = 30 * 60 * 1000;
    earlierIso = new Date(first.getTime() - halfHour).toISOString();
    laterIso = new Date(last.getTime() + halfHour).toISOString();
  }

  const cleanedItems = items.map(({ rawWhen: _, ...rest }) => rest);

  return {
    stationName,
    departures: cleanedItems,
    earlierIso,
    laterIso
  };
}

async function fetchDeparturesUntilFound(client, stationId, initialWhen) {
  let whenDate = initialWhen ? new Date(initialWhen) : new Date();
  if (Number.isNaN(whenDate.getTime())) {
    whenDate = new Date();
  }

  const stepMinutes = 15;
  let remainingTries = 48;
  const baseOpts = { duration: 60, results: 10 };

  while (remainingTries-- > 0) {
    const opts = { ...baseOpts, when: whenDate };

    const data = await client.departures(stationId, opts);

    const departures = Array.isArray(data?.departures)
      ? data.departures
      : Array.isArray(data)
        ? data
        : [];

    if (departures.length > 0) {
      return { departures, usedWhen: whenDate };
    }

    whenDate = new Date(whenDate.getTime() + stepMinutes * 60_000);
  }

  return { departures: [], usedWhen: whenDate };
}

export async function buildDeparturesView(
  client,
  transportLabels,
  transportCssTypeAppendices,
  stationNameInput,
  when
) {
  const station = await findStation(client, stationNameInput);
  const stationId = station.id;
  const displayName = station.normalizedName || station.name || stationNameInput;

  const { departures } = await fetchDeparturesUntilFound(client, stationId, when);

  return doBuildDeparturesView(
    transportLabels,
    transportCssTypeAppendices,
    displayName,
    departures
  );
}

export async function fetchJourneys(client, fromId, toId, options) {
  const journeys = await client.journeys(fromId, toId, options);
  return journeys;
}
