import assert from 'node:assert/strict';
import test from 'node:test';
import * as cheerio from 'cheerio';
import { BrowserService } from '../src/services/browser-service.js';
import { ContentStructureDetector } from '../src/lib/browser/content/content-structure-detector.js';

test('browser keeps the article image outside the nested main area', async () => {
  const service = new BrowserService();
  service.contentFetcher.fetchHtml = async () => `
    <html><body>
      <nav><a href="/">Start</a><a href="/news">News</a><a href="/contact">Kontakt</a></nav>
      <article class="td-post-template-3">
        <div class="td-post-header">
          <div class="td-post-featured-image">
            <a href="/uploads/duru.jpg"><img src="/uploads/duru.jpg" width="1068" height="575"></a>
          </div>
          <header><h1>Dennis Duru verlängert bis 2029</h1></header>
        </div>
        <div class="td-container"><div role="main">
          <div class="td-post-content"><p>Dennis Duru trainiert bei den Profis mit.</p></div>
        </div></div>
      </article>
      <aside><img src="/advertisement.jpg"><p>Werbung außerhalb des Artikels</p></aside>
    </body></html>`;

  const result = await service.browse('https://sechzger.de/duru/', 'http://localhost');
  const $ = cheerio.load(result.contentHtml);

  assert.equal($('h1').text(), 'Dennis Duru verlängert bis 2029');
  assert.equal($('img').length, 1);
  assert.equal(
    $('img').attr('src'),
    '/browser/image?url=' + encodeURIComponent('https://sechzger.de/uploads/duru.jpg')
  );
  assert.equal($('img').attr('width'), '480');
  assert.match($('p').text(), /Dennis Duru trainiert/);
  assert.doesNotMatch(result.contentHtml, /Werbung außerhalb/);
  assert.match(result.navHtml, /Kontakt/);
});

test('structure detection keeps a standalone main area without including surrounding images', () => {
  const $ = cheerio.load(`
    <header><img src="/logo.png"></header>
    <main><h1>Nachrichten</h1><article><p>Erster Beitrag</p></article></main>
    <aside><img src="/advertisement.jpg"></aside>`);

  const { contentRoot } = new ContentStructureDetector().detectNavAndContent($);

  assert.equal(contentRoot[0].name, 'main');
  assert.equal(contentRoot.find('article').length, 1);
  assert.equal(contentRoot.find('img').length, 0);
});

test('structure detection leaves an article with role main as the content root', () => {
  const $ = cheerio.load('<article role="main"><h1>Artikel</h1><img src="/photo.jpg"></article>');

  const { contentRoot } = new ContentStructureDetector().detectNavAndContent($);

  assert.equal(contentRoot[0].name, 'article');
  assert.equal(contentRoot.find('img').length, 1);
});
