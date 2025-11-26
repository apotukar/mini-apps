import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

export function registerNewsRoutes(app, params) {
  const config = {
    feeds: {
      'https://www.jungewelt.de/aktuell/newsticker.rss': 100
    },
    limit: 10,
    totalLimit: 100,
    browserProxy: '/browser/browse?url=',
    ...(params.config || {})
  };

  app.get('/news', async (req, res) => {
    try {
      const { items, errors } = await fetchAllFeeds(
        config.feeds,
        config.limit,
        config.totalLimit,
        config.browserProxy
      );
      res.render('news/index.njk', { items, feedErrors: errors });
    } catch (err) {
      res.status(500).send('Fehler beim Laden der Nachrichten: ' + err.message);
    }
  });
}

function stripImages(html) {
  if (!html) return '';
  let cleaned = html.replace(/<img[^>]*>/gi, '');
  cleaned = cleaned.replace(/https?:\/\/\S+\.(jpg|jpeg|png|gif)/gi, '');
  return cleaned;
}

async function fetchAllFeeds(feeds, limit, totalLimit, browserProxy) {
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
    fetchFeed(url, limit, browserProxy, priority)
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
    if (prioA !== prioB) return prioA - prioB;
    return new Date(b.date) - new Date(a.date);
  });

  return {
    items: totalLimit ? results.slice(0, totalLimit) : results,
    errors
  };
}

async function fetchFeed(url, limit, browserProxy, priority = 999) {
  try {
    const res = await fetch(url, { timeout: 8000 }).catch(err => {
      throw new Error(`Netzwerkfehler bei ${url}: ${err.code || err.message}`);
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} beim Laden von ${url}`);
    }

    const xml = await res.text();

    let parsed;
    try {
      parsed = await parseStringPromise(xml, { explicitArray: false });
    } catch (err) {
      throw new Error(`Ungültiges XML bei ${url}: ${err.message}`);
    }

    if (!parsed?.rss?.channel?.item) {
      throw new Error(`Keine Items im Feed: ${url}`);
    }

    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item];

    return items.slice(0, limit).map(item => {
      delete item.enclosure;
      delete item['media:content'];
      delete item['media:thumbnail'];

      const originalLink = item.link;
      const link = browserProxy
        ? `${browserProxy}${encodeURIComponent(originalLink)}`
        : originalLink;

      return {
        title: item.title,
        link,
        date: item.pubDate,
        description: stripImages(item.description),
        source: parsed.rss.channel.title || url,
        priority
      };
    });
  } catch (err) {
    err.feedUrl = url;
    throw err;
  }
}
