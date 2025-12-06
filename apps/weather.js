import { FavoritesManager } from '../helpers/favs/favorites.js';

export function registerWeatherRoutes(app, params) {
  const config = params.config || {};
  const favoritesNamespace = 'weather';
  const favsManager = new FavoritesManager(favoritesNamespace);
  const configFavorites = Array.isArray(config.favorites) ? config.favorites : [];

  app.get('/weather', async (req, res) => {
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
      favs: favorites
    });
  });

  app.post('/weather/save-fav', async (req, res) => {
    const city = (req.body.city || '').trim();
    if (!city) {
      return res.redirect('/weather');
    }

    let favorites = await favsManager.getFavorites(req);
    favorites = favsManager.dedupeFavs([city, ...favorites]);
    await favsManager.saveFavorites(res, favorites);

    return res.redirect(`/weather?station=${encodeURIComponent(city)}`);
  });

  app.get('/weather/clear-favs', async (req, res) => {
    await favsManager.clearFavorites(res);
    return res.redirect('/weather');
  });

  app.get('/weather/show-config-favs', async (req, res) => {
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
          message: 'Bitte einen Ort eingeben.'
        });
      }

      const geoUrl =
        'https://geocoding-api.open-meteo.com/v1/search' +
        `?name=${encodeURIComponent(city)}` +
        '&count=1&language=de&format=json';

      const geoResp = await fetch(geoUrl);
      if (!geoResp.ok) {
        throw new Error('Geocoding-Anfrage fehlgeschlagen.');
      }

      const geo = await geoResp.json();
      if (!geo.results || geo.results.length === 0) {
        return res.render('weather/error.njk', {
          message: `Kein Ort gefunden für: "${city}".`
        });
      }

      const place = geo.results[0];
      const lat = place.latitude;
      const lon = place.longitude;
      const locationTitle = [place.name, place.admin1, place.country].filter(Boolean).join(', ');

      const forecastUrl =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&current_weather=true' +
        '&daily=weathercode,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto';

      const fcResp = await fetch(forecastUrl);
      if (!fcResp.ok) {
        throw new Error('Wetterdaten-Anfrage fehlgeschlagen.');
      }

      const fc = await fcResp.json();
      const cw = fc.current_weather || {};

      const current = {
        temperature: cw.temperature,
        windspeed: cw.windspeed,
        code: cw.weathercode,
        description: describeWeatherCode(cw.weathercode),
        time: cw.time
      };

      const daily = fc.daily || {};
      const days = (daily.time || []).map((dateStr, i) => ({
        time: dateStr,
        tMin: daily.temperature_2m_min?.[i],
        tMax: daily.temperature_2m_max?.[i],
        code: daily.weathercode?.[i],
        description: describeWeatherCode(daily.weathercode?.[i])
      }));

      res.render('weather/results.njk', {
        locationTitle,
        city,
        current,
        days
      });
    } catch (err) {
      res.render('weather/error.njk', {
        message: err.message || 'Fehler.'
      });
    }
  }

  function describeWeatherCode(code) {
    const map = config.descriptions || {};
    return map[String(code)] || `Unbekannt (${code})`;
  }
}
