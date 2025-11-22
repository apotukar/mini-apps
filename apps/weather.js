export function registerWeatherRoutes(app, params) {
  const config = params.config

  app.get('/weather', (req, res) => {
    const city = (req.query.city || '').trim()
    res.render('weather/index.njk', {
      city
      // favorites: config.favoriteWeatherCities || []
    })
  })

  app.post('/weather/search', async (req, res) => {
    try {
      const city = (req.body?.city || '').trim()
      if (!city) {
        return res.render('weather/error.njk', { message: 'Bitte einen Ort eingeben.' })
      }

      const geoUrl =
        'https://geocoding-api.open-meteo.com/v1/search' +
        `?name=${encodeURIComponent(city)}` +
        '&count=1&language=de&format=json'

      const geoResp = await fetch(geoUrl)
      if (!geoResp.ok) throw new Error('Geocoding-Anfrage fehlgeschlagen.')

      const geo = await geoResp.json()
      if (!geo.results || geo.results.length === 0) {
        return res.render('weather/error.njk', { message: `Kein Ort gefunden für: "${city}".` })
      }

      const place = geo.results[0]
      const lat = place.latitude
      const lon = place.longitude
      const locationTitle = [place.name, place.admin1, place.country].filter(Boolean).join(', ')

      const forecastUrl =
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&current_weather=true' +
        '&daily=weathercode,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto'

      const fcResp = await fetch(forecastUrl)
      if (!fcResp.ok) throw new Error('Wetterdaten-Anfrage fehlgeschlagen.')
      const fc = await fcResp.json()

      const tz = fc.timezone || 'Europe/Berlin'
      const cw = fc.current_weather || {}

      const current = {
        temperature: cw.temperature,
        windspeed: cw.windspeed,
        code: cw.weathercode,
        description: describeWeatherCode(cw.weathercode),
        timeFormatted: formatDateTime(cw.time, tz)
      }

      const daily = fc.daily || {}
      const days = (daily.time || []).map((dateStr, i) => ({
        label: formatDateLabel(dateStr, tz),
        tMin: daily.temperature_2m_min?.[i],
        tMax: daily.temperature_2m_max?.[i],
        code: daily.weathercode?.[i],
        description: describeWeatherCode(daily.weathercode?.[i])
      }))

      res.render('weather/results.njk', {
        locationTitle,
        city,
        current,
        days
      })
    } catch (err) {
      res.render('weather/error.njk', { message: err.message || 'Fehler.' })
    }
  })

  function describeWeatherCode(code) {
    const map = config.descriptions || {}
    return map[String(code)] || `Unbekannt (${code})`
  }

  function formatDateTime(iso, tz = 'Europe/Berlin') {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('de-DE', {
      timeZone: tz,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDateLabel(isoDate, tz = 'Europe/Berlin') {
    if (!isoDate) return ''
    const d = new Date(isoDate + 'T12:00:00')
    if (Number.isNaN(d.getTime())) return isoDate
    return d.toLocaleDateString('de-DE', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    })
  }
}
