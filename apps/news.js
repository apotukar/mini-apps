import fetch from 'node-fetch'
import { parseStringPromise } from 'xml2js'

export function registerNewsRoutes(app, params) {
  const config = {
    feeds: ['https://www.tagesschau.de/xml/rss2/'],
    limit: 10,
    browserProxy: '/browser/browse?url=',
    ...(params.config || {})
  }

  app.get('/news', async (req, res) => {
    try {
      const items = await fetchAllFeeds(config.feeds, config.limit, config)
      res.render('news/index.njk', { items })
    } catch (err) {
      console.error(err)
      res.send('Fehler beim Laden der Nachrichten: ' + err.message)
    }
  })
}

function stripImages(html) {
  if (!html) return ''
  let cleaned = html.replace(/<img[^>]*>/gi, '')
  cleaned = cleaned.replace(/https?:\/\/\S+\.(jpg|jpeg|png|gif)/gi, '')
  return cleaned
}

async function fetchFeed(url, limit, config) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Konnte Feed nicht laden: ${url}`)

  const xml = await res.text()
  const parsed = await parseStringPromise(xml, { explicitArray: false })

  if (!parsed.rss || !parsed.rss.channel || !parsed.rss.channel.item) {
    return []
  }

  const items = Array.isArray(parsed.rss.channel.item)
    ? parsed.rss.channel.item
    : [parsed.rss.channel.item]

  return items.slice(0, limit).map(item => {
    delete item.enclosure
    delete item['media:content']
    delete item['media:thumbnail']

    const originalLink = item.link
    const link = config.browserProxy
      ? `${config.browserProxy}${encodeURIComponent(originalLink)}`
      : originalLink

    return {
      title: item.title,
      link,
      date: item.pubDate,
      description: stripImages(item.description),
      source: parsed.rss.channel.title
    }
  })
}

async function fetchAllFeeds(feeds, limit, config) {
  const results = []
  for (const url of feeds) {
    try {
      const items = await fetchFeed(url, limit, config)
      results.push(...items)
    } catch (err) {
      console.error('Feed-Fehler:', url, err.message)
    }
  }
  return results.sort((a, b) => new Date(b.date) - new Date(a.date))
}
