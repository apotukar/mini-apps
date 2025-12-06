import { Browser } from '../lib/browser/browser.js';
import { escapeText } from '../lib/browser/html-utils.js';

export function registerBrowserRoutes(app, params = {}) {
  const browser = new Browser(params.config || {});

  app.get('/browser', (req, res) => {
    const html = browser.buildLegacyHtml(
      'Mini-Browser',
      '',
      '',
      '',
      'Verdana, Arial, Helvetica, sans-serif',
      '#dbeafe'
    );
    res.type('text/html').send(html);
  });

  app.get('/browser/browse', async (req, res) => {
    const rawInput = req.query.url;
    if (!rawInput) {
      const html = browser.buildLegacyHtml(
        'Mini-Browser',
        '',
        '',
        '',
        'Verdana, Arial, Helvetica, sans-serif',
        '#dbeafe'
      );
      return res.type('text/html').send(html);
    }

    const normalized = browser.normalizeUrl(rawInput);

    try {
      const originalHtml = await browser.fetchHtml(normalized);
      const simplifiedHtml = browser.simplifyHtml(originalHtml, normalized);
      res.type('text/html').send(simplifiedHtml);
    } catch (err) {
      const msg = err?.message || String(err);
      const html = browser.buildLegacyHtml(
        'Fehler beim Laden',
        normalized,
        '',
        `<pre>${escapeText(msg)}</pre>`,
        'Verdana, Arial, Helvetica, sans-serif',
        '#fecaca'
      );
      res.status(500).type('text/html').send(html);
    }
  });
}
