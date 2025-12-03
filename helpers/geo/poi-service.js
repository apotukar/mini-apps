import fetch from 'node-fetch';
import { reverseSearch } from './reverse-search.js';
import { mapAsyncFlexible } from '../map-async-flexible.js';

// TODO: complete class
export class PoiService {
  constructor(arg) {
    this.arg = arg;
  }
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function searchPOIs(types, type, loc, radiusInMeters, apiKey) {
  if (!loc) {
    return [];
  }

  const latCenter = loc.lat;
  const lonCenter = loc.lon;
  const poiType = types[type]?.query || 'amenity=pharmacy';
  const overpassQuery = `[out:json];node[${poiType}](around:${radiusInMeters},${latCenter},${lonCenter});out body;`;

  const body = new URLSearchParams();
  body.set('data', overpassQuery);

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    return [];
  }

  const json = await res.json();
  if (!json.elements) {
    return [];
  }

  const results = await Promise.all(
    json.elements.map(async n => {
      const tags = n.tags || {};
      const lat = n.lat !== null ? parseFloat(n.lat) : null;
      const lon = n.lon !== null ? parseFloat(n.lon) : null;

      let address = formatAddress(tags);
      let isFallbackAddress = false;
      let speciality = null;
      if (poiType === 'amenity=doctors') {
        speciality = getDoctorSpecialty(tags);
      }

      const displayName =
        tags.name || (speciality && type === 'arzt' ? `Arzt (${speciality})` : 'Unbekannt');

      return {
        name: displayName,
        speciality,
        address,
        lat,
        lon,
        isFallbackAddress,
        phone: null
      };
    })
  );

  const enriched = await mapAsyncFlexible(
    results,
    async result => {
      if (!result.address && result.lat !== null && result.lon !== null) {
        try {
          result.address = await reverseSearch(result.lat, result.lon, apiKey);
          result.isFallbackAddress = true;
          return result;
        } catch (error) {
          console.error('Error fetching address:', error);
          return result;
        }
      }
      return result;
    },
    {
      sequential: true,
      sleepDuration: 600
    }
  );

  return enriched;
}

function formatAddress(tags) {
  const street = tags['addr:street'] || '';
  const number = tags['addr:housenumber'] || '';
  const city = tags['addr:city'] || '';
  const pc = tags['addr:postcode'] || '';

  const line1 = street && number ? `${street} ${number}` : street || '';
  const line2 = pc && city ? `${pc} ${city}` : city || '';

  if (!line1 && !line2) {
    return null;
  }
  return [line1, line2].filter(Boolean).join(', ');
}

function getDoctorSpecialty(tags) {
  const raw =
    tags['healthcare:speciality'] ||
    tags['medical_specialty'] ||
    tags['healthcare'] ||
    tags['doctor'] ||
    tags['speciality'] ||
    null;

  if (!raw) {
    return null;
  }

  const first = String(raw).split(';')[0].trim();

  const map = {
    dentist: 'Zahnarzt',
    dental: 'Zahnarzt',
    general: 'Allgemeinmediziner',
    family: 'Hausarzt',
    pediatrics: 'Kinderarzt',
    pediatric: 'Kinderarzt',
    paediatrics: 'Kinderarzt',
    internal: 'Internist',
    orthopaedics: 'Orthopäde',
    orthopedics: 'Orthopäde',
    dermatology: 'Dermatologe',
    dermatology_allergy: 'Haut- und Allergiepraxis',
    gynecology: 'Frauenarzt',
    gynaecology: 'Frauenarzt',
    neurology: 'Neurologe',
    ophthalmology: 'Augenarzt',
    ent: 'HNO-Arzt',
    psychotherapist: 'Psychotherapeut',
    cardiology: 'Kardiologe',
    homeopathy: 'Homöopathie',
    urology: 'Urologe',
    radiology: 'Radiologe',
    gastroenterology: 'Gastroenterologe',
    proctology: 'Proktologe',
    doctor: 'Arztpraxis'
  };

  const key = first.toLowerCase();
  return map[key] || first;
}
