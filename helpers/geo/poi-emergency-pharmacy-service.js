import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer';
import { getRandomBrowserProfile } from '../browser-profiles.js';
import { geocodePlace } from './geocode.js';

const CACHE_DIR = path.join(process.cwd(), '.cache/emergency-pharmacies');
const TTL = 1000 * 60 * 60 * 12;

async function readCache(plz) {
  const file = path.join(CACHE_DIR, `${plz}.json`);

  try {
    const raw = await fs.readFile(file, 'utf8');
    const data = JSON.parse(raw);

    if (!data || typeof data.timestamp !== 'number' || !('payload' in data)) {
      return null;
    }

    if (Date.now() - data.timestamp < TTL) {
      return data.payload;
    }

    return null;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Failed to read cache', file, err);
    }
    return null;
  }
}

async function writeCache(plz, payload) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${plz}.json`);
  const data = { timestamp: Date.now(), payload };
  await fs.writeFile(file, JSON.stringify(data), 'utf8');
}

async function scrape(plz) {
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
        if (idx !== -1)
          fax = txt
            .slice(idx + 4)
            .trim()
            .split('\n')[0]
            .trim();
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

async function mapEmergencyPharmaciesToPois(pharmacies) {
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
      const cleanAddress = sanitizeAddress(address);
      const geo = await geocodePlace(cleanAddress);

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

function sanitizeAddress(address) {
  return address
    .replace(/\b\d+\.*\s*UG\b/gi, '') // 1.UG / UG entfernen
    .replace(/im\s+Ostbahnhof/gi, '') // Lagebeschreibung entfernen
    .replace(/\s+/g, ' ') // doppelte Leerzeichen
    .trim();
}

export async function getEmergencyPharmacies(plz = '81675') {
  const cached = await readCache(plz);
  if (cached) {
    return await mapEmergencyPharmaciesToPois(cached.pharmacies);
  }

  const fresh = await scrape(plz);
  await writeCache(plz, fresh);
  return await mapEmergencyPharmaciesToPois(fresh.pharmacies);
}
