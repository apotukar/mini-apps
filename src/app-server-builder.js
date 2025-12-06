import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export class AppServerBuilder {
  constructor(params) {
    this.config = params.config;

    if (!this.config || !this.config.rootDir) {
      throw new Error('AppBootstrap: config.rootDir is missing');
    }

    this.httpsOptions = {
      key: fs.readFileSync(path.join(this.config.rootDir, 'certs', 'server.key')),
      cert: fs.readFileSync(path.join(this.config.rootDir, 'certs', 'server.crt'))
    };
  }

  build(app) {
    https.createServer(this.httpsOptions, app).listen(this.config.httpsPort, '0.0.0.0', () => {
      console.log('HTTPS server running on port', this.config.httpsPort);

      this.config.routes
        .filter(route => Array.isArray(route.scheme) && route.scheme.includes('https'))
        .forEach(route => {
          console.log(`${route.label}: https://localhost:${this.config.httpsPort}${route.path}`);
        });
    });

    http.createServer(app).listen(this.config.httpPort, '0.0.0.0', () => {
      console.log('HTTP server running on port', this.config.httpPort);

      this.config.routes
        .filter(route => Array.isArray(route.scheme) && route.scheme.includes('http'))
        .forEach(route => {
          console.log(`${route.label}: http://localhost:${this.config.httpPort}${route.path}`);
        });
    });
  }
}
