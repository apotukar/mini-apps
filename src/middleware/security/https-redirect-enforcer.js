export function httpsRedirectEnforcer(config) {
  return function (req, res, next) {
    const routeConfig = config.routes.find(r => req.path.startsWith(r.path));

    if (!routeConfig) {
      return next();
    }

    const shouldForce = routeConfig.forceHttpsRedirect === true;
    const isHttps = res.locals.isHttps === true;

    if (shouldForce && !isHttps) {
      const hostWithoutPort = req.hostname;
      const httpsHost = `${hostWithoutPort}:${config.httpsPort}`;

      return res.redirect(301, `https://${httpsHost}${req.originalUrl}`);
    }

    next();
  };
}
