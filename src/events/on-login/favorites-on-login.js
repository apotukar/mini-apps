import { FavoritesManager } from '../../lib/favs/favorites.js';

export function createMergeFavoritesOnLogin(config = {}) {
  const { routes } = config;

  return async function mergeFavoritesOnLogin({ req, res }) {
    for (const route of routes) {
      if (route.hasFavorites === false) {
        continue;
      }

      const mgr = new FavoritesManager(route.name);

      const cookieFavs = mgr.cookieManager.getFavorites(req);
      const redisFavs = await mgr.redisManager.getFavorites(req);
      const merged = mgr.dedupeFavs([...redisFavs, ...cookieFavs]);
      await mgr.redisManager.saveFavorites(res, merged);
    }
  };
}
