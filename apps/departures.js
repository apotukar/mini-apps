export function registerDepartureRoutes(app, params) {
  const client = params.client
  const config = params.config || {}
  const transportModeLabels = config.labels || {}
  const transportModeTypes = config.types || {}

  app.get('/departures', (req, res) => {
    const station = req.query.station || ''
    res.render('departures/index.njk', { station })
  })

  app.get(
    '/departures/search',
    handleDeparturesSearch(
      req => req.query.station,
      req => req.query.when
    )
  )

  app.post(
    '/departures/search',
    handleDeparturesSearch(req => req.body.station)
  )

  async function findStationId(name) {
    const list = await client.locations(name, { results: 1 })
    if (!list || list.length === 0) throw new Error('Station nicht gefunden: ' + name)
    return list[0].id
  }

  function buildDeparturesView(stationName, departures) {
    function translateProduct(product) {
      return transportModeLabels[product] || product || ''
    }

    function mapType(product) {
      return transportModeTypes[product] || 'other'
    }

    function formatLine(productGerman, raw) {
      if (!raw) return productGerman
      const cleaned = raw
        .replace(/^STR\s*/i, '')
        .replace(/^BUS\s*/i, '')
        .replace(/^TRAM\s*/i, '')
        .replace(/^SUBWAY\s*/i, '')
        .replace(/^SUBURBAN\s*/i, '')
      const alreadyHasProduct = cleaned.toLowerCase().startsWith(productGerman.toLowerCase())
      if (alreadyHasProduct) return cleaned
      if (/^\d+/.test(cleaned)) return `${productGerman} ${cleaned}`
      if (/^[SU]\s*\d+/i.test(cleaned)) return cleaned
      return `${productGerman} ${cleaned}`
    }

    const items = departures.map(dep => {
      const when = dep.when || dep.plannedWhen
      const d = when ? new Date(when) : null
      const line = dep.line || {}
      const productRaw = line.product || line.mode || ''
      const productGerman = translateProduct(productRaw)
      const type = mapType(productRaw)
      const lineName = line.name || line.label || line.id || ''
      const lineText = formatLine(productGerman, lineName)

      return {
        time: d ? d : '–',
        direction: dep.direction || '',
        lineText,
        platform: dep.platform || dep.plannedPlatform || '',
        type,
        rawWhen: when
      }
    })

    const validTimes = items
      .map(i => i.rawWhen)
      .filter(Boolean)
      .map(w => new Date(w))
      .sort((a, b) => a - b)

    let earlierIso = null
    let laterIso = null

    if (validTimes.length > 0) {
      const first = validTimes[0]
      const last = validTimes[validTimes.length - 1]
      const halfHour = 30 * 60 * 1000
      earlierIso = new Date(first.getTime() - halfHour).toISOString()
      laterIso = new Date(last.getTime() + halfHour).toISOString()
    }

    const cleanedItems = items.map(({ rawWhen, ...rest }) => rest)

    return {
      stationName,
      departures: cleanedItems,
      earlierIso,
      laterIso
    }
  }

  async function fetchDeparturesView(stationName, when) {
    const stationId = await findStationId(stationName)
    const opts = { duration: 60, results: 10 }
    if (when) {
      const d = new Date(when)
      if (!Number.isNaN(d.getTime())) opts.when = d
    }

    const data = await client.departures(stationId, opts)

    const departures = Array.isArray(data)
      ? data
      : data && Array.isArray(data.departures)
        ? data.departures
        : []

    if (!departures.length) return null
    return buildDeparturesView(stationName, departures)
  }

  function handleDeparturesSearch(getStationName, getWhen) {
    return async (req, res) => {
      try {
        const stationName = (getStationName(req) || '').trim()
        if (!stationName) return res.redirect('/departures')

        const when = getWhen ? getWhen(req) : undefined
        const view = await fetchDeparturesView(stationName, when)

        if (!view) {
          return res.render('departures/no-results.njk', { stationName })
        }

        return res.render('departures/results.njk', view)
      } catch (err) {
        return res.render('departures/error.njk', { message: err.message })
      }
    }
  }
}
