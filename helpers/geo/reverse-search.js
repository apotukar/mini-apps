export async function reverseSearch(lat, lon, apiKey, retries = 2) {
  const url = new URL('https://eu1.locationiq.com/v1/reverse')
  url.searchParams.set('key', String(apiKey))
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')

  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url.toString())

    if (res.ok) {
      const data = await res.json()
      const addr = data.address || {}
      const line1 = [addr.road, addr.house_number].filter(Boolean).join(' ')
      const line2 = [addr.postcode, addr.city].filter(Boolean).join(' ')
      return [line1, line2].filter(Boolean).join(', ') || null
    }

    await new Promise(r => setTimeout(r, 400))
  }

  return null
}
