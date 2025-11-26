export function registerHomeRoutes(app, params) {
  const config = params.config || {};
  const { bookmarks } = config;

  app.get('/', (_, res) => {
    res.render('home/index.njk', {
      bookmarks: bookmarks
    });
  });
}
