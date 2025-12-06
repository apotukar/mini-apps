import path from 'path';
import puppeteer from 'puppeteer';
import { getRandomBrowserProfile } from '../lib/browser/browser-profiles.js';
import { geocodePlace } from '../lib/geo/geocode.js';
import { SimpleFileCache } from '../lib/cache.js';

export class PoiEmergencyPharmacyService {
  constructor(options = {}) {
    const {
      cacheDir = '/tmp/cache/emergency-pharmacies',
      ttl = 1000 * 60 * 60 * 12,
      geocodeFn = geocodePlace
    } = options;

    const resolvedCacheDir = path.isAbsolute(cacheDir)
      ? cacheDir
      : path.join(process.cwd(), cacheDir);

    this.cache = new SimpleFileCache({
      cacheDir: resolvedCacheDir,
      ttl
    });

    this.geocodeFn = geocodeFn;
  }

  async getEmergencyPharmacies(plz = '81675') {
    const cached = await this.cache.read(plz);
    if (cached) {
      return this.mapEmergencyPharmaciesToPois(cached.pharmacies);
    }

    const fresh = await this.scrape(plz);
    await this.cache.write(plz, fresh);
    return this.mapEmergencyPharmaciesToPois(fresh.pharmacies);
  }

  async scrape(plz) {
    const profile = getRandomBrowserProfile();
    const url = `https://www.aponet.de/apotheke/notdienstsuche/${plz}`;
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent(profile.userAgent);
    await page.setExtraHTTPHeaders({ 'Accept-Language': profile.acceptLanguage });

    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#pharmacy-search-result li.list-group-item', { timeout: 10000 });

    const result = await page.evaluate(() => {
      const root = document.querySelector('#pharmacy-search-result');
      const metaText = root.querySelector('p.pt-3.mb-3')?.textContent?.trim() ?? null;
      const items = root.querySelectorAll('ul.list.list-group > li.list-group-item');

      const pharmacies = Array.from(items).map(li => {
        const name = li.querySelector('h4.name')?.textContent?.trim() ?? null;
        const distanceText = li.querySelector('.distanz')?.textContent?.trim() ?? null;
        const distanceKm = distanceText
          ? parseFloat(
              distanceText
                .replace('Entfernung', '')
                .replace(':', '')
                .replace('km', '')
                .replace(',', '.')
                .trim()
            )
          : null;
        const dutyText = li.querySelector('.mb-2 p')?.textContent?.trim() ?? null;
        const street = li.querySelector('.strasse')?.textContent?.trim() ?? null;
        const zip = li.querySelector('.plz')?.textContent?.trim() ?? null;
        const city = li.querySelector('.ort')?.textContent?.trim() ?? null;
        const phoneLink = li.querySelector('a[href^="tel:"]');
        const phone = phoneLink?.textContent?.trim() ?? null;
        const phoneHref = phoneLink?.getAttribute('href') ?? null;

        let fax = null;
        const contactP = Array.from(li.querySelectorAll('.col-md-4 p'))[1];
        if (contactP) {
          const txt = contactP.textContent || '';
          const idx = txt.indexOf('Fax:');
          if (idx !== -1) {
            fax = txt
              .slice(idx + 4)
              .trim()
              .split('\n')[0]
              .trim();
          }
        }

        const googleMapsUrl = li.querySelector('a.showapo')?.getAttribute('href') ?? null;
        const publicTransportUrl = li.querySelector('a.btn-busbahn')?.getAttribute('href') ?? null;

        return {
          name,
          distanceText,
          distanceKm,
          dutyText,
          address: { street, zip, city },
          contact: { phone, phoneHref, fax },
          links: { googleMapsUrl, publicTransportUrl }
        };
      });

      return { meta: metaText, pharmacies };
    });

    await browser.close();
    return result;
  }

  async mapEmergencyPharmaciesToPois(pharmacies) {
    const result = [];
    for (const p of pharmacies) {
      const street = p?.address?.street ?? null;
      const zip = p?.address?.zip ?? null;
      const city = p?.address?.city ?? null;
      const address =
        street && (zip || city) ? `${street}, ${zip ?? ''} ${city ?? ''}`.trim() : street || null;

      let lat = null;
      let lon = null;
      if (address) {
        const cleanAddress = this.sanitizeAddress(address);
        const geo = await this.geocodeFn(cleanAddress);

        if (geo?.lat && geo?.lon) {
          lat = geo.lat;
          lon = geo.lon;
        }
      }

      result.push({
        name: p.name ?? null,
        speciality: p.dutyText ?? null,
        address,
        lat,
        lon,
        isFallbackAddress: false,
        phone: p.contact?.phone ?? null
      });
    }
    return result;
  }

  sanitizeAddress(address) {
    return address
      .replace(/\b\d+\.*\s*UG\b/gi, '')
      .replace(/im\s+Ostbahnhof/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
