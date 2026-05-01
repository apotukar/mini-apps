import rateLimit from 'express-rate-limit';

export function rateLimiter(config = {}) {
  return rateLimit({
    windowMs: config.windowMs || 10 * 60 * 1000,
    max: config.max || 333,
    standardHeaders: true,
    legacyHeaders: false
  });
}
