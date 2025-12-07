import puppeteer from 'puppeteer';
import { sleep } from '../../sleep.js';

export class ContentFetcher {
  constructor(config = {}) {
    this.timeout = config.timeout ?? 120000;
    this.waitUntil = config.waitUntil ?? 'networkidle2';
  }

  async fetchHtml(url) {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(this.timeout);
      await page.goto(url, { waitUntil: this.waitUntil });
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
