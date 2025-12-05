const hiddenForbidden = req => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <title>Error</title>
    </head>
    <body>
    <pre>Cannot ${req.method} ${req.originalUrl}</pre>
    </body>
    </html>`;

const forbidden = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Forbidden</title></head>
<body><pre>Forbidden</pre></body>
</html>`;

export function authMarker() {
  return function (req, res, next) {
    res.locals.user = req.session?.user || null;
    res.locals.isLoggedIn = Boolean(req.session.user);

    next();
  };
}
export function secureRouteMarker() {
  return function (req, res, next) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';

    res.locals.isHttps = isHttps;
    res.locals.currentScheme = isHttps ? 'https' : 'http';

    next();
  };
}

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

export function loginEnforcer(config) {
  return function (req, res, next) {
    const routeConfig = config.routes.find(r => req.path.startsWith(r.path));

    if (!routeConfig) {
      return next();
    }

    const requiresLogin = routeConfig.requiresLogin === true;
    const isLoggedIn = !!(req.session?.user || null);

    if (requiresLogin && !isLoggedIn) {
      return res.redirect(`/auth/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }

    const roles = routeConfig.roles || [];
    if (!roles.length) {
      return next();
    }

    const userRoles = req.session?.user?.roles || [];
    if (!userRoles.some(role => role === 'admin' || role === 'joplin' || roles.includes(role))) {
      return res.status(403).type('text/html').send(forbidden);
    }

    next();
  };
}

export function basicAuthRegistrator(config) {
  return function (req, res, next) {
    const shouldForce = config.forceHttpsRedirect === true;
    const isHttps = res.locals.isHttps === true;

    // special rule
    if (shouldForce && !isHttps) {
      return res.status(404).send(hiddenForbidden(req));
    }

    const authHeader = req.headers['authorization'];
    const { expectedUser, expectedPassword } = config;

    if (!expectedUser || !expectedPassword) {
      return res.status(500).send('Server misconfigured: missing basic auth credentials');
    }

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Protected Area"');
      return res.status(401).send('Authentication required');
    }

    const base64Credentials = authHeader.slice('Basic '.length).trim();
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [user, password] = credentials.split(':');

    const valid = user === expectedUser && password === expectedPassword;

    if (!valid) {
      res.set('WWW-Authenticate', 'Basic realm="Protected Area"');
      return res.status(401).send('Invalid credentials');
    }

    next();
  };
}
