import express from 'express';

import { loadConfig } from './src/middleware/config-loader.js';

import { AppBootstrap } from './src/app-boostrap.js';
import { AppRoutesBuilder } from './src/app-routes-builder.js';
import { AppServerBuilder } from './src/app-server-builder.js';

const ROOT_DIR = process.cwd();
const config = loadConfig();
const app = express();

const bootstrap = new AppBootstrap({
  config: { rootDir: ROOT_DIR, ...config }
});
await bootstrap.init(app);

const routesBuilder = new AppRoutesBuilder({
  config: { rootDir: ROOT_DIR, ...config }
});
routesBuilder.build(app);

const serverBuilder = new AppServerBuilder({
  config: { rootDir: ROOT_DIR, ...config }
});
serverBuilder.build(app);
