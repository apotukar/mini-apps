import { HtmlFetcher } from './html-fetcher.js';
import { HtmlSimplifier } from './htm-simplifier.js';
import { normalizeUrl } from './html-utils.js';

/*
  ------------------------------------------------------------
  browser class overview
  ------------------------------------------------------------
  purpose:
    provides a simple interface for:
      - normalizing urls
      - fetching remote html
      - simplifying html into legacy layout

  pipeline:
      user url
         ↓
    normalizeUrl()
         ↓
    fetchHtml()        -> loads html via puppeteer
         ↓
    simplifyHtml()     -> dom preprocessing + structure detection + legacy rendering
         ↓
      output            simplified legacy-style html

  internal components:
      htmlfetcher          handles puppeteer loading
      htmlsimplifier       orchestrates dom cleanup + extraction + rendering
      legacylayoutrenderer builds final html output

  high-level flow:
      browse()
        ├─ normalizeUrl()
        ├─ fetchHtml()
        └─ simplifyHtml()
  ------------------------------------------------------------
*/

export class Browser {
  constructor(config = {}) {
    this.config = {
      timeout: 120000,
      waitUntil: 'networkidle2',
      modes: [],
      ...config
    };

    this.fetcher = new HtmlFetcher(this.config);
    this.simplifier = new HtmlSimplifier({
      fallbackColor: this.config.fallbackColor ?? '#dbeafe'
    });
  }

  buildLegacyHtml(title, content, url) {
    return this.simplifier.buildLegacyHtml(title, content, url);
  }

  simplifyHtml(html, url) {
    return this.simplifier.simplifyHtml(html, url);
  }

  normalizeUrl(input) {
    return normalizeUrl(input);
  }

  async fetchHtml(url) {
    return this.fetcher.fetchHtml(url);
  }

  // TODO
  async browse(url) {
    const normalized = this.normalizeUrl(url);
    const html = await this.fetchHtml(normalized);
    return this.simplifier.simplifyHtml(html, url);
  }
}
