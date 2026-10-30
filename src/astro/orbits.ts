import { J2000, deg2rad, norm360 } from './julian';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanetDef {
  id: string;
  nameKo: string;
  nameEn: string;
  radiusAU: number;
  /** mean longitude at J2000 (deg) */
  meanLongitudeJ2000: number;
  /** mean motion deg/day */
  meanMotion: number;
  /** classroom display radius (scene units) */
  displayRadius: number;
  /** classroom body size (scene units) */
  displaySize: number;
  color: string;
  description: string;
}

/**
 * Circular-orbit approximation (classroom model).
 * Low-precision but pedagogically correct: ordering, relative periods, phase relations.
 */
export const PLANETS: PlanetDef[] = [
  { id: 'mercury', nameKo: '수성', nameEn: 'Mercury', radiusAU: 0.387, meanLongitudeJ2000: 252.251, meanMotion: 4.092317, displayRadius: 14, displaySize: 0.35, color: '#b8a99a', description: '태양에 가장 가까운 행성. 공전 주기 약 88일.' },
  { id: 'venus', nameKo: '금성', nameEn: 'Venus', radiusAU: 0.723, meanLongitudeJ2000: 181.98, meanMotion: 1.60213, displayRadius: 18, displaySize: 0.6, color: '#e8c872', description: '두껍게 대기로 덮인 뜨거운 행성. 공전 주기 약 225일.' },
  { id: 'earth', nameKo: '지구', nameEn: 'Earth', radiusAU: 1.0, meanLongitudeJ2000: 100.464, meanMotion: 0.985609, displayRadius: 24, displaySize: 0.65, color: '#4da3ff', description: '우리가 사는 행성. 자전축이 23.4° 기울어져 계절이 생긴다.' },
  { id: 'mars', nameKo: '화성', nameEn: 'Mars', radiusAU: 1.524, meanLongitudeJ2000: 355.453, meanMotion: 0.524033, displayRadius: 29, displaySize: 0.5, color: '#e06a4d', description: '붉은 행성. 공전 주기 약 687일.' },
  { id: 'jupiter', nameKo: '목성', nameEn: 'Jupiter', radiusAU: 5.203, meanLongitudeJ2000: 34.351, meanMotion: 0.083091, displayRadius: 38, displaySize: 1.9, color: '#d8a86e', description: '태양계에서 가장 큰 행성. 공전 주기 약 12년.' },
  { id: 'saturn', nameKo: '토성', nameEn: 'Saturn', radiusAU: 9.537, meanLongitudeJ2000: 50.078, meanMotion: 0.033459, displayRadius: 47, displaySize: 1.6, color: '#e3cf9e', description: '뚜렷한 고리를 가진 행성. 공전 주기 약 29년.' },
  { id: 'uranus', nameKo: '천왕성', nameEn: 'Uranus', radiusAU: 19.191, meanLongitudeJ2000: 314.055, meanMotion: 0.011732, displayRadius: 55, displaySize: 1.1, color: '#8fd8d8', description: '옆으로 누운 채 자전하는 행성. 공전 주기 약 84년.' },
  { id: 'neptune', nameKo: '해왕성', nameEn: 'Neptune', radiusAU: 30.069, meanLongitudeJ2000: 304.88, meanMotion: 0.005981, displayRadius: 62, displaySize: 1.05, color: '#5b7fe0', description: '태양에서 가장 먼 행성. 공전 주기 약 165년.' },
];

export function meanLongitude(def: PlanetDef, jd: number): number {
  const d = jd - J2000;
  return norm360(def.meanLongitudeJ2000 + def.meanMotion * d);
}

export function heliocentricAU(def: PlanetDef, jd: number): Vec3 {
  const lon = deg2rad(meanLongitude(def, jd));
  return { x: Math.cos(lon) * def.radiusAU, y: 0, z: -Math.sin(lon) * def.radiusAU };
}

export function heliocentricScene(def: PlanetDef, jd: number): Vec3 {
  const lon = deg2rad(meanLongitude(def, jd));
  return {
    x: Math.cos(lon) * def.displayRadius,
    y: 0,
    z: -Math.sin(lon) * def.displayRadius,
  };
}

export const EARTH = PLANETS[2];
export const MOON_SYNODIC_DAYS = 29.530588853;
/** A reference new moon: 2000-01-06 18:14 UTC (JD ≈ 2451550.26). */
export const REF_NEW_MOON_JD = 2451550.26;
export const MOON_ORBIT_RADIUS_AU = 0.00257;
export const MOON_DISPLAY_RADIUS = 2.4;
export const OBLIQUITY_DEG = 23.4393;

/** Geocentric ecliptic longitude of the Sun (deg). */
export function sunGeocentricLongitude(jd: number): number {
  return norm360(meanLongitude(EARTH, jd) + 180);
}

/**
 * Low-precision periodic corrections (Meeus, truncated to classroom size).
 * Lunar longitude: equation of center + evection + variation (≈0.3° accuracy).
 * Solar longitude: equation of center (≈0.01° accuracy).
 */
export function lunarLongitudeCorrection(jd: number): number {
  const d = jd - J2000;
  const Mm = deg2rad(norm360(134.9634114 + 13.0649929509 * d)); // lunar mean anomaly
  const Ms = deg2rad(norm360(357.5291092 + 0.98560028 * d)); // solar mean anomaly
  const D = deg2rad(norm360(297.8501921 + 12.19074912 * d)); // mean elongation
  return (
    6.289 * Math.sin(Mm) +
    1.274 * Math.sin(2 * D - Mm) +
    0.658 * Math.sin(2 * D) +
    0.214 * Math.sin(2 * Mm) -
    0.186 * Math.sin(Ms)
  );
}

export function solarLongitudeCorrection(jd: number): number {
  const d = jd - J2000;
  const Ms = deg2rad(norm360(357.5291092 + 0.98560028 * d));
  return 1.915 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms);
}

/** Mean geocentric longitude of the Moon (defines argument of latitude). */
export function moonMeanGeocentricLongitude(jd: number): number {
  const age = ((jd - REF_NEW_MOON_JD) % MOON_SYNODIC_DAYS + MOON_SYNODIC_DAYS) % MOON_SYNODIC_DAYS;
  return norm360(sunGeocentricLongitude(jd) + (age / MOON_SYNODIC_DAYS) * 360);
}

/** True geocentric ecliptic longitude of the Moon (with corrections). */
export function moonGeocentricLongitude(jd: number): number {
  return norm360(moonMeanGeocentricLongitude(jd) + lunarLongitudeCorrection(jd));
}

/** True geocentric ecliptic longitude of the Sun (with equation of center). */
export function sunTrueGeocentricLongitude(jd: number): number {
  return norm360(sunGeocentricLongitude(jd) + solarLongitudeCorrection(jd));
}

/** Moon position relative to Earth in scene units (ecliptic plane + small tilt). */
export function moonRelativeScene(jd: number): Vec3 {
  const lon = deg2rad(moonGeocentricLongitude(jd));
  // 5.14° orbital tilt so eclipses are exceptional, not monthly.
  const tilt = deg2rad(5.14);
  const x = Math.cos(lon) * MOON_DISPLAY_RADIUS;
  const z = -Math.sin(lon) * MOON_DISPLAY_RADIUS;
  const y = Math.sin(lon) * Math.sin(tilt) * MOON_DISPLAY_RADIUS;
  return { x, y, z };
}

/** Moon position relative to Earth in AU. */
export function moonRelativeAU(jd: number): Vec3 {
  const scene = moonRelativeScene(jd);
  const k = MOON_ORBIT_RADIUS_AU / MOON_DISPLAY_RADIUS;
  return { x: scene.x * k, y: scene.y * k, z: scene.z * k };
}

/** Direction from Earth toward the Sun (unit vector, scene space). */
export function sunDirectionFromEarth(jd: number): Vec3 {
  const earth = heliocentricScene(EARTH, jd);
  const len = Math.hypot(earth.x, earth.z) || 1;
  return { x: -earth.x / len, y: 0, z: -earth.z / len };
}
