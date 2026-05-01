import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

export class ServerBuilder {
  constructor(params) {
    this.config = params.config;

    if (!this.config || !this.config.rootDir) {
      throw new Error('AppBootstrap: config.rootDir is missing');
    }

    this.config.http = this.config.http ?? true;
    this.config.https = this.config.https ?? true;

    if (this.config.https) {
      this.httpsOptions = {
        key: fs.readFileSync(path.join(this.config.rootDir, 'certs', 'server.key')),
        cert: fs.readFileSync(path.join(this.config.rootDir, 'certs', 'server.crt'))
      };
    }
  }

  build(app) {
    if (this.config.https) {
      https.createServer(this.httpsOptions, app).listen(this.config.httpsPort, '0.0.0.0', () => {
        console.log('HTTPS server running on port', this.config.httpsPort);

        this.config.routes
          .filter(r => Array.isArray(r.scheme) && r.scheme.includes('https'))
          .forEach(r => {
            console.log(
              `path: ${(r.path + ',').padEnd(20)} uri: https://localhost:${this.config.httpsPort}${r.path}`
            );
          });
      });
    }

    if (this.config.http) {
      http.createServer(app).listen(this.config.httpPort, '0.0.0.0', () => {
        console.log('HTTP server running on port', this.config.httpPort);

        this.config.routes
          .filter(r => Array.isArray(r.scheme) && r.scheme.includes('http'))
          .forEach(r => {
            console.log(
              `path: ${(r.path + ',').padEnd(20)} uri: http://localhost:${this.config.httpPort}${r.path}`
            );
          });
      });
    }
  }
}
