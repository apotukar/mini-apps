export function registerDeparturesRoutes(app, params = {}) {
  const config = params.config || {};
  const route = params.route || {};
  const configFavorites = Object.values(config.favorites).flat() || [];
  const configSaveNormalizedFavName = config.saveNormalizedFavName || true;

  app.get('/departures', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    let favorites = await favsManager.getFavorites(req);
    if (!(await favsManager.getHideFlag(req))) {
      favorites = favsManager.dedupeFavs([...favorites, ...configFavorites]);
      await favsManager.saveFavorites(res, favorites);
      await favsManager.setHideFlag(res);
    }

    const station = req.query.station || '';
    const radius = getRadiusSafe(req.query.radius);
    const viewExt = res.locals.viewExt || '';

    res.render(`departures/index.${viewExt}`, {
      station,
      radius,
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

    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    let favorites = await favsManager.getFavorites(req);
    favorites = favsManager.dedupeFavs([stationName, ...favorites]);
    await favsManager.saveFavorites(res, favorites);

    return res.redirect(`/departures?station=${encodeURIComponent(stationName)}`);
  });

  app.get('/departures/clear-favs', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    await favsManager.clearFavorites(res);
    return res.redirect('/departures');
  });

  app.get('/departures/show-config-favs', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    await favsManager.clearHideFlag(res);
    return res.redirect('/departures');
  });

  app.get(
    '/departures/search',
    handleDeparturesSearch(
      req => req.query.station,
      req => req.query.radius,
      req => req.query.when
    )
  );

  app.post(
    '/departures/search',
    handleDeparturesSearch(
      req => req.body.station,
      req => req.body.radius
    )
  );

  function handleDeparturesSearch(getStationName, getRadius, getWhen) {
    return async (req, res) => {
      try {
        const inputName = (getStationName(req) || '').trim();
        if (!inputName) {
          return res.redirect('/departures');
        }

        const radius = getRadiusSafe(getRadius(req));

        const when = getWhen ? getWhen(req) : undefined;

        const transportService = req.services.get('transportService');
        const station = await transportService.findStation(inputName);
        const displayName = station.normalizedName || station.name || inputName;
        const { departures, stationNames } = await transportService.fetchDeparturesUntilFound(
          station,
          when,
          5,
          radius
        );

        const view = transportService.buildDeparturesView(departures);

        if (!view || !view.departures || view.departures.length === 0) {
          return res.render('departures/no-results.njk', {
            stationName: inputName,
            title: route.title,
            headline: route.headline
          });
        }

        view.departures.sort((a, b) => a.actualTime - b.actualTime);
        const actualView = {
          stationName: displayName,
          radius,
          title: route.title,
          headline: route.headline,
          stationCount: stationNames.length,
          ...view
        };

        return res.render('departures/results.njk', actualView);
      } catch (err) {
        console.error(err);
        return res.render('departures/error.njk', {
          title: route.title,
          headline: route.headline,
          message: err.message
        });
      }
    };
  }

  function getRadiusSafe(radiusRaw, defaultRadius = 1) {
    const radiusNum = Number((radiusRaw || '').trim());

    return Number.isInteger(radiusNum) && radiusNum > 0 ? radiusNum : defaultRadius;
  }
}
