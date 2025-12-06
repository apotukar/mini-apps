import { FavoritesManager } from '../helpers/favs/favorites.js';
import { buildDeparturesView, findStation } from '../helpers/transport-service.js';

export function registerDepartureRoutes(app, params) {
  const client = params.client;
  const config = params.config || {};
  const transportLabels = config.transportLabels || {};
  const transportCssTypeAppendices = config.transportCssTypeAppendices || {};
  const favoritesNamespace = 'departures';
  const favsManager = new FavoritesManager(favoritesNamespace);
  const configFavorites = Object.values(config.favorites).flat() || [];
  const configSaveNormalizedFavName = config.saveNormalizedFavName || true;

  app.get('/departures', async (req, res) => {
    let favorites = await favsManager.getFavorites(req);
    if (!(await favsManager.getHideFlag(req))) {
      favorites = favsManager.dedupeFavs([...favorites, ...configFavorites]);
      await favsManager.saveFavorites(res, favorites);
      await favsManager.setHideFlag(res);
    }

    const station = req.query.station || '';
    const viewExt = res.locals.viewExt || '';

    res.render(`departures/index.${viewExt}`, {
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

    let favorites = await favsManager.getFavorites(req);
    favorites = favsManager.dedupeFavs([stationName, ...favorites]);
    await favsManager.saveFavorites(res, favorites);

    return res.redirect(`/departures?station=${encodeURIComponent(stationName)}`);
  });

  app.get('/departures/clear-favs', async (req, res) => {
    await favsManager.clearFavorites(res);
    return res.redirect('/departures');
  });

  app.get('/departures/show-config-favs', async (req, res) => {
    await favsManager.clearHideFlag(res);
    return res.redirect('/departures');
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
