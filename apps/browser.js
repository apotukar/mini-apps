import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import session from 'express-session';

export function registerBrowserRoutes(app, params) {
  const config = {
    timeout: 120000,
    waitUntil: 'networkidle2',
    loadImages: true,
    modes: [],
    imageWidth: 200,
    ...(params.config || {})
  };

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
    if (!rawUrl) return res.redirect('/browser');

    const url = normalizeUrl(rawUrl);

    try {
      const html = await fetchHtml(url, config);
      const simplified = simplifyHtml(html, url, config);
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
    res.redirect('/browser');
  });

  app.get('/browser/forward', (req, res) => {
    if (req.session.index < req.session.history.length - 1) {
      req.session.index++;
      const url = req.session.history[req.session.index];
      return res.redirect('/browser/browse?url=' + encodeURIComponent(url));
    }
    res.redirect('/browser');
  });

  app.get('/browser/home', (req, res) => {
    res.redirect('/browser');
  });
}

function normalizeUrl(input) {
  if (!input) return '';
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

async function fetchHtml(url, config) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(config.timeout);

  if (config.loadImages === false) {
    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  await page.goto(url, { waitUntil: config.waitUntil });
  const html = await page.content();
  await browser.close();
  return html;
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

function simplifyHtml(html, url, config) {
  const $ = cheerio.load(html);

  $('script, noscript, style').remove();
  $('section, article, nav, header, footer, aside').each((_, el) => {
    $(el).replaceWith(`<div>${$(el).html() || ''}</div>`);
  });

  if (config.loadImages === false) {
    $('img, picture, source, svg').remove();
    $('[style]').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const cleaned = style.replace(/background[^;]+;?/gi, '');
        $(el).attr('style', cleaned);
      }
    });
  } else {
    $('img').each((_, el) => {
      $(el).attr('width', config.imageWidth);
      $(el).removeAttr('height');
    });
  }

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      try {
        const absolute = new URL(href, url).href;
        $(el).attr('href', '/browser/browse?url=' + encodeURIComponent(absolute));
      } catch {
        $(el).removeAttr('href');
      }
    }
  });

  $('form').each((_, el) => {
    const action = $(el).attr('action');
    if (action) {
      try {
        const absolute = new URL(action, url).href;
        $(el).attr('action', '/browser/browse?url=' + encodeURIComponent(absolute));
      } catch {
        $(el).removeAttr('action');
      }
    }
    $(el).attr('method', 'get');
  });

  if (config.modes?.includes('simplify')) {
    $('[style]').removeAttr('style');
  }

  if (config.modes?.includes('frogfind')) {
    const candidates = [];
    $('main, .content, #content, article').each((_, el) => candidates.push(el));
    $('div').each((_, el) => {
      const textLen = ($(el).text() || '').trim().length;
      if (textLen > 800) candidates.push(el);
    });

    let best = null;
    let bestScore = 0;
    candidates.forEach(el => {
      const len = ($(el).text() || '').trim().length;
      const pCount = $(el).find('p').length;
      const score = len + pCount * 200;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });

    const $main = best ? $(best).clone() : $('body').clone();

    const allowed = new Set(['div', 'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a']);
    $main.find('*').each((_, el) => {
      if (!allowed.has(el.tagName?.toLowerCase())) {
        const $el = $(el);
        $el.replaceWith($el.html() || '');
      }
    });

    return `
      <div class="page">
        <div class="ns-content">
          ${$main.html() || ''}
        </div>
      </div>
    `;
  }

  return $('body').html() || $.html();
}
