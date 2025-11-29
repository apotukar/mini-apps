export function registerBasicAuth(config) {
  return function (req, res, next) {
    const shouldForce = config.forceHttpsRedirect === true;
    const isHttps = res.locals.isHttps === true;

    // special rule
    if (shouldForce && !isHttps) {
      const html = `
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

      return res.status(404).send(html);
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
