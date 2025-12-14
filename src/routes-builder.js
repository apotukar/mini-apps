import { registerHomeRoutes } from './routes/home.js';
import { registerJourneyRoutes } from './routes/journey.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { registerDeparturesRoutes } from './routes/departures.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerNewsRoutes } from './routes/news.js';
import { registerPOIRoutes } from './routes/pois.js';
import { registerJoplinRoutes } from './routes/joplin.js';
import { registerBrowserRoutes } from './routes/browser.js';
import { registerTrackRoutes } from './routes/track.js';
import { registerAuthRoutes } from './routes/auth.js';

import { createObservables } from './events/create-observables.js';

export class RoutesBuilder {
  constructor(params) {
    this.config = params.config;
  }

  build(app) {
    const routes = {
      title: 'Mini-Apps',
      pageTitle: 'Mini-Apps',
      bookmarks: {
        title: 'Bookmarks'
      }
    };
    const routesFilled = this.#fillHomeTextsFromConfig(routes, this.config.routes);
    registerHomeRoutes(app, {
      config: {
        bookmarks: this.config.bookmarks
      },
      routes: routesFilled
    });

    const sharedTransportConfig = {
      saveNormalizedFavName: this.config.transport.saveNormalizedFavName
    };

    registerDeparturesRoutes(app, {
      config: {
        ...this.config.transport.departures,
        ...sharedTransportConfig
      },
      route: this.#findByNameMapped(this.config.routes, 'departures')
    });

    registerJourneyRoutes(app, {
      config: {
        ...this.config.transport.journey,
        ...sharedTransportConfig
      },
      route: this.#findByNameMapped(this.config.routes, 'journey')
    });

    registerWeatherRoutes(app, {
      config: this.config.weather,
      route: this.#findByNameMapped(this.config.routes, 'weather')
    });

    registerTaskRoutes(app, {
      config: { authTokenKey: this.config.authTokenKey, ...this.config.tasks },
      route: this.#findByNameMapped(this.config.routes, 'tasks')
    });

    registerNewsRoutes(app, {
      config: this.config.news,
      route: this.#findByNameMapped(this.config.routes, 'news')
    });

    registerPOIRoutes(app, {
      config: this.config.pois,
      route: this.#findByNameMapped(this.config.routes, 'poi')
    });

    registerTrackRoutes(app, {
      config: this.config.track,
      route: this.#findByNameMapped(this.config.routes, 'track')
    });

    registerJoplinRoutes(app, { route: this.#findByNameMapped(this.config.routes, 'joplin') });

    registerBrowserRoutes(app, {
      route: this.#findByNameMapped(this.config.routes, 'browser')
    });

    const { onLogin, onLogout } = createObservables({
      routes: this.config.routes
    });
    registerAuthRoutes(app, {
      config: this.config.auth || {},
      onLogin,
      onLogout
    });
  }

  #findByNameMapped(routes, name) {
    const item = routes.find(r => r.name === name);
    if (!item) {
      return {};
    }

    const { title, headline, description, path, name: itemName } = item;
    return { title, headline, description, path, name: itemName };
  }

  #fillHomeTextsFromConfig(homeTexts, routes) {
    routes.forEach(route => {
      homeTexts[route.name] = {
        title: route.title,
        desc: route.description
      };
    });

    return homeTexts;
  }
}
