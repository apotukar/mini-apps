import { RedisStore } from 'connect-redis';
import { createClient as createRedisClient } from 'redis';

export class RedisManager {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async init() {
    this.client = createRedisClient({
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port
      }
    });

    await this.client.connect();
  }

  getSessionConfig() {
    return {
      store: new RedisStore({ client: this.client }),
      secret: this.config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false
      }
    };
  }
}
