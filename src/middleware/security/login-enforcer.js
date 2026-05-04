const forbidden = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Forbidden</title></head>
<body><pre>Forbidden</pre></body>
</html>`;

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
