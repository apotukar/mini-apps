import { createClient as createDbClient } from 'db-vendo-client';
import { profile as dbProfile } from 'db-vendo-client/p/dbnav/index.js';

import { registerHomeRoutes } from '../src/routes/home.js';
import { registerJourneyRoutes } from '../src/routes/journey.js';
import { registerWeatherRoutes } from '../src/routes/weather.js';
import { registerDepartureRoutes } from '../src/routes/departures.js';
import { registerTaskRoutes } from '../src/routes/tasks.js';
import { registerNewsRoutes } from '../src/routes/news.js';
import { registerPOIRoutes } from '../src/routes/pois.js';
import { registerJoplinRoutes } from '../src/routes/joplin.js';
import { registerBrowserRoutes } from '../src/routes/browser.js';
import { registerTrackRoutes } from '../src/routes/track.js';
import { registerAuthRoutes } from '../src/routes/auth.js';

import { createObservables } from '../src/events/create-observables.js';

export class AppRoutesBuilder {
  constructor(params) {
    this.config = params.config;

    this.dbClient = createDbClient(dbProfile, 'DB-Multi');
  }

  build(app) {
    registerHomeRoutes(app, {
      config: { bookmarks: this.config.bookmarks }
    });

    const sharedTransportConfig = {
      transportLabels: this.config.transport.labels,
      transportCssTypeAppendices: this.config.transport.cssTypeAppendices,
      saveNormalizedFavName: this.config.transport.saveNormalizedFavName
    };

    registerJourneyRoutes(app, {
      client: this.dbClient,
      config: {
        ...this.config.transport.journey,
        ...sharedTransportConfig
      }
    });

    registerDepartureRoutes(app, {
      client: this.dbClient,
      config: {
        ...this.config.transport.departures,
        ...sharedTransportConfig
      }
    });

    registerWeatherRoutes(app, { config: this.config.weather });

    registerTaskRoutes(app, {
      config: { authTokenKey: this.config.authTokenKey, ...this.config.tasks }
    });

    registerNewsRoutes(app, { config: this.config.news });
    registerPOIRoutes(app, { config: this.config.pois });
    registerTrackRoutes(app, { config: this.config.track });
    registerJoplinRoutes(app, { config: this.config.joplin });
    registerBrowserRoutes(app, { config: this.config.browser });

    const { onLogin, onLogout } = createObservables({
      routes: this.config.routes
    });
    registerAuthRoutes(app, {
      config: this.config.auth || {},
      onLogin,
      onLogout
    });
  }
}
