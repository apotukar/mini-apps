import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export class Browser {
  constructor(config = {}) {
    this.config = {
      timeout: 120000,
      waitUntil: 'networkidle2',
      modes: [],
      ...config
    };
  }

  normalizeUrl(input) {
    if (!input) {
      return '';
    }
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return url;
  }

  async fetchHtml(url) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(this.config.timeout);

    await page.setRequestInterception(true);
    page.on('request', req => {
      const type = req.resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: this.config.waitUntil });
    const html = await page.content();
    await browser.close();
    return html;
  }

  simplifyHtml(html, url) {
    const $ = cheerio.load(html);

    $('script, noscript, style').remove();
    $('section, article, nav, header, footer, aside').each((_, el) => {
      $(el).replaceWith(`<div>${$(el).html() || ''}</div>`);
    });

    $('img, picture, source, svg').remove();
    $('[style]').each((_, el) => {
      const style = $(el).attr('style');
      if (style) {
        const cleaned = style.replace(/background[^;]+;?/gi, '');
        $(el).attr('style', cleaned);
      }
    });

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

    if (this.config.modes?.includes('simplify')) {
      $('[style]').removeAttr('style');
    }

    if (this.config.modes?.includes('frogfind')) {
      const candidates = [];
      $('main, .content, #content, article').each((_, el) => candidates.push(el));
      $('div').each((_, el) => {
        const textLen = ($(el).text() || '').trim().length;
        if (textLen > 800) {
          candidates.push(el);
        }
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
}
