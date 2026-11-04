const DHL_BASE_URL = 'https://api-eu.dhl.com/track/shipments';

export class DhlApiError extends Error {
  constructor(status, problem = {}) {
    super(`DHL-API antwortete mit Status ${status}`);
    this.name = 'DhlApiError';
    this.status = status;
    this.title = typeof problem?.title === 'string' ? problem.title : '';
    this.detail = typeof problem?.detail === 'string' ? problem.detail : '';
  }
}

export async function fetchShipment(
  trackingNumber,
  { apiKey, service, requesterCountryCode = 'DE', language = 'de' } = {}
) {
  if (!apiKey) {
    throw new Error('DHL API-Key fehlt.');
  }

  if (!trackingNumber) {
    throw new Error('Trackingnummer fehlt.');
  }

  const url = new URL(DHL_BASE_URL);
  url.searchParams.set('trackingNumber', trackingNumber);
  if (service) {
    url.searchParams.set('service', service);
  }
  url.searchParams.set('requesterCountryCode', requesterCountryCode);
  url.searchParams.set('language', language);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'DHL-API-Key': apiKey,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    let problem;
    try {
      problem = await response.json();
    } catch {
      // Proxies and unavailable backends may return HTML or an empty body.
    }
    throw new DhlApiError(response.status, problem);
  }

  const data = await response.json();
  const s = data && data.shipments && data.shipments[0];

  if (!s) {
    return null;
  }

  const shipment = {};
  shipment.id = s.id;
  shipment.product =
    s.details && s.details.product && s.details.product.productName
      ? s.details.product.productName
      : s.service || '';

  shipment.weight = s.details && s.details.weight ? s.details.weight : null;

  shipment.status = {};
  shipment.status.description = s.status && s.status.description ? s.status.description : '';

  shipment.status.timestamp = s.status && s.status.timestamp ? s.status.timestamp : '';

  if (s.status && s.status.location && s.status.location.address) {
    shipment.status.location =
      s.status.location.address.addressLocality || s.status.location.address.countryCode || '';
  } else {
    shipment.status.location = '';
  }

  shipment.serviceUrl = s.serviceUrl || '';

  const events = [];
  if (Array.isArray(s.events)) {
    for (const ev of s.events) {
      const e = {};
      e.timestamp = ev.timestamp || '';
      e.description = ev.description || '';

      if (ev.location && ev.location.address) {
        e.location = ev.location.address.addressLocality || ev.location.address.countryCode || null;
      } else {
        e.location = null;
      }

      events.push(e);
    }
  }

  shipment.events = events;

  return shipment;
}
