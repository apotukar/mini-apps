import fetch from 'node-fetch';

export async function geocodePlace(query) {
  const q = query.trim();
  const isPlz = /^\d{4,5}$/.test(q);
  const base = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1';
  const url = isPlz
    ? `${base}&postalcode=${encodeURIComponent(q)}&countrycodes=de`
    : `${base}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mini-Apps' } });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  if (!json || !json[0]) {
    return null;
  }

  const place = json[0];
  const addr = place.address || {};

  return {
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon),
    postcode: addr.postcode || null,
    city: addr.city || addr.town || addr.village || addr.hamlet || null,
    displayName: place.display_name || null
  };
}
