export function registerBrowserRoutes(app, params) {
  const route = params.route || {};
  const title = route.title;

  app.get('/browser', (_, res) => {
    res.render('browser/index.ns4', {
      url: '',
      title,
      navHtml: '',
      contentHtml: '',
      fallbackColor: '#dbeafe',
      fontFamily: 'Verdana, Arial, Helvetica, sans-serif'
    });
  });

  app.get('/browser/browse', async (req, res) => {
    const rawUrl = req.query.url || '';
    const localUrl = `${req.protocol}://${req.host}`;

    const urlLower = rawUrl.toLowerCase();
    const isSearchEngine = searchEnginePatterns.some(pattern =>
      urlLower.includes(pattern.toLowerCase())
    );
    if (isSearchEngine) {
      res.status(403).render('browser/index.ns4', {
        url: '',
        title: 'Suchmaschine blockiert',
        navHtml: '',
        contentHtml: '',
        fallbackColor: '#dbeafe',
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: '10px'
      });
      return;
    }

    const browserService = req.services.get('browserService');
    const { url, title, navHtml, contentHtml } = await browserService.browse(rawUrl, localUrl);

    res.render('browser/index.ns4', {
      url,
      title,
      navHtml,
      contentHtml,
      fallbackColor: '#dbeafe',
      fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
      fontSize: '10px'
    });
  });

  app.get('/browser/search', async (req, res) => {
    const searchQuery = req.query.url || '';
    const localUrl = `${req.protocol}://${req.host}`;

    const browserService = req.services.get('browserService');
    const html = await browserService.search(searchQuery, localUrl);
    const dummyNav = '<small>Suchnavigation Dummy</small>';
    const dummyContent = `<p>Suchergebnisse für: ${searchQuery}</p><br>${html}`;

    res.render('browser/index.ns4', {
      url: searchQuery,
      isSearch: true,
      title: 'Suche',
      navHtml: dummyNav,
      contentHtml: dummyContent,
      fallbackColor: '#dbeafe',
      fontFamily: 'Verdana, Arial, Helvetica, sans-serif'
    });
  });
}

const searchEnginePatterns = [
  'google.com',
  'google.de',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'search.yahoo.com',
  'ecosia.org',
  'startpage.com',
  'ask.com',
  'baidu.com',
  'yandex.ru',
  'yandex.com',
  'searchencrypt.com',
  'qwant.com',
  'swisscows.com'
];
