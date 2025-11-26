export function basicAuth(config) {
  return function (req, res, next) {
    const authHeader = req.headers['authorization'];
    const { expectedUser, expectedPassword } = config;

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
