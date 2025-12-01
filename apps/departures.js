import {
  getFavorites,
  saveFavorites,
  clearFavorites,
  getHideFlag,
  clearHideFlag,
  dedupeFavs,
  setHideFlag
} from '../helpers/favorites.js';

import { buildDeparturesView, findStation } from '../helpers/transport-service.js';

export function registerDepartureRoutes(app, params) {
  const client = params.client;
  const config = params.config || {};
  const transportLabels = config.transportLabels || {};
  const transportCssTypeAppendices = config.transportCssTypeAppendices || {};
  const favoritesNamespace = 'departures';
  const configFavorites = Object.values(config.favorites).flat() || [];
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
      const station = await findStation(client, rawStationName);
      stationName = station.normalizedName;
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

  function handleDeparturesSearch(getStationName, getWhen) {
    return async (req, res) => {
      try {
        const inputName = (getStationName(req) || '').trim();
        if (!inputName) {
          return res.redirect('/departures');
        }

        // TODO: render error page if there is no station
        // const station = await findStation(client, inputName);
        // const stationId = station.id;
        // const displayName = station.normalizedName || station.name || stationNameInput;

        const when = getWhen ? getWhen(req) : undefined;
        const view = await buildDeparturesView(
          client,
          transportLabels,
          transportCssTypeAppendices,
          inputName,
          when
        );

        if (!view || !view.departures || view.departures.length === 0) {
          return res.render('departures/no-results.njk', {
            stationName: view?.stationName || inputName
          });
        }

        view.departures.sort((a, b) => a.actualTime - b.actualTime);

        return res.render('departures/results.njk', view);
      } catch (err) {
        return res.render('departures/error.njk', { message: err.message });
      }
    };
  }
}
