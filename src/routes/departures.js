import { FavoritesManager } from '../lib/favs/favorites.js';

export function registerDeparturesRoutes(app, params = {}) {
  const config = params.config || {};
  const route = params.route || {};
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
      favs: favorites,
      title: route.title,
      headline: route.headline
    });
  });

  app.post('/departures/save-fav', async (req, res) => {
    const rawStationName = (req.body.station || '').trim();
    if (!rawStationName) {
      return res.redirect('/departures');
    }

    let stationName = rawStationName;

    if (configSaveNormalizedFavName) {
      const transportService = req.services.get('transportService');
      const station = await transportService.findStation(rawStationName);
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

        const when = getWhen ? getWhen(req) : undefined;
        const transportService = req.services.get('transportService');
        const station = await transportService.findStation(inputName);
        const stationId = station.id;
        const displayName = station.normalizedName || station.name || inputName;
        const { departures } = await transportService.fetchDeparturesUntilFound(stationId, when);

        const view = transportService.buildDeparturesView(
          transportLabels,
          transportCssTypeAppendices,
          displayName,
          departures
        );

        if (!view || !view.departures || view.departures.length === 0) {
          return res.render('departures/no-results.njk', {
            stationName: view?.stationName || inputName,
            title: route.title,
            headline: route.headline
          });
        }

        view.departures.sort((a, b) => a.actualTime - b.actualTime);
        const actualView = {
          title: route.title,
          headline: route.headline,
          ...view
        };

        return res.render('departures/results.njk', actualView);
      } catch (err) {
        console.error(err);
        return res.render('departures/error.njk', {
          message: err.message,
          title: route.title,
          headline: route.headline
        });
      }
    };
  }
}
