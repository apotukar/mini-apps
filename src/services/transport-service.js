import { filterByRadius } from '../lib/geo/geo-radius.js';

export class TransportService {
  constructor(getClientFn, config) {
    this._getClient = getClientFn;

    this.config = {
      departures: {
        earlierOffset: 60 * 60 * 1000,
        laterOffset: 0
      },
      ...config
    };

    if (this.config.transportCssTypeAppendices === null) {
      throw new Error('config.transportCssTypeAppendices is required');
    }

    if (this.config.transportLabels === null) {
      throw new Error('config.transportLabels is required');
    }
  }

  async init() {
    if (!this.client) {
      this.client = await this._getClient();
    }
  }

  async findStation(name, { allowLocations = false } = {}) {
    const stations = await this.client.locations(name, {
      results: 1,
      stops: true,
      addresses: allowLocations,
      poi: allowLocations
    });
    if (!stations || stations.length === 0) {
      throw new Error('Station nicht gefunden: ' + name);
    }

    const station = stations[0];
    const isLocation = allowLocations && station.type === 'location';
    if (isLocation) {
      const location = station.location ?? station;
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        throw new Error('Ort hat keine gültigen Koordinaten: ' + name);
      }
    } else if (!station.id) {
      throw new Error('Station hat keine ID: ' + name);
    }

    return {
      ...station,
      ...(isLocation ? { searchByCoordinates: true } : {}),
      normalizedName: isLocation ? name : this.#normalizeIfUpper(station.name || '')
    };
  }

  async fetchDeparturesUntilFound(station, initialWhen, maxResults = 10, radius = 0.3) {
    let whenDate = initialWhen ? new Date(initialWhen) : new Date();
    if (Number.isNaN(whenDate.getTime())) {
      whenDate = new Date();
    }

    const duration = 30;
    const windowMs = duration * 60_000;
    let remainingTries = 12;
    const baseOpts = {
      duration,
      // Limit only after radius filtering, not in the client response parser.
      results: null,
      radius: radius * 1000
    };

    const departures = [];
    const seen = new Set();

    const location = station.location ?? station;
    const center =
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
        ? { lat: location.latitude, lon: location.longitude }
        : null;

    // Geocoder IDs for addresses and POIs are not transit stop IDs.
    const useCoordinates = station.searchByCoordinates === true;
    if (useCoordinates && !center) {
      throw new Error('Ort hat keine gültigen Koordinaten');
    }
    const departureId = useCoordinates ? `${center.lat},${center.lon}` : station.id;
    if (useCoordinates) {
      baseOpts.center = departureId;
    }

    while (remainingTries-- > 0 && departures.length < maxResults) {
      const windowStart = whenDate.getTime();
      const windowEnd = windowStart + windowMs;
      const opts = { ...baseOpts, when: whenDate };
      const data = await this.client.departures(departureId, opts);
      let batch = Array.isArray(data?.departures) ? data.departures : [];

      if (center) {
        batch = this.#filterDeparturesByRadius(batch, center, radius);
      }

      for (const departure of batch) {
        const time = new Date(departure.when || departure.plannedWhen).getTime();
        // Half-open windows avoid duplicates and gaps at their boundaries.
        if (!Number.isFinite(time) || time < windowStart || time >= windowEnd) {
          continue;
        }
        const key = JSON.stringify([
          departure.tripId,
          departure.stop?.id || departure.stop?.name,
          departure.plannedWhen || departure.when,
          departure.line?.id || departure.line?.name,
          departure.direction
        ]);
        if (!seen.has(key)) {
          seen.add(key);
          departures.push(departure);
        }
      }

      whenDate = new Date(windowEnd);
    }

    departures.sort(
      (a, b) => new Date(a.when || a.plannedWhen) - new Date(b.when || b.plannedWhen)
    );
    const selectedDepartures = departures.slice(0, maxResults);

    return {
      departures: selectedDepartures,
      stationNames: [...new Set(selectedDepartures.map(departure => departure.stop.name))]
    };
  }

  async fetchJourneys(from, to, options) {
    return this.client.journeys(from, to, options);
  }

  #filterDeparturesByRadius(departures, center, radiusKm) {
    const points = departures
      .map(departure => {
        const loc = departure?.stop?.location;
        if (!loc) {
          return null;
        }

        return {
          lat: loc.latitude,
          lon: loc.longitude,
          item: departure
        };
      })
      .filter(Boolean);

    return filterByRadius(center, points, radiusKm).map(p => p.item);
  }

  buildDeparturesView(departures) {
    const that = this;

    function translateProduct(product) {
      return that.config.transportLabels[product] || product || '';
    }

    function mapType(transportCssTypeAppendices, product) {
      return that.config.transportCssTypeAppendices[product] || 'other';
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
      const type = mapType(that.config.transportCssTypeAppendices, productRaw);
      const lineName = line.name || line.label || line.id || '';
      const lineText = formatLine(productGerman, lineName);
      const stationName = departure.stop?.name || '';

      return {
        time: plannedTime ?? actualTime,
        actualTime: actualTime ?? plannedTime,
        delay,
        direction: departure.direction || '',
        lineText,
        platform: departure.platform || departure.plannedPlatform || '',
        type,
        rawWhen: actualWhen || plannedWhen,
        stationName
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
      earlierIso = new Date(first.getTime() - this.config.departures.earlierOffset).toISOString();
      laterIso = new Date(last.getTime() + this.config.departures.laterOffset).toISOString();
    }

    const cleanedItems = items.map(({ rawWhen: _, ...rest }) => rest);

    return {
      departures: cleanedItems,
      earlierIso,
      laterIso
    };
  }

  buildJourneyView(legs, index) {
    if (!legs.length) {
      return null;
    }

    const firstLeg = legs[0];
    const lastLeg = legs[legs.length - 1];

    const depPlanned = this.#parseTime(firstLeg.plannedDeparture);
    const dep = this.#parseTime(firstLeg.departure) ?? depPlanned;
    const depDelayMin =
      firstLeg.departureDelay !== null ? Math.round(firstLeg.departureDelay / 60) : 0;
    const arrPlanned = this.#parseTime(lastLeg.plannedArrival);
    const arr = this.#parseTime(lastLeg.arrival) ?? arrPlanned;
    const arrDelayMin =
      legs.length > 1
        ? lastLeg.arrivalDelay !== null
          ? Math.round(lastLeg.arrivalDelay / 60)
          : 0
        : null;

    const durationMinutes = dep && arr ? ((arr - dep) / 60000).toFixed(0) : null;
    const transfers = Math.max(0, legs.length - 1);

    const legsView = legs.map((leg, idx) => {
      const depPlanned = this.#parseTime(leg.plannedDeparture);
      const dep = this.#parseTime(leg.departure) ?? depPlanned;
      const depDelayMin = leg.departureDelay !== null ? Math.round(leg.departureDelay / 60) : 0;
      const arrPlanned = this.#parseTime(leg.plannedArrival);
      const arr = this.#parseTime(leg.arrival) ?? arrPlanned;
      const arrDelayMin = leg.arrivalDelay !== null ? Math.round(leg.arrivalDelay / 60) : 0;
      const line = leg.line || {};
      const productKey = line.product || line.mode || '';
      const product = this.config.transportLabels[productKey] || productKey;
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
        depPlannedTime: depPlanned ?? dep,
        depDelayMin,
        depPlatform: leg.departurePlatform || null,
        depPlatformPlanned: leg.plannedDeparturePlatform || null,

        arrTime: arr,
        arrPlannedTime: arrPlanned ?? arr,
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
      plannedDeparture: depPlanned ?? dep,
      departureDelayMin: depDelayMin,
      arrival: arr,
      plannedArrival: arrPlanned ?? arr,
      arrivalDelayMin: arrDelayMin,
      duration: durationMinutes,
      transfers,
      legs: legsView
    };
  }

  #parseTime(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  #normalizeIfUpper(word) {
    if (word === word.toUpperCase()) {
      return word.charAt(0) + word.slice(1).toLowerCase();
    }
    return word;
  }
}
