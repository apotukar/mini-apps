import { BrowserService } from '../services/browser-service.js';

export function registerBrowserRoutes(app, params) {
  const config = params.config || {};
  const browserService = new BrowserService({ readMode: false, ...config });
  const title = 'WWW';

  app.get('/browser', (req, res) => {
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
