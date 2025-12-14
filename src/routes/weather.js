export function registerWeatherRoutes(app, params) {
  const config = params.config || {};
  const route = params.route || {};
  const configFavorites = Array.isArray(config.favorites) ? config.favorites : [];

  app.get('/weather', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    let favorites = await favsManager.getFavorites(req);
    if (!(await favsManager.getHideFlag(req))) {
      favorites = favsManager.dedupeFavs([...favorites, ...configFavorites]);
      await favsManager.saveFavorites(res, favorites);
      await favsManager.setHideFlag(res);
    }

    const city = (req.query.city || '').trim();
    const viewExt = res.locals.viewExt || '';

    res.render(`weather/index.${viewExt}`, {
      city,
      favs: favorites,
      title: route.title,
      headline: route.headline
    });
  });

  app.post('/weather/save-fav', async (req, res) => {
    const city = (req.body.city || '').trim();
    if (!city) {
      return res.redirect('/weather');
    }

    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    let favorites = await favsManager.getFavorites(req);
    favorites = favsManager.dedupeFavs([city, ...favorites]);
    await favsManager.saveFavorites(res, favorites);

    return res.redirect(`/weather?station=${encodeURIComponent(city)}`);
  });

  app.get('/weather/clear-favs', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    await favsManager.clearFavorites(res);
    return res.redirect('/weather');
  });

  app.get('/weather/show-config-favs', async (req, res) => {
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    await favsManager.clearHideFlag(res);
    return res.redirect('/weather');
  });

  app.get('/weather/search', async (req, res) => {
    const city = (req.query.city || '').trim();
    await handleWeatherSearch(req, res, city);
  });

  app.post('/weather/search', async (req, res) => {
    const city = (req.body?.city || '').trim();
    await handleWeatherSearch(req, res, city);
  });

  async function handleWeatherSearch(req, res, city) {
    try {
      if (!city) {
        return res.render('weather/error.njk', {
          message: 'Bitte einen Ort eingeben.',
          title: route.title,
          headline: route.headline
        });
      }

      const weatherService = req.services.get('weatherService');
      const { locationTitle, current, days } = await weatherService.fetchWeather(city);

      res.render('weather/results.njk', {
        locationTitle,
        city,
        current,
        days,
        title: route.title,
        headline: route.headline
      });
    } catch (err) {
      res.render('weather/error.njk', {
        message: err.isKnown ? err.message : 'Ein unbekannter Fehler ist aufgetreten.',
        title: route.title,
        headline: route.headline
      });
    }
  }
}
