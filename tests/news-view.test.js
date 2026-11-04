import assert from 'node:assert/strict';
import test from 'node:test';
import nunjucks from 'nunjucks';
import * as cheerio from 'cheerio';

for (const isNS4 of [false, true]) {
  test(`news list preserves its content ${isNS4 ? 'with NS4 centering' : 'without a legacy table'}`, () => {
    const env = new nunjucks.Environment(new nunjucks.FileSystemLoader('src/views/default'), {
      autoescape: true
    });
    env.addFilter('split', (value, separator) => (value || '').split(separator));
    env.addFilter('formatWeekday', () => 'Mi.');
    env.addFilter('formatDateTime', () => '04.11.2026');
    const proxy = '/browser/browse?url=';
    const html = env.render('news/index.njk', {
      isNS4,
      viewExt: isNS4 ? 'ns4' : 'njk',
      pageUrl: '/news',
      proxies: [{ link: proxy, description: 'RetroFit' }],
      currentProxy: proxy,
      items: [
        {
          title: 'Nachricht & Meldung',
          link: '/browser/browse?url=https%3A%2F%2Fexample.org',
          date: '2026-11-04T12:00:00Z',
          description: '<b>Kurzmeldung</b>',
          source: 'Beispiel'
        }
      ]
    });
    const $ = cheerio.load(html);
    const table = $('table[align="center"][width="560"]');
    assert.equal(table.length, isNS4 ? 1 : 0);
    if (isNS4) {
      assert.equal(table.find('td[align="left"] h2').text(), 'News');
      assert.equal(table.find('form').length, 1);
      assert.equal(table.find('li').length, 1);
    }
    assert.equal($('option[selected]').attr('value'), proxy);
    assert.equal($('li a').text(), 'Nachricht & Meldung');
    assert.equal($('li a').attr('href'), '/browser/browse?url=https%3A%2F%2Fexample.org');
    assert.match($('li').text(), /Mi\. 04\.11\.2026/);
    assert.equal($('li small b').text(), 'Kurzmeldung');
    assert.equal($('.source-label').text(), 'Beispiel');
    assert.equal($('input[type="submit"]').length, isNS4 ? 1 : 0);
    assert.equal($('button[type="submit"]').length, isNS4 ? 0 : 1);
  });
}
