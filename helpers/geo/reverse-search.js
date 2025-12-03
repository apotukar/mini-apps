import path from 'path';
import { SimpleFileCache } from '../cache.js';

// TODO: inject api key or create class

const infiniteReverseSearchCache = new SimpleFileCache({
  cacheDir: path.join(process.cwd(), '.cache/reverse-search'),
  ttl: Infinity
});

export async function reverseSearch(lat, lon, apiKey, retries = 2, sleepDuration = 500) {
  const cacheKey = `lat-${lat}-long-${lon}`;
  const cached = await infiniteReverseSearchCache.read(cacheKey);
  if (cached) {
    return await cached;
  }

  const url = new URL('https://eu1.locationiq.com/v1/reverse');
  url.searchParams.set('key', String(apiKey));
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');

  for (let i = 0; i <= retries; i++) {
    console.log('Trying to reverse search...', url.toString());
    const res = await fetch(url.toString());

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const line1 = [addr.road, addr.house_number].filter(Boolean).join(' ');
      const line2 = [addr.postcode, addr.city].filter(Boolean).join(' ');
      const result = [line1, line2].filter(Boolean).join(', ') || null;
      await infiniteReverseSearchCache.write(cacheKey, result);
      return result;
    }

    if (sleepDuration > 0) {
      await new Promise(r => setTimeout(r, sleepDuration));
    }
  }

  return null;
}
