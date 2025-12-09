export function registerNewsRoutes(app, params) {
  const config = {
    feeds: {
      'https://www.jungewelt.de/aktuell/newsticker.rss': 100
    },
    limit: 10,
    totalLimit: 100,
    browserProxies: ['/browser/browse?url='],
    ...(params.config || {})
  };

  app.get('/news', async (req, res) => {
    const protocol = req.protocol;
    const host = req.headers.host;
    const browserProxies = (config.browserProxies || []).map(p => {
      let link = p.link.startsWith('/') ? `${host}/${p.link}` : p.link;
      link = link.includes('frogfind') ? `http://${link}` : `${protocol}://${link}`;
      link = link.replace(/([^:]\/)\/+/g, '$1');

      return {
        link,
        description: p.description
      };
    });

    const browserProxy = req.query.proxy || null;

    try {
      const feedService = req.services.get('feedsService');
      const { items, errors } = await feedService.fetchAllFeeds(
        config.feeds,
        config.limit,
        config.totalLimit,
        browserProxy
      );

      if (errors.length > 0) {
        console.error('Errors occurred while fetching feeds:', errors);
      }

      res.render('news/index.njk', {
        items,
        proxies: browserProxies,
        currentProxy: browserProxy
      });
    } catch (err) {
      res.status(500).send('Fehler beim Laden der Nachrichten: ' + err.message);
    }
  });
}
