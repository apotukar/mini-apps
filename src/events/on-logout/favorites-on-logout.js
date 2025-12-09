import { FavoritesManager } from '../../lib/favs/favorites.js';

export function createMergeFavoritesOnLogout(config = {}) {
  const { routes } = config;

  return async function mergeFavoritesOnLogout({ _, res }) {
    for (const route of routes) {
      if (route.hasFavorites === false) {
        continue;
      }

      const mgr = new FavoritesManager(route.name);
      mgr.cookieManager.clearFavorites(res);
    }
  };
}
