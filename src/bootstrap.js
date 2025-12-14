import path from 'path';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import { logger } from './middleware/logging.js';
import { serviceRegistryScopeLoader } from './middleware/service-registry-scope-loader.js';
import {
  secureRouteMarker,
  httpsRedirectEnforcer,
  loginEnforcer,
  authMarker
} from './middleware/security.js';
import { viewBaseMarker, pageUrlMarker } from './middleware/view-support.js';
import { setupNunjucks } from './middleware/nunjucks-setup.js';
import { serviceRegistry } from './service-registry/service-registry.js';
import { setupServices } from './service-registry/services-setup.js';

export class Bootstrap {
  constructor(params) {
    this.config = params.config;
    if (!this.config || !this.config.rootDir) {
      throw new Error('AppBootstrap: config.rootDir is missing');
    }

    this.viewExtConfig = { defaultViewExt: 'njk', ns4ViewExt: 'ns4' };
  }

  async init(app) {
    await setupServices(app, this.config);
    await this.#redis(app);
    this.#middleware(app);
    this.#security(app);
    this.#view(app);
  }

  async #redis(app) {
    await setupServices(app, this.config);
    const redisManager = serviceRegistry.resolve('redisManager');
    await redisManager.ensureReady();
    app.locals.redis = redisManager.client;
    app.use(session(serviceRegistry.resolve('redisManager').getSessionConfig()));
  }

  async #middleware(app) {
    app.use(serviceRegistryScopeLoader());
    app.use(express.urlencoded({ extended: true }));
    app.use(logger());
    app.use(cookieParser());
  }

  #security(app) {
    app.use(secureRouteMarker());
    app.use(authMarker());
    app.use(loginEnforcer({ routes: this.config.routes }));
    app.use(
      httpsRedirectEnforcer({
        routes: this.config.routes,
        httpsPort: this.config.httpsPort
      })
    );
  }

  #view(app) {
    setupNunjucks(app, { config: { modeEnv: this.config.modeEnv, ...this.viewExtConfig } });
    app.use(viewBaseMarker(this.viewExtConfig));
    app.use(pageUrlMarker());
    app.use(
      '/public',
      express.static(
        path.join(this.config.rootDir, 'src/public'),
        this.config.modeEnv === 'DEV'
          ? {
              etag: false,
              lastModified: false,
              setHeaders: res => {
                res.setHeader('Cache-Control', 'no-store');
              }
            }
          : {
              etag: true,
              lastModified: true,
              setHeaders: (res, path) => {
                const oneYear = 60 * 60 * 24 * 365;
                res.setHeader('Cache-Control', `public, max-age=${oneYear}`);
                if (/\.[a-f0-9]{8,}\./.test(path)) {
                  res.setHeader('Cache-Control', `public, max-age=${oneYear}, immutable`);
                }
              }
            }
      )
    );
  }
}
