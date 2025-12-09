export class WeatherService {
  constructor(config = {}) {
    this.config = {
      ...config
    };
  }

  async fetchWeather(city) {
    const geoResp = await fetch(this.#getGeoUrl(city));
    if (!geoResp.ok) {
      const error = new Error('Geocoding-Anfrage fehlgeschlagen.');
      error.isKnown = true;
      throw error;
    }
    console.log('Geocoding-Anfrage erfolgreich.', geoResp);

    const geo = await geoResp.json();
    if (!geo.results || geo.results.length === 0) {
      const error = new Error(`Kein Ort gefunden für: "${city}".`);
      error.isKnown = true;
      throw error;
    }

    const place = geo.results[0];
    const lat = place.latitude;
    const lon = place.longitude;
    const locationTitle = [place.name, place.admin1, place.country].filter(Boolean).join(', ');

    const forecastUrl = this.#getForecastUrl(lat, lon);

    const fcResp = await fetch(forecastUrl);
    if (!fcResp.ok) {
      const error = new Error('Wetterdaten-Anfrage fehlgeschlagen.');
      error.isKnown = true;
      throw error;
    }

    const fc = await fcResp.json();
    const cw = fc.current_weather || {};

    const current = {
      temperature: cw.temperature,
      windspeed: cw.windspeed,
      code: cw.weathercode,
      description: this.#describeWeatherCode(cw.weathercode),
      time: cw.time
    };

    const daily = fc.daily || {};
    const days = (daily.time || []).map((dateStr, i) => ({
      time: dateStr,
      tMin: daily.temperature_2m_min?.[i],
      tMax: daily.temperature_2m_max?.[i],
      code: daily.weathercode?.[i],
      description: this.#describeWeatherCode(daily.weathercode?.[i])
    }));

    return {
      locationTitle,
      current,
      days
    };
  }

  #getGeoUrl(city) {
    return `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`;
  }

  #getForecastUrl(lat, lon) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;
  }

  #describeWeatherCode(code) {
    const map = this.config.descriptions || {};
    return map[String(code)] || `Unbekannt (${code})`;
  }
}
