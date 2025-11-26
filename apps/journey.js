import {
  getFavorites,
  saveFavorites,
  clearFavorites,
  getHideFlag,
  setHideFlag,
  clearHideFlag,
  dedupeFavs
} from '../helpers/favorites.js'

export function registerJourneyRoutes(app, params) {
  const client = params.client
  const config = params.config || {}
  const favoritesNamespace = 'journey'
  const configFavorites = Array.isArray(config.favorites) ? config.favorites : []

  app.get('/journey', (req, res) => {
    let favorites = getFavorites(req, favoritesNamespace)
    if (!getHideFlag(req, favoritesNamespace)) {
      favorites = dedupeFavs([...favorites, ...configFavorites])
      saveFavorites(res, favorites, favoritesNamespace)
      setHideFlag(res, favoritesNamespace)
    }

    const from = req.query.from || ''
    const to = req.query.to || ''

    res.render('journey/index.njk', {
      from,
      to,
      favs: favorites
    })
  })

  app.post('/journey/save-fav', (req, res) => {
    const fromName = (req.body.from || '').trim()
    const toName = (req.body.to || '').trim()
    if (!fromName && !toName) {
      return res.redirect('/journey')
    }

    let favorites = getFavorites(req, favoritesNamespace)
    favorites = dedupeFavs([{ from: fromName, to: toName }, ...favorites])
    saveFavorites(res, favorites, favoritesNamespace)

    res.redirect(`/journey?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`)
  })

  app.get('/journey/clear-favs', (req, res) => {
    clearFavorites(res, favoritesNamespace)
    res.redirect('/journey')
  })

  app.get('/journey/show-config-favs', (req, res) => {
    clearHideFlag(res, favoritesNamespace)
    res.redirect('/journey')
  })

  app.post(
    '/journey/search',
    createJourneyHandler(req => ({
      fromName: req.body.from,
      toName: req.body.to
    }))
  )

  app.get(
    '/journey/search',
    createJourneyHandler(req => ({
      fromName: req.query.from,
      toName: req.query.to,
      departure: req.query.departure || null,
      earlierThan: (req.query.earlierThan || '').trim() || null,
      laterThan: (req.query.laterThan || '').trim() || null
    }))
  )

  function createJourneyHandler(params) {
    return async (req, res) => {
      const {
        fromName,
        toName,
        departure = null,
        earlierThan = null,
        laterThan = null
      } = params(req)

      await handleJourneySearch({
        res,
        client,
        fromName: (fromName || '').trim(),
        toName: (toName || '').trim(),
        departure,
        earlierThan,
        laterThan
      })
    }
  }
}

async function findStationId(client, name) {
  const list = await client.locations(name, { results: 1 })
  if (!list || list.length === 0) throw new Error('Station nicht gefunden: ' + name)
  return list[0].id
}

function buildJourneyView(journey, index) {
  const legs = journey.legs || []
  if (!legs.length) return null

  const firstLeg = legs[0]
  const lastLeg = legs[legs.length - 1]

  const dep = new Date(firstLeg.departure)
  const arr = new Date(lastLeg.arrival)

  const durationMinutes = ((arr - dep) / 60000).toFixed(0)
  const transfers = Math.max(0, legs.length - 1)

  const legsView = legs.map((leg, idx) => {
    const legDep = leg.departure ? new Date(leg.departure) : null
    const legArr = leg.arrival ? new Date(leg.arrival) : null

    const line = leg.line || {}
    const product = line.product || line.mode || ''
    const lineName = line.name || line.label || line.id || ''
    const lineText = [product, lineName].filter(Boolean).join(' ')

    return {
      idx: idx + 1,
      originName: leg.origin?.name || '',
      destName: leg.destination?.name || '',
      depTime: legDep
        ? legDep.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '–',
      arrTime: legArr
        ? legArr.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '–',
      lineText
    }
  })

  return {
    number: index + 1,
    departure: dep,
    arrival: arr,
    duration: durationMinutes,
    transfers,
    legs: legsView
  }
}

async function handleJourneySearch({
  res,
  client,
  fromName,
  toName,
  departure,
  earlierThan,
  laterThan
}) {
  try {
    if (!fromName || !toName) {
      return res.redirect('/journey')
    }

    const fromId = await findStationId(client, fromName)
    const toId = await findStationId(client, toName)

    const options = { results: 5 }

    if (earlierThan) options.earlierThan = earlierThan
    else if (laterThan) options.laterThan = laterThan
    else if (departure) options.departure = departure

    const data = await client.journeys(fromId, toId, options)
    const journeys = data.journeys || []

    if (!journeys.length) {
      return res.render('journey/no-results.njk', {
        fromName,
        toName
      })
    }

    const journeysView = journeys.map((journey, i) => buildJourneyView(journey, i)).filter(Boolean)

    return res.render('journey/results.njk', {
      fromName,
      toName,
      journeys: journeysView,
      earlierRef: data.earlierRef || null,
      laterRef: data.laterRef || null
    })
  } catch (err) {
    return res.render('journey/error.njk', {
      message: err.message
    })
  }
}
