import { fetchLegacyImage } from '../lib/browser/content/image-fetcher.js';

export function registerBrowserRoutes(app, params) {
  const route = params.route || {};
  const title = route.title;

  app.get('/browser/image', async (req, res) => {
    if (typeof req.query.url !== 'string' || req.query.url.length > 8192) {
      res.sendStatus(400);
      return;
    }
    try {
      const { buffer, contentType } = await fetchLegacyImage(req.query.url);
      res.set('Content-Type', contentType);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'no-store');
      res.send(buffer);
    } catch {
      res.status(502).end();
    }
  });

  app.get('/browser', (_, res) => {
    res.render('browser/index.ns4', {
      url: '',
      title,
      navHtml: '',
      contentHtml: '',
      fallbackColor: '#f7f3e8',
      fontFamily: 'Georgia, Times New Roman, Times, serif',
      fontSize: '16px'
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
        fallbackColor: '#f7f3e8',
        fontFamily: 'Georgia, Times New Roman, Times, serif',
        fontSize: '16px'
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
      fallbackColor: '#f7f3e8',
      fontFamily: 'Georgia, Times New Roman, Times, serif',
      fontSize: '16px'
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
      fallbackColor: '#f7f3e8',
      fontFamily: 'Georgia, Times New Roman, Times, serif',
      fontSize: '16px'
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
