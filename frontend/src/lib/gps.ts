export function getMaxGpsAccuracyMeters() {
  const raw = (import.meta.env.VITE_MAX_GPS_ACCURACY_METERS ?? '').toString().trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 300;
}

