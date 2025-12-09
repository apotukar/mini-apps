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
      const geocodePlace = req.services.get('geocodePlace');
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
        const emergencyPharmacyService = req.services.get('poiEmergencyPharmacyService');
        results = await emergencyPharmacyService.getEmergencyPharmacies(loc.postcode);
      } else {
        const poiService = req.services.get('poiService');
        results = await poiService.searchPOIs(
          types,
          type,
          loc,
          radiusInMeters,
          reverseGeocodingKey
        );
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
      const generateStaticMap = req.services.get('generateStaticMap');
      const buf = await generateStaticMap(lat, lon, zoom, tiles);
      res.setHeader('Content-Type', 'image/png');
      res.send(buf);
    } catch (err) {
      console.error(err);
      res.status(500).send('error');
    }
  });
}
