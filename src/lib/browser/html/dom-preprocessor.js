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
      'source',
      '.td_module_related_posts',
      '.related-posts',
      '.related-post',
      '[class*="related_posts"]',
      '[class*="related-articles"]'
    ].join(',');

    $(selectors).remove();
    $('picture, figure').each((_, element) => {
      element.name = 'div';
    });
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

  // Keep real data tables, but unwrap tables used only for page layout.
  flattenLayoutTables($) {
    $('table').each((_, element) => {
      const table = $(element);
      if (table.find('th, caption').length) {
        return;
      }
      table.find('td, tr, tbody, thead, tfoot').each((_, child) => {
        child.name = 'div';
      });
      element.name = 'div';
    });
  }

  // removes unnecessary attributes and rewrites links/forms
  cleanAttributes($) {
    const markerAttrs = ['data-browser-nav-root', 'data-browser-content-root'];

    $('img').each((_, element) => {
      const image = $(element);
      const alt = (image.attr('alt') || '').replace(/\s+/g, ' ').trim();
      const isCloseIcon =
        /^[x×✕✖⨯]$/i.test(alt) ||
        /\b(?:schlie(?:ß|ss)en|dismiss)\b/i.test(alt) ||
        /\bclose\b(?![- ]?up\b)/i.test(alt);
      const isAnimation = /\b(?:animiert\w*|animated|animation\w*)\b/i.test(alt);
      if (isCloseIcon || isAnimation) {
        image.remove();
        return;
      }
      const source = image.attr('src') || '';
      if (!/^https?:\/\//i.test(source) || /\.(?:avif|svg)(?:[?#]|$)/i.test(source)) {
        const isFilename = /\.(?:jpe?g|gif|png|webp|avif|svg)(?:[?#].*)?$/i.test(alt);
        if (alt && !isFilename) {
          image.replaceWith($('<span></span>').text(alt));
        } else {
          image.remove();
        }
        return;
      }
      image.attr('src', '/browser/image?url=' + encodeURIComponent(source));
      const width = Number(image.attr('width'));
      const height = Number(image.attr('height'));
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        const scale = Math.min(1, 480 / width);
        image.attr('width', Math.max(1, Math.round(width * scale)));
        image.attr('height', Math.max(1, Math.round(height * scale)));
      } else {
        image.attr('width', '480');
        image.removeAttr('height');
      }
    });

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
      const keep =
        tag === 'a'
          ? ['href']
          : tag === 'form'
            ? ['action', 'method']
            : tag === 'img'
              ? ['src', 'alt', 'width', 'height']
              : [];

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
