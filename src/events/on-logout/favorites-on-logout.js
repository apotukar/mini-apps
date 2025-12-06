import { FavoritesManager } from '../../lib/favs/favorites.js';

export function createMergeFavoritesOnLogout(config = {}) {
  const { routes } = config;

  return async function mergeFavoritesOnLogout({ req, res }) {
    console.log('mergeFavoritesOnLogout');
    for (const route of routes) {
      if (route.hasFavorites === false) {
        continue;
      }

      const mgr = new FavoritesManager(route.name);

      const redisFavs = await mgr.redisManager.getFavorites(req);
      mgr.cookieManager.saveFavorites(res, redisFavs);
    }
  };
}
