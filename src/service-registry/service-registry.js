class ServiceRegistry {
  constructor() {
    this.definitions = new Map();
    this.singletons = new Map();
  }

  registerSingleton(name, factory) {
    this.definitions.set(name, { factory, lifetime: 'singleton' });
  }

  registerScoped(name, factory) {
    this.definitions.set(name, { factory, lifetime: 'scoped' });
  }

  registerTransient(name, factory) {
    this.definitions.set(name, { factory, lifetime: 'transient' });
  }

  resolve(name, ctx = {}, scopedCache = null) {
    const def = this.definitions.get(name);
    if (!def) {
      throw new Error(`Service not registered: ${name}`);
    }

    if (def.lifetime === 'singleton') {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, def.factory());
      }
      return this.singletons.get(name);
    }

    if (def.lifetime === 'scoped') {
      if (!scopedCache) {
        return def.factory(ctx);
      }
      if (!scopedCache.has(name)) {
        scopedCache.set(name, def.factory(ctx));
      }
      return scopedCache.get(name);
    }

    if (def.lifetime === 'transient') {
      return def.factory(ctx);
    }

    throw new Error(`Unknown lifetime for service "${name}"`);
  }

  scope(ctx = {}) {
    const container = this;
    const scopedCache = new Map();
    return {
      get(name) {
        return container.resolve(name, ctx, scopedCache);
      }
    };
  }
}

export const serviceRegistry = new ServiceRegistry();
