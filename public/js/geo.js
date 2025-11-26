async function getPostalCodeFromCoords(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'YourAppName/1.0' // Nominatim verlangt das
    }
  })

  const data = await res.json()

  return data.address.postcode || null
}

function getLocationAndFillPostalCode() {
  const input = document.querySelector('input[name="q"]')

  if (!input || input.value.trim() !== '') {
    return
  }

  if (!('geolocation' in navigator)) {
    return
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const plz = await getPostalCodeFromCoords(lat, lon)

        if (plz && input.value.trim() === '') {
          input.value = plz
        }
      } catch (err) {
        console.error('Reverse Geocoding Fehler:', err)
      }
    },
    err => {
      console.error('Geolocation Fehler:', err.message)
    }
  )
}

document.addEventListener('DOMContentLoaded', getLocationAndFillPostalCode)
