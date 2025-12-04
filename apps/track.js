import { fetchShipment } from '../helpers/tracking/dhl.js';
import { getFavorites, saveFavorites, dedupeFavs } from '../helpers/favorites.js';

export function registerTrackRoutes(app, params) {
  const config = params.config;
  const favoritesNamespace = 'track';

  app.get('/track', async (req, res) => {
    const query = req.query.q || '';
    const trackingNumber = query.trim();
    const viewExt = res.locals.viewExt || '';
    const indexPage = `track/index.${viewExt}`;
    let trackingNumbers = getFavorites(req, favoritesNamespace) || [];
    console.log('Tracking numbers:', trackingNumbers);

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
      const shipment = await fetchShipment(trackingNumber, {
        apiKey: config.dhl.apiKey,
        service: 'parcel-de',
        requesterCountryCode: 'DE',
        language: 'de'
      });

      if (!shipment) {
        res.render(indexPage, {
          query,
          error: 'Keine Sendung gefunden.',
          shipment: null,
          history: trackingNumbers
        });
        return;
      }

      trackingNumbers = dedupeFavs([...trackingNumbers, trackingNumber]);
      saveFavorites(res, trackingNumbers, favoritesNamespace);
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

    const trackingNumbers = (getFavorites(req, favoritesNamespace) || []).filter(
      item => item !== del
    );

    saveFavorites(res, trackingNumbers, favoritesNamespace);
    if (query !== null && query === del) {
      return res.redirect('/track');
    }

    return res.redirect(redirectPage);
  });
}
