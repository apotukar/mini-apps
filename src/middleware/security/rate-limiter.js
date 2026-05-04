import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'crypto';

export function rateLimiter(config = {}) {
  const windowMinutes = config.windowMinutes ?? 1;
  const max = config.max ?? 6;

  const exclude = (
    config.exclude ?? ['css', 'js', 'gif', 'png', 'jpg', 'jpeg', 'svg', 'webp', 'ico', 'ttf']
  ).map(e => e.toLowerCase());

  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: req => {
      const ip = ipKeyGenerator(req.ip);
      const path = (req.path || '').toLowerCase().replace(/\/+$/, '');
      const entries = Object.entries(req.query).sort(([a], [b]) => a.localeCompare(b));
      const queryString = entries.map(([k, v]) => `${k}=${v}`).join('&');
      const hash = crypto.createHash('sha1').update(queryString).digest('hex');

      return `${ip}:${path}:${hash}`;
    },

    skip: req => {
      const path = (req.path || '').split('?')[0].toLowerCase();
      const extMatch = path.match(/\.([a-z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : '';
      const isExcluded = exclude.includes(ext);
      if (!isExcluded) {
        return false;
      }

      const accept = req.headers.accept || '';
      const isAssetRequest = !accept.includes('text/html');
      return isAssetRequest;
    },

    handler: (req, res) => {
      res.status(429).send('Too many requests');
    }
  });
}
