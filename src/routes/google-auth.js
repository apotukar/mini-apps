import qrcode from 'qrcode';
import { AppError } from '../errors.js';

export function registerGoogleAuthRoutes(app, { redirectUri, roles = [] }) {
  const view = 'auth/google.njk';
  const callbackPath = new URL(redirectUri).pathname;

  function privatePage(req, res, next) {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    if (!req.session?.user?.username) {
      return res.redirect('/auth/login?redirect=%2Fauth%2Fgoogle');
    }
    const userRoles = req.session.user.roles || [];
    if (roles.length && !userRoles.some(role => role === 'admin' || roles.includes(role))) {
      return res.status(403).send('Kein Zugriff auf Google Tasks.');
    }
    next();
  }

  app.get('/auth/google', privatePage, async (req, res) => {
    try {
      const oauth = req.services.get('googleOAuth');
      let flow = req.session.googleOAuth;
      if (
        !flow ||
        flow.expiresAt <= Date.now() ||
        flow.userName !== req.session.user.username ||
        req.query.restart === '1'
      ) {
        if (flow) {
          await oauth.cancel(flow.state);
        }
        flow = await oauth.begin(req.session.user.username);
        req.session.googleOAuth = flow;
      }
      res.render(view, { authUrl: flow.url });
    } catch (err) {
      res.status(err instanceof AppError ? err.status : 502).render(view, {
        error: err instanceof AppError ? err.message : 'Google-Anmeldung derzeit nicht möglich.'
      });
    }
  });

  app.get('/auth/google/qr.png', privatePage, async (req, res) => {
    const flow = req.session.googleOAuth;
    if (!flow || flow.expiresAt <= Date.now() || flow.userName !== req.session.user.username) {
      return res.status(410).send('QR-Code abgelaufen. Bitte die Verbindungsseite neu laden.');
    }
    try {
      const image = await qrcode.toBuffer(flow.url, { type: 'png', width: 360, margin: 4 });
      res.type('png').send(image);
    } catch {
      res
        .status(500)
        .send('QR-Code konnte nicht erstellt werden. Bitte den Anmeldelink verwenden.');
    }
  });

  // A phone scanning the QR code does not share the initiating browser's session.
  // Only the random, single-use state identifies the target user in this callback.
  app.get(callbackPath, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    try {
      await req.services.get('googleOAuth').complete(req.query);
      res.render(view, { connected: true });
    } catch (err) {
      res.status(err instanceof AppError ? err.status : 502).render(view, {
        error: err instanceof AppError ? err.message : 'Google konnte nicht verbunden werden.'
      });
    }
  });
}
