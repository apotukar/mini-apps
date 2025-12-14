const EARTH_RADIUS_KM = 6371;

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function boundingBox(center, radiusKm) {
  const latDiff = radiusKm / 111;
  const cosLat = Math.cos(toRad(center.lat));

  if (Math.abs(cosLat) < 1e-12) {
    return {
      minLat: center.lat - latDiff,
      maxLat: center.lat + latDiff,
      minLon: -180,
      maxLon: 180
    };
  }

  const lonDiff = radiusKm / (111 * cosLat);

  return {
    minLat: center.lat - latDiff,
    maxLat: center.lat + latDiff,
    minLon: center.lon - lonDiff,
    maxLon: center.lon + lonDiff
  };
}

export function inBoundingBox(point, box) {
  return (
    point.lat >= box.minLat &&
    point.lat <= box.maxLat &&
    point.lon >= box.minLon &&
    point.lon <= box.maxLon
  );
}

export function filterByRadius(center, points, radiusKm) {
  const box = boundingBox(center, radiusKm);

  return points
    .filter(point => inBoundingBox(point, box))
    .filter(p => distanceKm(center, p) <= radiusKm);
}
