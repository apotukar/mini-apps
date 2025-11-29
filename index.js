import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import express from 'express';
import cookieParser from 'cookie-parser';

import { registerBasicAuth } from './helpers/security/basic-auth.js';
import { logger } from './helpers/logging.js';
import { markSecureRoute, forceHttpsRedirect } from './helpers/security/secure-routes.js';
import { setupNunjucks } from './helpers/nunjucks-setup.js';
import { loadConfig } from './helpers/config-loader.js';
import { createClient } from 'db-vendo-client';
import { profile as dbProfile } from 'db-vendo-client/p/dbnav/index.js';

import { registerHomeRoutes } from './apps/home.js';
import { registerJourneyRoutes } from './apps/journey.js';
import { registerWeatherRoutes } from './apps/weather.js';
import { registerDepartureRoutes } from './apps/departures.js';
import { registerTaskRoutes } from './apps/tasks.js';
import { registerNewsRoutes } from './apps/news.js';
import { registerPOIRoutes } from './apps/pois.js';
import { registerJoplinRoutes } from './apps/joplin.js';
import { registerBrowserRoutes } from './apps/browser.js';

// ────────────────────────────────────────────────────────────
// Bootstrap, Templating & DB Client
// ────────────────────────────────────────────────────────────

const config = loadConfig();
const app = express();
setupNunjucks(app, { config: { modeEnv: config.modeEnv } });
const dbClient = createClient(dbProfile, 'DB-Multi');

// ────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static('public'));
app.use(logger());
app.use(markSecureRoute());
config.routes
  .filter(route => route.isBasicAuth)
  .forEach(route => {
    app.use(
      route.path,
      registerBasicAuth({
        forceHttpsRedirect: route.forceHttpsRedirect,
        expectedUser: process.env.BASIC_AUTH_USER,
        expectedPassword: process.env.BASIC_AUTH_PASS
      })
    );
  });
app.use(
  forceHttpsRedirect({
    routes: config.routes,
    httpsPort: config.httpsPort
  })
);

// ────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────

registerHomeRoutes(app, {
  config: { bookmarks: config.bookmarks }
});

const sharedTransportConfig = {
  transportLabels: config.transport.labels,
  transportCssTypeAppendices: config.transport.cssTypeAppendices,
  saveNormalizedFavName: config.transport.saveNormalizedFavName
};

registerJourneyRoutes(app, {
  client: dbClient,
  config: {
    ...config.transport.journey,
    ...sharedTransportConfig
  }
});

registerDepartureRoutes(app, {
  client: dbClient,
  config: {
    ...config.transport.departures,
    ...sharedTransportConfig
  }
});

registerWeatherRoutes(app, { config: config.weather });
registerTaskRoutes(app);
registerNewsRoutes(app, { config: config.news });
registerPOIRoutes(app, { config: config.pois });
registerJoplinRoutes(app, { config: config.joplin });
registerBrowserRoutes(app, { config: config.browser });

// ────────────────────────────────────────────────────────────
// HTTPS-Server
// ────────────────────────────────────────────────────────────

const ROOT_DIR = process.cwd();

const httpsOptions = {
  key: fs.readFileSync(path.join(ROOT_DIR, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(ROOT_DIR, 'certs', 'server.crt'))
};

https.createServer(httpsOptions, app).listen(config.httpsPort, '0.0.0.0', () => {
  console.log('HTTPS server running on port', config.httpsPort);

  config.routes
    .filter(route => Array.isArray(route.scheme) && route.scheme.includes('https'))
    .forEach(route => {
      console.log(`${route.label}: https://localhost:${config.httpsPort}${route.path}`);
    });
});

http.createServer(app).listen(config.httpPort, '0.0.0.0', () => {
  console.log('HTTP server running on port', config.httpPort);

  config.routes
    .filter(route => Array.isArray(route.scheme) && route.scheme.includes('http'))
    .forEach(route => {
      console.log(`${route.label}: http://localhost:${config.httpPort}${route.path}`);
    });
});
