import { OBLIQUITY_DEG, sunTrueGeocentricLongitude } from './orbits';
import { deg2rad, rad2deg } from './julian';

export const SEOUL_LAT = 37.56;

/** Solar declination (deg) from the Sun's apparent ecliptic longitude. */
export function solarDeclination(jd: number): number {
  const lambda = deg2rad(sunTrueGeocentricLongitude(jd));
  const eps = deg2rad(OBLIQUITY_DEG);
  return rad2deg(Math.asin(Math.sin(eps) * Math.sin(lambda)));
}

/** Solar-noon altitude (deg) at a given latitude. */
export function solarNoonAltitude(jd: number, latitudeDeg: number): number {
  const delta = solarDeclination(jd);
  return 90 - Math.abs(latitudeDeg - delta);
}

/**
 * Day length in hours at latitude (includes standard -0.833° refraction/semi-diameter correction).
 * Returns clamped 0–24 (polar day/night).
 */
export function dayLengthHours(jd: number, latitudeDeg: number): number {
  const lat = deg2rad(latitudeDeg);
  const dec = deg2rad(solarDeclination(jd));
  const h0 = -0.01454; // sin(-0.833°)
  const cosH = (h0 - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return (2 * rad2deg(Math.acos(cosH))) / 15;
}

export interface SeasonMarker {
  id: string;
  nameKo: string;
  month: number;
  day: number;
}

/** Approximate Northern-Hemisphere markers (classroom dates). */
export const SEASON_MARKERS: SeasonMarker[] = [
  { id: 'mar-equinox', nameKo: '춘분 (낮·밤 같음)', month: 3, day: 21 },
  { id: 'jun-solstice', nameKo: '하지 (낮 가장 김)', month: 6, day: 21 },
  { id: 'sep-equinox', nameKo: '추분 (낮·밤 같음)', month: 9, day: 23 },
  { id: 'dec-solstice', nameKo: '동지 (낮 가장 짧음)', month: 12, day: 22 },
];

export function seasonNameNorthern(jd: number, date: Date): string {
  void jd;
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const md = m * 100 + d;
  if (md >= 321 && md < 621) return '봄';
  if (md >= 621 && md < 923) return '여름';
  if (md >= 923 && md < 1222) return '가을';
  return '겨울';
}

/** Day-length table across latitudes for the graph (F4). */
export function dayLengthTable(jd: number, latitudes = [-60, -30, 0, 20, 37.6, 60]): Array<{ lat: number; hours: number }> {
  return latitudes.map((lat) => ({ lat, hours: dayLengthHours(jd, lat) }));
}
