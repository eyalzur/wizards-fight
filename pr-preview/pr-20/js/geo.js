const EARTH_RADIUS_M = 6371000;

export function distanceMeters(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

// Uniform-in-area random point in an annulus (ring) around a center.
export function randomPointInAnnulus(lat, lng, minM, maxM) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random() * (maxM * maxM - minM * minM) + minM * minM);
  const dLat = (r * Math.cos(angle)) / 111320;
  const dLng = (r * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}
