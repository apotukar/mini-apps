import Parser from 'rss-parser';

export class FeedsService {
  constructor() {
    this.parser = new Parser();
  }

  async fetchAllFeeds(feeds, limit, totalLimit, browserProxy) {
    const results = [];
    const errors = [];
    const feedList = [];

    if (Array.isArray(feeds)) {
      for (const url of feeds) {
        feedList.push({ url, priority: 999 });
      }
    } else if (feeds && typeof feeds === 'object') {
      for (const [url, priority] of Object.entries(feeds)) {
        feedList.push({ url, priority: Number(priority) || 999 });
      }
    }

    const promises = feedList.map(({ url, priority }) =>
      this.#fetchFeed(url, limit, browserProxy, priority)
        .then(items => items)
        .catch(err => {
          errors.push({ url, message: err.message });
          return [];
        })
    );

    const allItems = await Promise.all(promises);

    for (const items of allItems) {
      results.push(...items);
    }

    results.sort((a, b) => {
      const prioA = a.priority ?? 999;
      const prioB = b.priority ?? 999;
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      return new Date(b.date) - new Date(a.date);
    });

    return {
      items: totalLimit ? results.slice(0, totalLimit) : results,
      errors
    };
  }

  async #fetchFeed(url, limit = 10, browserProxy, priority = 999) {
    const feed = await this.parser.parseURL(url);

    return feed.items.slice(0, limit).map(item => {
      const originalLink = item.link;
      const link =
        browserProxy && originalLink
          ? `${browserProxy}${encodeURIComponent(originalLink)}`
          : originalLink;

      return {
        title: item.title,
        link,
        date: item.pubDate || item.isoDate,
        description: this.#stripImages(item.contentSnippet || item.content || ''),
        source: feed.title || url,
        priority
      };
    });
  }

  #stripImages(html) {
    if (!html) {
      return '';
    }
    let cleaned = html.replace(/<img[^>]*>/gi, '');
    cleaned = cleaned.replace(/https?:\/\/\S+\.(jpg|jpeg|png|gif)/gi, '');
    return cleaned;
  }
}
