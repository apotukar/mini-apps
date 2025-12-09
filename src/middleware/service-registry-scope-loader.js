import { serviceRegistry } from '../service-registry/service-registry.js';

export function serviceRegistryScopeLoader() {
  return function (req, res, next) {
    req.services = serviceRegistry.scope({ req, res });

    next();
  };
}
