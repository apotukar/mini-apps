import { searchPOIs } from '../services/poi-service.js';
import { PoiEmergencyPharmacyService } from '../services/poi-emergency-pharmacy-service.js';
import { geocodePlace } from '../lib/geo/geocode.js';
import { generateStaticMap } from '../lib/geo/map-generator.js';

export function registerPOIRoutes(app, params) {
  const config = params.config;
  const zoom = config.zoom || 15;
  const tiles = config.tiles || 3;
  const reverseGeocodingKey = config.reverseGeocodingKey || '';
  const types = config.types || {};
  const dropdownMap = Object.fromEntries(
    Object.entries(types)
      .map(([key, value]) => [key, value.label])
      .sort((a, b) => a[1].localeCompare(b[1]))
  );

  const emergencyPharmacyService = new PoiEmergencyPharmacyService({
    cacheDir: config.emergencyPharmaciesCacheDir
  });

  app.get('/pois', async (req, res) => {
    const query = req.query.q || '';
    const type = req.query.t || 'pharmacy';
    const radiusInKilometers = parseFloat(req.query.r) || 1.5;
    const radiusInMeters = radiusInKilometers * 1000;
    const viewExt = res.locals.viewExt || '';
    const indexPage = `pois/index.${viewExt}`;

    if (!query) {
      return res.render(indexPage, {
        results: [],
        query: '',
        types: dropdownMap,
        type: type,
        radius: radiusInKilometers,
        location: null
      });
    }

    try {
      const loc = await geocodePlace(query);
      if (!loc) {
        return res.render(indexPage, {
          results: [],
          query: query,
          types: dropdownMap,
          type: type,
          radius: radiusInKilometers,
          location: null
        });
      }

      let results = [];
      if (type === 'emergency_pharmacy') {
        results = await emergencyPharmacyService.getEmergencyPharmacies(loc.postcode);
      } else {
        results = await searchPOIs(types, type, loc, radiusInMeters, reverseGeocodingKey);
      }

      const resultsWithMap = results.map(result => ({
        ...result,
        mapUrl:
          result.lat !== null && result.lon !== null
            ? `/pois/map?lat=${result.lat}&lon=${result.lon}`
            : null
      }));

      res.render(indexPage, {
        results: resultsWithMap,
        query: query,
        types: dropdownMap,
        type: type,
        radius: radiusInKilometers,
        location: loc
      });
    } catch (err) {
      console.error(err);
      res.render(indexPage, {
        results: [],
        query: query,
        types: dropdownMap,
        type: type,
        radius: radiusInKilometers,
        location: null
      });
    }
  });

  app.get('/pois/map', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).send('invalid');
    }
    try {
      const buf = await generateStaticMap(lat, lon, zoom, tiles);
      res.setHeader('Content-Type', 'image/png');
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).send('error');
    }
  });
}
