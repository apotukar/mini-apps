import fetch from 'node-fetch'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

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

export async function searchPOIs(loc, type) {
  if (!loc) return []

  const latCenter = loc.lat
  const lonCenter = loc.lon
  const radius = 1500

  const poiType =
    {
      apotheke: 'amenity=pharmacy',
      tankstelle: 'amenity=fuel',
      geldautomat: 'amenity=atm',
      arzt: 'amenity=doctors',
      cafe: 'amenity=cafe'
    }[type] || 'amenity=pharmacy'

  const overpassQuery = `[out:json];node[${poiType}](around:${radius},${latCenter},${lonCenter});out body;`

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
    const lat = n.lat != null ? parseFloat(n.lat) : null
    const lon = n.lon != null ? parseFloat(n.lon) : null
    return {
      name: tags.name || 'Unbekannt',
      address: addr,
      lat,
      lon
    }
  })
}
