import path from 'path';
import { SimpleFileCache } from '../cache.js';

export class ReverseGeocodeService {
  constructor(options = {}) {
    const {
      cacheDir = '/tmp/cache/reverse-search',
      ttl = Infinity,
      apiKey = null,
      retries = 2,
      sleepDuration = 500
    } = options;

    const resolvedCacheDir = path.isAbsolute(cacheDir)
      ? cacheDir
      : path.join(process.cwd(), cacheDir);

    this.cache = new SimpleFileCache({
      cacheDir: resolvedCacheDir,
      ttl
    });

    this.apiKey = apiKey;
    this.retries = retries;
    this.sleepDuration = sleepDuration;
  }

  async reverseSearch(lat, lon) {
    if (!this.apiKey) {
      throw new Error('Missing API key for ReverseGeocodeService.');
    }

    const cacheKey = `lat-${lat}-lon-${lon}`;
    const cached = await this.cache.read(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL('https://eu1.locationiq.com/v1/reverse');
    url.searchParams.set('key', String(this.apiKey));
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('format', 'json');

    for (let i = 0; i <= this.retries; i++) {
      console.log('Trying reverse geocode:', url.toString());

      const res = await fetch(url.toString());

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        const line1 = [addr.road, addr.house_number].filter(Boolean).join(' ');
        const line2 = [addr.postcode, addr.city].filter(Boolean).join(' ');

        const result = [line1, line2].filter(Boolean).join(', ') || null;

        await this.cache.write(cacheKey, result);
        return result;
      }

      if (this.sleepDuration > 0) {
        await new Promise(r => setTimeout(r, this.sleepDuration));
      }
    }

    return null;
  }
}
