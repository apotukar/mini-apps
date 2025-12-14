export function registerTrackRoutes(app, params) {
  const route = params.route;

  app.get('/track', async (req, res) => {
    const query = req.query.q || '';
    const trackingNumber = query.trim();
    const viewExt = res.locals.viewExt || '';
    const indexPage = `track/index.${viewExt}`;
    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    let trackingNumbers = (await favsManager.getFavorites(req)) || [];

    if (!trackingNumber) {
      res.render(indexPage, {
        query,
        error: null,
        shipment: null,
        history: trackingNumbers
      });
      return;
    }

    try {
      const trackService = req.services.get('trackService');
      const shipment = await trackService.dhlFetchShipment(trackingNumber);

      if (!shipment) {
        res.render(indexPage, {
          query,
          error: 'Keine Sendung gefunden.',
          shipment: null,
          history: trackingNumbers
        });
        return;
      }

      trackingNumbers = favsManager.dedupeFavs([...trackingNumbers, trackingNumber]);
      await favsManager.saveFavorites(res, trackingNumbers);
      res.render(indexPage, {
        query,
        error: null,
        shipment,
        history: trackingNumbers
      });
    } catch (error) {
      console.error('Error fetching shipment:', error);

      res.render(indexPage, {
        query,
        error: 'Fehler beim Abruf der DHL-Daten.',
        shipment: null,
        history: trackingNumbers
      });
    }
  });

  app.get('/track/delete', async (req, res) => {
    const query = req.query.q?.trim() || null;
    const del = req.query.d?.trim() || null;

    const redirectPage = query ? `/track?q=${encodeURIComponent(query)}` : '/track';
    if (del === null) {
      return res.redirect(redirectPage);
    }

    const favsManager = req.services.get(`favoritesManager.${route.name}`);
    const trackingNumbers = ((await favsManager.getFavorites(req)) || []).filter(
      item => item !== del
    );

    await favsManager.saveFavorites(res, trackingNumbers);
    if (query !== null && query === del) {
      return res.redirect('/track');
    }

    return res.redirect(redirectPage);
  });
}
