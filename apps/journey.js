import {
  getFavorites,
  saveFavorites,
  clearFavorites,
  getHideFlag,
  setHideFlag,
  clearHideFlag,
  dedupeFavs
} from '../helpers/favorites.js';

import { buildJourneyView } from '../helpers/journey-view-builder.js';

export function registerJourneyRoutes(app, params) {
  const client = params.client;
  const config = params.config || {};
  const transportLabels = config.transportLabels || {};
  const favoritesNamespace = 'journey';
  const configFavorites = Array.isArray(config.favorites) ? config.favorites : [];
  const configSaveNormalizedFavName = config.saveNormalizedFavName || false;

  app.get(
    '/journey',
    (req, res, next) => {
      if (req.query.swap === 'true') {
        const from = req.query.to?.trim() || '';
        const to = req.query.from?.trim() || '';
        return res.redirect(
          `/journey?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
      }
      next();
    },
    (req, res) => {
      let favorites = getFavorites(req, favoritesNamespace);
      if (!getHideFlag(req, favoritesNamespace)) {
        favorites = dedupeFavs([...favorites, ...configFavorites]);
        saveFavorites(res, favorites, favoritesNamespace);
        setHideFlag(res, favoritesNamespace);
      }

      const from = req.query.from || '';
      const to = req.query.to || '';

      res.render('journey/index.njk', {
        from,
        to,
        favs: favorites
      });
    }
  );

  app.post('/journey/save-fav', async (req, res) => {
    try {
      const rawFromName = (req.body.from || '').trim();
      const rawToName = (req.body.to || '').trim();
      if (!rawFromName && !rawToName) {
        return res.redirect('/journey');
      }

      let fromName = rawFromName;
      let toName = rawToName;

      if (configSaveNormalizedFavName) {
        const fromId = await findStationId(client, rawFromName);
        const toId = await findStationId(client, rawToName);
        const options = { results: 1 };

        const data = await client.journeys(fromId, toId, options);
        const journeys = data.journeys || [];

        if (journeys.length > 0) {
          ({ fromName, toName } = normalizeJourneyNames(journeys, rawFromName, rawToName));
        }
      }

      const favorites = dedupeFavs([
        { from: fromName, to: toName },
        ...getFavorites(req, favoritesNamespace)
      ]);

      saveFavorites(res, favorites, favoritesNamespace);

      res.redirect(
        `/journey?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`
      );
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  app.get('/journey/clear-favs', (req, res) => {
    clearFavorites(res, favoritesNamespace);
    res.redirect('/journey');
  });

  app.get('/journey/show-config-favs', (req, res) => {
    clearHideFlag(res, favoritesNamespace);
    res.redirect('/journey');
  });

  app.post(
    '/journey/search',
    createJourneyHandler(req => ({
      fromName: req.body.from,
      toName: req.body.to,
      transportLabels: transportLabels
    }))
  );

  app.get(
    '/journey/search',
    createJourneyHandler(req => ({
      fromName: req.query.from,
      toName: req.query.to,
      departure: req.query.departure || null,
      earlierThan: (req.query.earlierThan || '').trim() || null,
      laterThan: (req.query.laterThan || '').trim() || null,
      transportLabels: transportLabels
    }))
  );

  function createJourneyHandler(params) {
    return async (req, res) => {
      const {
        fromName,
        toName,
        departure = null,
        earlierThan = null,
        laterThan = null
      } = params(req);

      await handleJourneySearch({
        res,
        client,
        fromName: (fromName || '').trim(),
        toName: (toName || '').trim(),
        departure,
        earlierThan,
        laterThan,
        transportLabels
      });
    };
  }
}

async function findStationId(client, name) {
  const list = await client.locations(name, { results: 1 });
  if (!list || list.length === 0) {
    throw new Error('Station nicht gefunden: ' + name);
  }
  return list[0].id;
}

async function handleJourneySearch({
  res,
  client,
  fromName: rawFromName,
  toName: rawToName,
  departure,
  earlierThan,
  laterThan,
  transportLabels
}) {
  try {
    if (!rawFromName || !rawToName) {
      return res.redirect('/journey');
    }

    const fromId = await findStationId(client, rawFromName);
    const toId = await findStationId(client, rawToName);

    const options = { results: 5 };

    if (earlierThan) {
      options.earlierThan = earlierThan;
    } else if (laterThan) {
      options.laterThan = laterThan;
    } else if (departure) {
      options.departure = departure;
    }

    const data = await client.journeys(fromId, toId, options);
    const journeys = data.journeys || [];

    if (!journeys.length) {
      return res.render('journey/no-results.njk', {
        fromName: rawFromName,
        toName: rawToName
      });
    }

    const { fromName, toName } = normalizeJourneyNames(journeys, rawFromName, rawToName);

    const journeysView = journeys
      .map((journey, i) => buildJourneyView(journey.legs || [], i, transportLabels))
      .filter(Boolean);

    return res.render('journey/results.njk', {
      fromName,
      toName,
      journeys: journeysView,
      earlierRef: data.earlierRef || null,
      laterRef: data.laterRef || null
    });
  } catch (err) {
    return res.render('journey/error.njk', {
      message: err.message
    });
  }
}

function normalizeJourneyNames(journeys, rawFromName, rawToName) {
  const journey = journeys?.[0];
  const legs = journey?.legs ?? [];

  const fromName = legs?.[0]?.origin?.name ?? rawFromName;
  const toName = legs?.[legs.length - 1]?.destination?.name ?? rawToName;

  return {
    fromName,
    toName
  };
}
