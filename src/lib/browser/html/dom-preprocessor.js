export class DomPreprocessor {
  absolutizeUrls($, baseUrl) {
    if (!baseUrl) {
      return;
    }

    const attrs = [
      { sel: 'a[href]', attr: 'href' },
      { sel: 'link[href]', attr: 'href' },
      { sel: 'img[src]', attr: 'src' },
      { sel: 'script[src]', attr: 'src' },
      { sel: 'iframe[src]', attr: 'src' },
      { sel: 'form[action]', attr: 'action' }
    ];

    attrs.forEach(({ sel, attr }) => {
      $(sel).each((_, el) => {
        const $el = $(el);
        const value = $el.attr(attr);
        if (!value) {
          return;
        }
        try {
          const absolute = new URL(value, baseUrl).href;
          $el.attr(attr, absolute);
        } catch (error) {
          console.error(`error absolutizing url: ${error.message}`);
        }
      });
    });
  }

  removeUnwanted($) {
    const selectors = [
      'script',
      'noscript',
      'style',
      'iframe',
      'link[rel="stylesheet"]',
      'svg',
      'object[type*="svg"]',
      'embed[type*="svg"]',
      'img',
      'picture',
      'figure',
      '.td_module_related_posts',
      '.related-posts',
      '.related-post',
      '[class*="related_posts"]',
      '[class*="related-articles"]'
    ].join(',');

    $(selectors).remove();
  }

  // replaces semantic tags with plain <div> elements
  flattenSemanticTags($) {
    $('section, article, nav, header, footer, aside, main').each((_, el) => {
      const $el = $(el);
      const attrs = $el.attr() || {};
      const html = $el.html() || '';

      const $div = $('<div></div>');
      Object.keys(attrs).forEach(name => {
        $div.attr(name, attrs[name]);
      });

      $div.html(html);
      $el.replaceWith($div);
    });
  }

  // removes unnecessary attributes and rewrites links/forms
  cleanAttributes($) {
    const markerAttrs = ['data-browser-nav-root', 'data-browser-content-root'];

    // sanitize anchor tags
    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) {
        return;
      }
      try {
        if (/^https?:\/\//i.test(href)) {
          const wrapped = '/browser/browse?url=' + encodeURIComponent(href);
          $el.attr('href', wrapped);
        } else {
          $el.removeAttr('href');
        }
      } catch {
        $el.removeAttr('href');
      }
    });

    // sanitize form actions
    $('form').each((_, el) => {
      const $el = $(el);
      const action = $el.attr('action') || '';
      if (action) {
        try {
          if (/^https?:\/\//i.test(action)) {
            const wrapped = '/browser/browse?url=' + encodeURIComponent(action);
            $el.attr('action', wrapped);
          } else {
            $el.removeAttr('action');
          }
        } catch {
          $el.removeAttr('action');
        }
      }
      $el.attr('method', 'get');
    });

    // remove all attributes except whitelisted ones
    $('*').each((_, el) => {
      const $el = $(el);
      const node = $el[0];
      const tag = node && node.name ? node.name.toLowerCase() : '';
      const attrs = $el.attr() || {};
      const keep = tag === 'a' ? ['href'] : tag === 'form' ? ['action', 'method'] : [];

      Object.keys(attrs).forEach(name => {
        if (!keep.includes(name) && !markerAttrs.includes(name)) {
          $el.removeAttr(name);
        }
      });
    });
  }

  // returns body html or entire root html as fallback
  extractBody($) {
    return $('body').length ? $('body').html() : $.root().html();
  }
}
