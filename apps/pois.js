import fetch from 'node-fetch'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export function registerPOIRoutes(app) {
  app.get('/pois', async (req, res) => {
    const q = req.query.q || ''
    const t = req.query.t || 'apotheke'

    if (!q) {
      return res.render('pois/index.njk', {
        results: [],
        query: '',
        type: t
      })
    }

    try {
      const results = await searchPOIs(q, t)
      res.render('pois/index.njk', {
        results,
        query: q,
        type: t
      })
    } catch (err) {
      console.error(err)
      res.render('pois/index.njk', {
        results: [],
        query: q,
        type: t
      })
    }
  })
}

function formatAddress(tags) {
  const street = tags['addr:street'] || ''
  const number = tags['addr:housenumber'] || ''
  const city = tags['addr:city'] || ''
  const pc = tags['addr:postcode'] || ''

  const line1 = street && number ? `${street} ${number}` : street || ''
  const line2 = pc && city ? `${pc} ${city}` : city || ''

  if (!line1 && !line2) return null
  return [line1, line2].filter(Boolean).join(', ')
}

async function geocodePlace(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&q=' +
    encodeURIComponent(query) +
    '&limit=1'
  const res = await fetch(url, { headers: { 'User-Agent': 'Mini-Apps' } })
  if (!res.ok) return null
  const json = await res.json()
  if (!json || !json[0]) return null
  return { lat: json[0].lat, lon: json[0].lon }
}

async function searchPOIs(query, type) {
  const loc = await geocodePlace(query)
  if (!loc) return []

  const lat = loc.lat
  const lon = loc.lon
  const radius = 1500

  const poiType =
    {
      apotheke: 'amenity=pharmacy',
      tankstelle: 'amenity=fuel',
      geldautomat: 'amenity=atm',
      arzt: 'amenity=doctors',
      cafe: 'amenity=cafe'
    }[type] || 'amenity=pharmacy'

  const overpassQuery =
    `[out:json];` + `node[${poiType}](around:${radius},${lat},${lon});` + `out body;`

  const body = new URLSearchParams()
  body.set('data', overpassQuery)

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  if (!res.ok) return []

  const json = await res.json()
  if (!json.elements) return []

  return json.elements.map(n => {
    const tags = n.tags || {}
    const addr = formatAddress(tags)
    return {
      name: tags.name || 'Unbekannt',
      address: addr,
      lat: n.lat || null,
      lon: n.lon || null
    }
  })
}
