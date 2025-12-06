import puppeteer from 'puppeteer';

export class HtmlFetcher {
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
    } finally {
      await browser.close();
    }
  }
}
