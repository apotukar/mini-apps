import express from 'express';

import { loadConfig } from './src/config-loader.js';
import { globalErrorHandler } from './src/middleware/global-error-handler.js';

import { Bootstrap } from './src/bootstrap.js';
import { RoutesBuilder } from './src/routes-builder.js';
import { ServerBuilder } from './src/server-builder.js';

const ROOT_DIR = process.cwd();
const config = loadConfig();
const app = express();

const bootstrap = new Bootstrap({
  config: { rootDir: ROOT_DIR, ...config }
});
await bootstrap.init(app);

const routesBuilder = new RoutesBuilder({
  config: { rootDir: ROOT_DIR, ...config }
});
routesBuilder.build(app);

// Global error handler — must be registered after all routes and other middleware,
// otherwise Express will not forward errors to it.
app.use(globalErrorHandler());

const serverBuilder = new ServerBuilder({
  config: { rootDir: ROOT_DIR, ...config }
});
serverBuilder.build(app);
