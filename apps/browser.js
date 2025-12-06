import session from 'express-session';
import { Browser } from '../helpers/browser-logic.js';

export function registerBrowserRoutes(app, params) {
  const browser = new Browser(params?.config || {});

  app.use(
    session({
      secret: 'mini-browser-secret',
      resave: false,
      saveUninitialized: true
    })
  );

  app.get('/browser', (req, res) => {
    res.render('browser/index.njk', {
      url: '',
      content: null,
      error: null,
      canGoBack: false,
      canGoForward: false,
      canGoHome: false
    });
  });

  app.get('/browser/browse', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) {
      return res.redirect('/browser');
    }

    const url = browser.normalizeUrl(rawUrl);

    try {
      const html = await browser.fetchHtml(url);
      const simplified = browser.simplifyHtml(html, url);
      handleSession(req, url);

      res.render('browser/index.njk', {
        url: rawUrl,
        content: simplified,
        error: null,
        canGoBack: req.session.index > 0,
        canGoForward: req.session.index < req.session.history.length - 1,
        canGoHome: true
      });
    } catch (err) {
      res.render('browser/index.njk', {
        url: rawUrl,
        content: null,
        error: err.message,
        canGoBack: false,
        canGoForward: false,
        canGoHome: true
      });
    }
  });

  app.get('/browser/back', (req, res) => {
    if (req.session.index > 0) {
      req.session.index--;
      const url = req.session.history[req.session.index];
      return res.redirect('/browser/browse?url=' + encodeURIComponent(url));
    }
    return res.redirect('/browser');
  });

  app.get('/browser/forward', (req, res) => {
    if (req.session.index < req.session.history.length - 1) {
      req.session.index++;
      const url = req.session.history[req.session.index];
      return res.redirect('/browser/browse?url=' + encodeURIComponent(url));
    }
    return res.redirect('/browser');
  });

  app.get('/browser/home', (req, res) => {
    return res.redirect('/browser');
  });
}

function handleSession(req, url) {
  if (!req.session.history) {
    req.session.history = [];
    req.session.index = -1;
  }
  req.session.history = req.session.history.slice(0, req.session.index + 1);
  req.session.history.push(url);
  req.session.index = req.session.history.length - 1;
}
