const FAV_COOKIE_MAX_AGE = 90 * 86400000;

export class CookieFavoritesManager {
  constructor(namespace) {
    this.namespace = namespace;
  }

  favKey() {
    return this.namespace ? `${this.namespace}_favs` : 'favs';
  }

  hideKey() {
    return this.namespace ? `${this.namespace}_hideConfigFavs` : 'hideConfigFavs';
  }

  getFavorites(req) {
    const key = this.favKey();
    if (!req.cookies?.[key]) {
      return [];
    }
    try {
      const parsed = JSON.parse(req.cookies[key]);
      const foo = Array.isArray(parsed) ? parsed : [];
      return foo;
    } catch {
      return [];
    }
  }

  saveFavorites(res, favs) {
    const key = this.favKey();
    res.cookie(key, JSON.stringify(favs), {
      maxAge: FAV_COOKIE_MAX_AGE,
      path: '/'
    });
  }

  clearFavorites(res) {
    const keyFav = this.favKey();
    res.clearCookie(keyFav, { path: '/' });
  }

  setHideFlag(res) {
    const key = this.hideKey();
    res.cookie(key, '1', {
      maxAge: FAV_COOKIE_MAX_AGE,
      path: '/'
    });
  }

  getHideFlag(req) {
    const key = this.hideKey();
    return !!req.cookies?.[key];
  }

  clearHideFlag(res) {
    const key = this.hideKey();
    res.clearCookie(key, { path: '/' });
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
