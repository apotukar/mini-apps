export function registerHomeRoutes(app, params) {
  const { config, routes } = params || {};

  app.get('/', (_, res) => {
    const viewExt = res.locals.viewExt || '';
    res.render(`home/index.${viewExt}`, {
      bookmarks: config.bookmarks,
      isSecureContext: res.locals.isHttps,
      content: routes
    });
  });
}
