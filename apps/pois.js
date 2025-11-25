import { searchPOIs } from '../helpers/geo/poi-service.js'
import { geocodePlace } from '../helpers/geo/geocode.js'
import { generateStaticMap } from '../helpers/geo/map-generator.js'

export function registerPOIRoutes(app, params) {
  const config = params.config
  const zoom = config.zoom || 15
  const tiles = config.tiles || 3

  app.get('/pois', async (req, res) => {
    const query = req.query.q || ''
    const type = req.query.t || 'apotheke'

    if (!query) {
      return res.render('pois/index.njk', {
        results: [],
        query: '',
        type: type,
        location: null
      })
    }

    try {
      const loc = await geocodePlace(query)
      if (!loc) {
        return res.render('pois/index.njk', {
          results: [],
          query: query,
          type: type,
          location: null
        })
      }

      const results = await searchPOIs(loc, type)
      const resultsWithMap = results.map(r => ({
        ...r,
        mapUrl: r.lat != null && r.lon != null ? `/pois/map?lat=${r.lat}&lon=${r.lon}` : null
      }))

      res.render('pois/index.njk', {
        results: resultsWithMap,
        query: query,
        type: type,
        location: loc
      })
    } catch (err) {
      console.error(err)
      res.render('pois/index.njk', {
        results: [],
        query: query,
        type: type,
        location: null
      })
    }
  })

  app.get('/pois/map', async (req, res) => {
    const lat = parseFloat(req.query.lat)
    const lon = parseFloat(req.query.lon)
    if (isNaN(lat) || isNaN(lon)) return res.status(400).send('invalid')
    try {
      const buf = await generateStaticMap(lat, lon, zoom, tiles)
      res.setHeader('Content-Type', 'image/png')
      res.send(buf)
    } catch (err) {
      console.error(err)
      res.status(500).send('error')
    }
  })
}
