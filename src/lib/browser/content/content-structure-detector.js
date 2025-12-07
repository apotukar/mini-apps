export class ContentStructureDetector {
  detectNavAndContent($) {
    const navBlocks = this.#collectNavBlocks($);
    const contentBlocks = this.#collectContentBlocks($);

    let navBlock = this.#chooseNavBlock(navBlocks);
    let contentBlock = this.#chooseContentBlock(contentBlocks, navBlock);

    if (!contentBlock) {
      const fallbackBlocks = [];
      $('main, article, section, div').each((_, el) => {
        const info = this.#measureBlock($, el);
        if (info) {
          fallbackBlocks.push(info);
        }
      });
      contentBlock = this.#chooseContentBlock(fallbackBlocks, navBlock);
    }

    const navRoot = navBlock ? navBlock.$el : null;
    const contentRoot = contentBlock ? contentBlock.$el : null;

    if (navRoot) {
      navRoot.attr('data-browser-nav-root', '1');
    }
    if (contentRoot) {
      contentRoot.attr('data-browser-content-root', '1');
    }

    return { navRoot, contentRoot };
  }

  #collectNavBlocks($) {
    const blocks = [];
    $('nav, [role="navigation"], [class*="nav"], [class*="menu"], [id*="nav"], [id*="menu"]').each(
      (_, el) => {
        const info = this.#measureBlock($, el);
        if (info) {
          blocks.push(info);
        }
      }
    );
    return blocks;
  }

  #collectContentBlocks($) {
    const blocks = [];
    $(
      'main, article, [id*="content"], [class*="content"], [class*="post"], [class*="entry"], [id*="main"]'
    ).each((_, el) => {
      const info = this.#measureBlock($, el);
      if (info) {
        blocks.push(info);
      }
    });
    return blocks;
  }

  #measureBlock($, el) {
    const $el = $(el);
    const text = $el.text().replace(/\s+/g, ' ').trim();
    if (!text) {
      return null;
    }

    const len = text.length;
    const linkText = $el.find('a').text().replace(/\s+/g, ' ').trim();
    const linkLen = linkText.length;
    const pCount = $el.find('p').length;
    const linkCount = $el.find('a').length;
    const linkDensity = len ? linkLen / len : 0;

    return { $el, len, linkDensity, pCount, linkCount };
  }

  #chooseContentBlock(blocks, navBlock) {
    let best = null;
    let bestScore = 0;

    blocks.forEach(b => {
      if (navBlock && b.$el.is(navBlock.$el)) {
        return;
      }

      if (navBlock && b.$el.has(navBlock.$el).length) {
        return;
      }

      if (navBlock && navBlock.$el.has(b.$el).length) {
        return;
      }

      if (b.len < 200) {
        return;
      }

      if (b.linkDensity > 0.55 && b.linkCount > 5) {
        return;
      }

      const score = b.len + b.pCount * 200 - b.linkDensity * 200;

      if (!best || score > bestScore) {
        best = b;
        bestScore = score;
      }
    });

    return best;
  }

  #chooseNavBlock(blocks) {
    let best = null;
    let bestScore = 0;

    blocks.forEach(b => {
      if (b.linkCount < 3) {
        return;
      }
      if (b.linkDensity < 0.25) {
        return;
      }
      const score = b.linkDensity * 1000 + b.linkCount * 40 - b.pCount * 30 - b.len * 0.05;
      if (!best || score > bestScore) {
        best = b;
        bestScore = score;
      }
    });

    return best;
  }
}
