import { RedisManager } from '../lib/redis-manager.js';
import { profile as dbProfile } from 'db-vendo-client/p/dbnav/index.js';
import { createClient as createDbClient } from 'db-vendo-client';
import { serviceRegistry } from './service-registry.js';
import { TransportService } from '../services/transport-service.js';
import { WeatherService } from '../services/weather-service.js';
import { BrowserService } from '../services/browser-service.js';
import { renderMarkdown } from '../lib/markdown-joplin.js';
import { JoplinService } from '../services/joplin-service.js';
import Parser from 'rss-parser';
import { FeedsService } from '../services/feeds-service.js';
import { PoiService } from '../services/poi-service.js';
import { PoiEmergencyPharmacyService } from '../services/poi-emergency-pharmacy-service.js';
import { geocodePlace } from '../lib/geo/geocode.js';
import { generateStaticMap } from '../lib/geo/map-generator.js';
import { FavoritesManager } from '../lib/favs/favorites.js';
import { GoogleTokenReader } from '../lib/google/google-token-reader.js';
import { TasksService } from '../services/tasks-service.js';
import { fetchShipment as dhlFetchShipment } from '../lib/tracking/dhl.js';
import { TrackService } from '../services/track-service.js';

class ServicesSetup {
  constructor() {
    this.setups = [];
  }

  register(fn) {
    this.setups.push(fn);
  }

  async run(app, config) {
    const registry = serviceRegistry;
    for (const fn of this.setups) {
      await fn({ app, config, registry });
    }
  }
}

const servicesSetup = new ServicesSetup();

export async function setupServices(app, config) {
  await servicesSetup.run(app, config);
}

servicesSetup.register(async ({ config, registry }) => {
  registry.registerSingleton('redisManager', () => {
    const redisManager = new RedisManager({
      sessionSecret: config.sessionSecret,
      ...config.redis
    });
    redisManager.ensureReady();
    return redisManager;
  });
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'transportService',
    () =>
      new TransportService(
        // db, dbnav, dbweb -> https://github.com/public-transport/db-vendo-client/blob/main/index.js
        createDbClient(dbProfile, 'db'),
        {
          transportLabels: config.transport.labels,
          transportCssTypeAppendices: config.transport.cssTypeAppendices
        }
      )
  );
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'weatherService',
    () => new WeatherService({ descriptions: config.weather.descriptions })
  );
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'browserService',
    () => new BrowserService({ readMode: false, ...config.browser })
  );
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'joplinService',
    () => new JoplinService(renderMarkdown, config.joplin)
  );
});

servicesSetup.register(({ _, registry }) => {
  registry.registerSingleton('feedsService', () => new FeedsService(new Parser()));
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'poiService',
    () =>
      new PoiService({
        cacheDir: config.pois.reverseGeocodingCacheDir,
        apiKey: config.pois.reverseGeocodingKey,
        addMissingAddresses: config.pois.addMissingAddresses
      })
  );
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'poiEmergencyPharmacyService',
    () => new PoiEmergencyPharmacyService({ cacheDir: config.pois.emergencyPharmaciesCacheDir })
  );
});

servicesSetup.register(({ _, registry }) => {
  registry.registerSingleton('geocodePlace', () => {
    return query => geocodePlace(query);
  });
});

servicesSetup.register(({ _, registry }) => {
  registry.registerSingleton('generateStaticMap', () => {
    return (lat, lon, zoom, tiles) => generateStaticMap(lat, lon, zoom, tiles);
  });
});

servicesSetup.register(({ config, registry }) => {
  const routes = config.routes || [];

  for (const route of routes) {
    if (route.hasFavorites) {
      registry.registerSingleton(
        `favoritesManager.${route.name}`,
        () => new FavoritesManager(route.name)
      );
    }
  }
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton(
    'googleTokenReader',
    () =>
      new GoogleTokenReader({
        clientId: config.tasks.clientId,
        clientSecret: config.tasks.clientSecret,
        tokensPath: config.tasks.tokensPath,
        authTokenKey: config.authTokenKey
      })
  );
});

servicesSetup.register(({ _, registry }) => {
  registry.registerSingleton(
    'tasksService',
    () => new TasksService(registry.resolve('googleTokenReader'))
  );
});

servicesSetup.register(({ config, registry }) => {
  registry.registerSingleton('trackService', () => {
    const dhlFetcher = trackingNumber =>
      dhlFetchShipment(trackingNumber, {
        apiKey: config.track.dhl.apiKey,
        service: 'parcel-de',
        requesterCountryCode: 'DE',
        language: 'de'
      });

    return new TrackService({ dhlFetchShipment: dhlFetcher });
  });
});
