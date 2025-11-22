export function registerHomeRoutes(app, params) {
  const config = params.config || {}
  const { departuresFavorites, weatherFavorites, bookmarks } = config

  app.get('/', (_, res) => {
    res.render('home/index.njk', {
      departuresFavorites: departuresFavorites,
      weatherFavorites: weatherFavorites,
      bookmarks: bookmarks
    })
  })
}
