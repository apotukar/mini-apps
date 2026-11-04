import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';
import { Readability } from '@mozilla/readability';

import { ContentFetcher } from '../lib/browser/content/content-fetcher.js';
import { ContentStructureDetector } from '../lib/browser/content/content-structure-detector.js';
import { normalizeUrl } from '../lib/browser/html/html-utils.js';
import { DomPreprocessor } from '../lib/browser/html/dom-preprocessor.js';

export class BrowserService {
  constructor(config = {}) {
    this.config = {
      timeout: 120000,
      waitUntil: 'networkidle2',
      readMode: false,
      modes: [],
      ...config
    };

    this.contentFetcher = new ContentFetcher(this.config);
    this.domPreprocessor = new DomPreprocessor();
    this.contentAndStructureDetector = new ContentStructureDetector();
  }

  async browse(url, localUrl) {
    const normalizedUrl = normalizeUrl(url);
    const normalizedLocalUrl = normalizeUrl(localUrl);
    const html = await this.contentFetcher.fetchHtml(normalizedUrl);
    return this.#simplifyHtml(html, normalizedUrl, normalizedLocalUrl);
  }

  async search(query, localUrl) {
    const normalizedLocalUrl = normalizeUrl(localUrl);
    const html = await this.contentFetcher.searchDuckDuckGoLite(query);
    const $ = cheerio.load(html);

    const results = [];

    $('table')
      .last()
      .find('tr')
      .has('a.result-link')
      .each((index, element) => {
        const row = $(element);
        const linkElement = row.find('a.result-link');
        const url = linkElement.attr('href');
        const title = linkElement.text().trim();

        // Snippet/Description aus dem nächsten tr mit Klasse result-snippet
        const snippetRow = row.next();
        let snippet = '';
        if (snippetRow.hasClass('result-snippet') || snippetRow.find('.result-snippet').length) {
          snippet = snippetRow.find('.result-snippet').text().trim() || snippetRow.text().trim();
        }

        // URL aus dem link-text span
        const displayUrl = row
          .nextAll()
          .filter(function () {
            return $(this).find('.link-text').length;
          })
          .first()
          .find('.link-text')
          .text()
          .trim();

        if (url && title) {
          results.push({
            url: url,
            title: title,
            snippet: snippet,
            displayUrl: displayUrl
          });
        }
      });

    const simpleHtml = this.#createSimpleHTML(results, normalizedLocalUrl);
    return simpleHtml;
  }

  // full simplification pipeline: preprocess → detect structure → normalize → render
  #simplifyHtml(html, url, localUrl) {
    // Sanitizing the page body removes the document's <title> element.
    const title = this.#extractTitle(cheerio.load(html), url);
    const windowForPurify = new JSDOM('').window;
    const domPurify = createDOMPurify(windowForPurify);
    const cleanHtml = domPurify.sanitize(html);
    const $ = cheerio.load(cleanHtml);

    // fix relative urls and remove unwanted elements
    this.domPreprocessor.absolutizeUrls($, url);
    this.domPreprocessor.removeUnwanted($);

    // detect navigation/content blocks
    const { navRoots } = this.contentAndStructureDetector.detectNavAndContent($);

    // Collect menu links independently of the original site's layout.
    const navigation = $('<ul></ul>');
    const seenLinks = new Set();
    navRoots.forEach($root => {
      $root.find('a[href]').each((_, element) => {
        const link = $(element);
        const href = link.attr('href');
        const label = link.text().replace(/\s+/g, ' ').trim();
        if (!/^https?:\/\//i.test(href) || !label || seenLinks.has(href)) {
          return;
        }
        seenLinks.add(href);
        navigation.append($('<li></li>').append($('<a></a>').attr('href', href).text(label)));
      });
    });
    navRoots.forEach($root => $root.remove());

    // flatten semantic tags and clean attributes
    this.domPreprocessor.flattenSemanticTags($);
    this.domPreprocessor.flattenLayoutTables($);
    this.domPreprocessor.cleanAttributes($);

    const $navigation = cheerio.load(navigation.toString());
    this.domPreprocessor.cleanAttributes($navigation);

    // Re-select after flattening: replacing semantic tags invalidates old references.
    const contentRoot = $('[data-browser-content-root]').first();
    const navHtml = seenLinks.size ? $navigation('body').html() : '';
    const contentHtml = contentRoot?.html() || this.domPreprocessor.extractBody($);

    if (this.config.readMode) {
      const dom = new JSDOM(contentHtml, { url: localUrl });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      return {
        url,
        title,
        navHtml,
        contentHtml: article.content
      };
    }

    return {
      url,
      title,
      navHtml,
      contentHtml: contentHtml
    };
  }

  #createSimpleHTML = (results, url) => {
    let html = '<ul>\n';
    results.forEach(result => {
      html += '  <li>\n';
      html += `    <a href="${url}/browser/browse?url=${encodeURIComponent(result.url)}"><strong>${result.title}</strong></a><br>\n`;
      html += `    <small>${result.displayUrl || result.url}</small><br>\n`;
      if (result.snippet) {
        html += `    <p>${result.snippet}</p>\n`;
      }
      html += '  </li>\n';
    });
    html += '</ul>';

    return html;
  };

  // extracts title from <title> or falls back to url
  #extractTitle($, url) {
    const t = $('title').first().text().trim();
    return t || url?.replace(/^https?:\/\//i, '') || '';
  }
}
