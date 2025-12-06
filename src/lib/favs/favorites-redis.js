const FAV_REDIS_TTL_SECONDS = 90 * 86400;

export class RedisFavoritesManager {
  constructor(namespace) {
    this.namespace = namespace;
  }

  favKey() {
    return this.namespace ? `${this.namespace}_favs` : 'favs';
  }

  hideKey() {
    return this.namespace ? `${this.namespace}_hideConfigFavs` : 'hideConfigFavs';
  }

  redisFavKey(req) {
    return `${this.favKey()}:user:${req.session.user.id}`;
  }

  redisHideKey(req) {
    return `${this.hideKey()}:user:${req.session.user.id}`;
  }

  getRedis(req) {
    return req.app?.locals?.redis;
  }

  getFavorites(req) {
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return [];
    }

    return redis.get(this.redisFavKey(req)).then(json => {
      if (!json) {
        return [];
      }
      try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });
  }

  saveFavorites(res, favs) {
    const req = res.req;
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return;
    }

    const clean = this.dedupeFavs(favs);
    return redis.set(this.redisFavKey(req), JSON.stringify(clean), 'EX', FAV_REDIS_TTL_SECONDS);
  }

  clearFavorites(res) {
    const req = res.req;
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return;
    }

    return redis.del(this.redisFavKey(req));
  }

  setHideFlag(res) {
    const req = res.req;
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return;
    }

    return redis.set(this.redisHideKey(req), '1', 'EX', FAV_REDIS_TTL_SECONDS);
  }

  getHideFlag(req) {
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return false;
    }

    return redis.get(this.redisHideKey(req)).then(val => !!val);
  }

  clearHideFlag(res) {
    const req = res.req;
    const redis = this.getRedis(req);
    if (!redis || !req.session?.user.id) {
      return;
    }

    return redis.del(this.redisHideKey(req));
  }

  dedupeFavs(list) {
    const seen = new Set();
    return list.filter(item => {
      const key = typeof item === 'string' ? item : JSON.stringify(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
