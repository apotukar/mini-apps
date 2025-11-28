import {
  getFavorites,
  saveFavorites,
  clearFavorites,
  getHideFlag,
  clearHideFlag,
  dedupeFavs,
  setHideFlag
} from '../helpers/favorites.js';

export function registerDepartureRoutes(app, params) {
  const client = params.client;
  const config = params.config || {};
  const transportLabels = config.transportLabels || {};
  const transportCssTypeAppendices = config.transportCssTypeAppendices || {};
  const favoritesNamespace = 'departures';
  const configFavorites = Array.isArray(config.favorites) ? config.favorites : [];
  const configSaveNormalizedFavName = config.saveNormalizedFavName || true;

  app.get('/departures', (req, res) => {
    let favorites = getFavorites(req, favoritesNamespace);
    if (!getHideFlag(req, favoritesNamespace)) {
      favorites = dedupeFavs([...favorites, ...configFavorites]);
      saveFavorites(res, favorites, favoritesNamespace);
      setHideFlag(res, favoritesNamespace);
    }

    const station = req.query.station || '';

    res.render('departures/index.njk', {
      station,
      favs: favorites
    });
  });

  app.post('/departures/save-fav', async (req, res) => {
    const rawStationName = (req.body.station || '').trim();
    if (!rawStationName) {
      return res.redirect('/departures');
    }

    let stationName = rawStationName;

    if (configSaveNormalizedFavName) {
      const station = await findStation(rawStationName);
      stationName = station.name;
    }

    let favorites = getFavorites(req, favoritesNamespace);
    favorites = dedupeFavs([stationName, ...favorites]);
    saveFavorites(res, favorites, favoritesNamespace);

    res.redirect(`/departures?station=${encodeURIComponent(stationName)}`);
  });

  app.get('/departures/clear-favs', (req, res) => {
    clearFavorites(res, favoritesNamespace);
    res.redirect('/departures');
  });

  app.get('/departures/show-config-favs', (req, res) => {
    clearHideFlag(res, favoritesNamespace);
    res.redirect('/departures');
  });

  app.get(
    '/departures/search',
    handleDeparturesSearch(
      req => req.query.station,
      req => req.query.when
    )
  );

  app.post(
    '/departures/search',
    handleDeparturesSearch(req => req.body.station)
  );

  async function findStation(name) {
    const list = await client.locations(name, { results: 1 });
    if (!list || list.length === 0) throw new Error('Station nicht gefunden: ' + name);
    const station = list[0];
    if (!station.id) throw new Error('Station hat keine ID: ' + name);
    return station;
  }

  function buildDeparturesView(stationName, departures) {
    function translateProduct(product) {
      return transportLabels[product] || product || '';
    }

    function mapType(product) {
      return transportCssTypeAppendices[product] || 'other';
    }

    function formatLine(productGerman, raw) {
      if (!raw) return productGerman;
      const cleaned = raw
        .replace(/^STR\s*/i, '')
        .replace(/^BUS\s*/i, '')
        .replace(/^TRAM\s*/i, '')
        .replace(/^SUBWAY\s*/i, '')
        .replace(/^SUBURBAN\s*/i, '');
      const alreadyHasProduct = cleaned.toLowerCase().startsWith(productGerman.toLowerCase());
      if (alreadyHasProduct) return cleaned;
      if (/^\d+/.test(cleaned)) return `${productGerman} ${cleaned}`;
      if (/^[SU]\s*\d+/i.test(cleaned)) return cleaned;
      return `${productGerman} ${cleaned}`;
    }

    const items = departures.map(dep => {
      const when = dep.when || dep.plannedWhen;
      const d = when ? new Date(when) : null;
      const line = dep.line || {};
      const productRaw = line.product || line.mode || '';
      const productGerman = translateProduct(productRaw);
      const type = mapType(productRaw);
      const lineName = line.name || line.label || line.id || '';
      const lineText = formatLine(productGerman, lineName);

      return {
        time: d || '–',
        direction: dep.direction || '',
        lineText,
        platform: dep.platform || dep.plannedPlatform || '',
        type,
        rawWhen: when
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

  async function fetchDeparturesUntilFound(stationId, initialWhen) {
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

  async function fetchDeparturesView(stationNameInput, when) {
    const station = await findStation(stationNameInput);
    const stationId = station.id;
    const displayName = station.name || stationNameInput;

    const { departures } = await fetchDeparturesUntilFound(stationId, when);

    return buildDeparturesView(displayName, departures);
  }

  function handleDeparturesSearch(getStationName, getWhen) {
    return async (req, res) => {
      try {
        const inputName = (getStationName(req) || '').trim();
        if (!inputName) return res.redirect('/departures');

        const when = getWhen ? getWhen(req) : undefined;
        const view = await fetchDeparturesView(inputName, when);

        if (!view || !view.departures || view.departures.length === 0) {
          return res.render('departures/no-results.njk', {
            stationName: view?.stationName || inputName
          });
        }

        return res.render('departures/results.njk', view);
      } catch (err) {
        return res.render('departures/error.njk', { message: err.message });
      }
    };
  }
}
