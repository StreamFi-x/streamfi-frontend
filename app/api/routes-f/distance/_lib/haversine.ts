export type Point = [number, number];

const EARTH_RADIUS_KM = 6371;
const KM_TO_MI = 0.621371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isValidPoint(point: unknown): point is Point {
  if (!Array.isArray(point) || point.length !== 2) return false;
  const [lat, lng] = point;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function haversineKm(from: Point, to: Point): number {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function kmToMi(km: number): number {
  return km * KM_TO_MI;
}
