import * as cheerio from 'cheerio';
import { DomPreprocessor } from './dom-preprocessor.js';
import { ContentStructureDetector } from './content-structure-decorator.js';
import { LegacyLayoutRenderer } from './legacy-layout-renderer.js';

export class HtmlSimplifier {
  constructor(options = {}) {
    // dom cleanup utilities
    this.pre = new DomPreprocessor();

    // detects navigation and main content blocks
    this.detector = new ContentStructureDetector();

    // renders the final legacy-style html
    this.renderer = new LegacyLayoutRenderer({
      fallbackColor: options.fallbackColor ?? '#dbeafe'
    });
  }

  // builds a legacy-style html output from title + content
  buildLegacyHtml(title, content, url) {
    return this.renderer.buildLegacyHtml({
      title,
      url,
      navHtml: '',
      contentHtml: content
    });
  }

  // full simplification pipeline: preprocess → detect structure → normalize → render
  simplifyHtml(html, url) {
    const $ = cheerio.load(html);

    // fix relative urls and remove unwanted elements
    this.pre.absolutizeUrls($, url);
    this.pre.removeUnwanted($);

    // extract document title and detect navigation/content blocks
    const title = this.extractTitle($, url);
    const { navRoot, contentRoot } = this.detector.detectNavAndContent($);

    // flatten semantic tags and clean attributes
    this.pre.flattenSemanticTags($);
    this.pre.cleanAttributes($);

    // remove images for a cleaner legacy layout
    $('img, picture, figure').remove();

    // remove navigation block if it appears inside content
    if (navRoot && contentRoot && contentRoot.has(navRoot).length) {
      navRoot.remove();
    }

    // extract html of nav/content or use body as fallback
    const navHtml = navRoot?.html() || '';
    const contentHtml = contentRoot?.html() || this.pre.extractBody($);

    // produce the final legacy-style html
    return this.renderer.buildLegacyHtml({
      title,
      url,
      navHtml,
      contentHtml
    });
  }

  // extracts title from <title> or falls back to url
  extractTitle($, url) {
    const t = $('title').first().text().trim();
    return t || url?.replace(/^https?:\/\//i, '') || '';
  }
}
