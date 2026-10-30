// Julian-date helpers (Meeus simplified). All dates are UTC.
export const JD_UNIX_EPOCH = 2440587.5;
export const DAY_MS = 86_400_000;
export const J2000 = 2451545.0;

export function dateToJulian(date: Date): number {
  return date.getTime() / DAY_MS + JD_UNIX_EPOCH;
}

export function julianToDate(jd: number): Date {
  return new Date((jd - JD_UNIX_EPOCH) * DAY_MS);
}

export function daysSinceJ2000(jd: number): number {
  return jd - J2000;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / DAY_MS) + 1;
}

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function norm180(deg: number): number {
  const n = norm360(deg);
  return n > 180 ? n - 360 : n;
}

export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function rad2deg(rad: number): number {
  return (rad * 180) / Math.PI;
}
