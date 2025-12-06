import path from 'path';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { createClient as createDbClient } from 'db-vendo-client';
import { profile as dbProfile } from 'db-vendo-client/p/dbnav/index.js';

import { logger } from './middleware/logging.js';
import {
  secureRouteMarker,
  httpsRedirectEnforcer,
  loginEnforcer,
  authMarker,
  basicAuthRegistrator
} from './middleware/security.js';
import { viewBaseMarker, pageUrlMarker } from './middleware/viewsupport.js';
import { setupNunjucks } from './middleware/nunjucks-setup.js';
import { RedisManager } from './lib/redis-manager.js';

export class AppBootstrap {
  constructor(params) {
    this.config = params.config;

    if (!this.config || !this.config.rootDir) {
      throw new Error('AppBootstrap: config.rootDir is missing');
    }

    this.viewExtConfig = { defaultViewExt: 'njk', ns4ViewExt: 'ns4' };
    this.dbClient = createDbClient(dbProfile, 'DB-Multi');
    this.redisManager = new RedisManager(this.config);
  }

  async init(app) {
    await this.redisManager.init();
    app.locals.redis = this.redisManager.client;
    this._view(app);
    this._middleware(app);
    this._security(app);
  }

  _view(app) {
    setupNunjucks(app, { config: { modeEnv: this.config.modeEnv, ...this.viewExtConfig } });
    app.use(
      '/public',
      express.static(
        path.join(this.config.rootDir, 'src/public'),
        this.config.modeEnv.toUpperCase() === 'DEV'
          ? { etag: false, lastModified: false, cacheControl: false, maxAge: 0 }
          : { etag: true, lastModified: true, maxAge: '30d' }
      )
    );
    app.use(viewBaseMarker(this.viewExtConfig));
    app.use(pageUrlMarker());
  }

  _middleware(app) {
    app.use(express.urlencoded({ extended: true }));
    app.use(logger());
    app.use(cookieParser());
    app.use(session(this.redisManager.getSessionConfig()));
  }

  _security(app) {
    app.use(secureRouteMarker());
    app.use(authMarker());
    app.use(loginEnforcer({ routes: this.config.routes }));
    app.use(
      httpsRedirectEnforcer({
        routes: this.config.routes,
        httpsPort: this.config.httpsPort
      })
    );

    this.config.routes
      .filter(route => route.isBasicAuth)
      .forEach(route => {
        app.use(
          route.path,
          basicAuthRegistrator({
            forceHttpsRedirect: route.forceHttpsRedirect,
            expectedUser: process.env.BASIC_AUTH_USER,
            expectedPassword: process.env.BASIC_AUTH_PASS
          })
        );
      });
  }
}
