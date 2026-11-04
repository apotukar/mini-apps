import puppeteer from 'puppeteer-core';
import { sleep } from '../../sleep.js';

export class ContentFetcher {
  constructor(config = {}) {
    this.timeout = config.timeout ?? 120000;
    this.waitUntil = config.waitUntil ?? 'networkidle2';
  }

  async fetchHtml(url) {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(this.timeout);
      await page.goto(url, { waitUntil: this.waitUntil });
      await page.evaluate(() => {
        document.querySelectorAll('img').forEach(image => {
          // Responsive duplicates must be filtered while the original CSS still applies.
          const visibility = getComputedStyle(image).visibility;
          if (visibility === 'hidden' || visibility === 'collapse') {
            image.remove();
            return;
          }
          for (let element = image; element; element = element.parentElement) {
            if (element.hidden || getComputedStyle(element).display === 'none') {
              image.remove();
              return;
            }
          }
          const loadedSource = image.currentSrc;
          const candidates = [
            image.getAttribute('data-src'),
            image.getAttribute('data-original'),
            image.getAttribute('data-lazy-src'),
            loadedSource,
            image.getAttribute('src')
          ]
            .filter(Boolean)
            .map(value => {
              try {
                return new URL(value, document.baseURI).href;
              } catch {
                return '';
              }
            })
            .filter(value => /^https?:\/\//i.test(value));
          const source =
            candidates.find(value => /\.(?:jpe?g|gif|png)(?:[?#]|$)/i.test(value)) || candidates[0];
          if (source) {
            image.setAttribute('src', source);
          }
          if (source === loadedSource && image.naturalWidth && image.naturalHeight) {
            image.setAttribute('width', image.naturalWidth);
            image.setAttribute('height', image.naturalHeight);
          }
        });
      });
      const html = await page.content();

      return html;
    } catch (error) {
      console.error(error);
      if (error.message && error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
        return `${url} is no valid url`;
      }
      return 'error';
    } finally {
      await browser.close();
    }
  }

  async searchDuckDuckGoLite(query) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9',
      Referer: 'https://duckduckgo.com/',
      DNT: '1'
    };

    try {
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(headers);
      page.setDefaultNavigationTimeout(this.timeout);

      await page.goto('https://lite.duckduckgo.com/lite/', {
        waitUntil: this.waitUntil
      });
      await sleep(2000);
      await page.type('input[name="q"]', query);
      await sleep(2000);
      await Promise.all([
        page.click('input[type="submit"]'),
        page.waitForNavigation({ waitUntil: this.waitUntil })
      ]);
      const html = await page.content();

      return html;
    } finally {
      await browser.close();
    }
  }
}
