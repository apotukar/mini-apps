import { FavoritesManager } from '../helpers/favs/favorites.js';

import { buildJourneyView, findStation, fetchJourneys } from '../helpers/transport-service.js';

export function registerJourneyRoutes(app, params) {
  const client = params.client;
  const config = params.config || {};
  const transportLabels = config.transportLabels || {};
  const favoritesNamespace = 'journey';
  const favsManager = new FavoritesManager(favoritesNamespace);
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
    async (req, res) => {
      let favorites = await favsManager.getFavorites(req);
      if (!(await favsManager.getHideFlag(req))) {
        favorites = favsManager.dedupeFavs([...favorites, ...configFavorites]);
        await favsManager.saveFavorites(res, favorites);
        await favsManager.setHideFlag(res);
      }

      const from = req.query.from || '';
      const to = req.query.to || '';
      const viewExt = res.locals.viewExt || '';

      res.render(`journey/index.${viewExt}`, {
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
        const fromStation = await findStation(client, rawFromName);
        fromName = fromStation.normalizedName;

        const toStation = await findStation(client, rawToName);
        toName = toStation.normalizedName;
      }

      const favorites = favsManager.dedupeFavs([
        { from: fromName, to: toName },
        ...(await favsManager.getFavorites(req))
      ]);

      await favsManager.saveFavorites(res, favorites);

      return res.redirect(
        `/journey?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`
      );
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  });

  app.get('/journey/clear-favs', async (req, res) => {
    await favsManager.clearFavorites(res);
    return res.redirect('/journey');
  });

  app.get('/journey/show-config-favs', async (req, res) => {
    await favsManager.clearHideFlag(res);
    return res.redirect('/journey');
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

    const fromStation = await findStation(client, rawFromName);
    const toStation = await findStation(client, rawToName);
    // TODO: decline nonsensical station input names
    // console.log('stations', fromStation, toStation);
    const options = { results: 5 };

    if (earlierThan) {
      options.earlierThan = earlierThan;
    } else if (laterThan) {
      options.laterThan = laterThan;
    } else if (departure) {
      options.departure = departure;
    }

    const data = await fetchJourneys(client, fromStation, toStation, options);
    const journeys = data.journeys || [];

    if (!journeys.length) {
      return res.render('journey/no-results.njk', {
        fromName: rawFromName,
        toName: rawToName
      });
    }

    const journeysView = journeys
      .map((journey, i) => buildJourneyView(journey.legs || [], i, transportLabels))
      .filter(Boolean);

    return res.render('journey/results.njk', {
      fromName: fromStation.normalizedName,
      toName: toStation.normalizedName,
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
