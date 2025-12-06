import { CookieFavoritesManager } from './favorites-cookies.js';
import { RedisFavoritesManager } from './favorites-redis.js';

export class FavoritesManager {
  constructor(namespace) {
    this.namespace = namespace;
    this.cookieManager = new CookieFavoritesManager(namespace);
    this.redisManager = new RedisFavoritesManager(namespace);
  }

  shouldUseRedisFromReq(req) {
    return !!(req?.app?.locals?.redis && req?.session?.user?.id);
  }

  shouldUseRedisFromRes(res) {
    const req = res?.req;
    return this.shouldUseRedisFromReq(req);
  }

  async getFavorites(req) {
    if (this.shouldUseRedisFromReq(req)) {
      return this.redisManager.getFavorites(req);
    }
    return this.cookieManager.getFavorites(req);
  }

  async saveFavorites(res, favs) {
    if (this.shouldUseRedisFromRes(res)) {
      return this.redisManager.saveFavorites(res, favs);
    }
    return this.cookieManager.saveFavorites(res, favs);
  }

  async clearFavorites(res) {
    if (this.shouldUseRedisFromRes(res)) {
      return this.redisManager.clearFavorites(res);
    }
    return this.cookieManager.clearFavorites(res);
  }

  async setHideFlag(res) {
    if (this.shouldUseRedisFromRes(res)) {
      return this.redisManager.setHideFlag(res);
    }
    return this.cookieManager.setHideFlag(res);
  }

  async getHideFlag(req) {
    if (this.shouldUseRedisFromReq(req)) {
      return this.redisManager.getHideFlag(req);
    }
    return this.cookieManager.getHideFlag(req);
  }

  async clearHideFlag(res) {
    if (this.shouldUseRedisFromRes(res)) {
      return this.redisManager.clearHideFlag(res);
    }
    return this.cookieManager.clearHideFlag(res);
  }

  dedupeFavs(list) {
    return this.cookieManager.dedupeFavs(list);
  }
}
