import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const file of ['style-hack.js', 'style-hack.min.js']) {
  test(`${file} detects Opera 10 and preserves other browser behavior`, () => {
    const source = readFileSync(new URL(`../src/public/js/${file}`, import.meta.url), 'utf8');
    const cases = [
      ['Opera/9.80 (Windows 98; U; de) Presto/2.6.30 Version/10.63', 'is-old-opera'],
      ['Opera/9.80 (Windows NT 6.1; U; de) Presto/2.12.388 Version/12.18', ''],
      ['Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0', ''],
      ['Mozilla/5.0 Firefox/2.0.0.20', 'is-old-gecko'],
      ['Mozilla/5.0 SeaMonkey/1.1.19', 'is-old-gecko'],
      ['Mozilla/5.0 Firefox/130.0', '']
    ];
    for (const [userAgent, expected] of cases) {
      const root = { className: 'existing' };
      const context = {
        document: { documentElement: root },
        navigator: { userAgent }
      };
      vm.runInNewContext(source, context);
      vm.runInNewContext(source, context);
      assert.equal(root.className, expected ? `existing ${expected}` : 'existing');
    }
    const root = { className: '' };
    vm.runInNewContext(source, {
      document: { layers: {}, documentElement: root },
      navigator: { userAgent: cases[0][0] }
    });
    assert.equal(root.className, '');
  });
}
