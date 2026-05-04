export function secureRouteMarker() {
  return function (req, res, next) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

    res.locals.isHttps = isHttps;
    res.locals.currentScheme = isHttps ? 'https' : 'http';

    next();
  };
}
