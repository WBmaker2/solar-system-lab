import { MOON_SYNODIC_DAYS, moonGeocentricLongitude, sunGeocentricLongitude, sunTrueGeocentricLongitude } from './orbits';
import { deg2rad, norm360, rad2deg } from './julian';

export interface MoonPhase {
  /** 0–360, 0 = new moon, 180 = full moon */
  phaseAngle: number;
  /** 0–1 */
  illumination: number;
  /** 0–29.53 */
  age: number;
  index8: number;
  nameKo: string;
  nameEn: string;
  emoji: string;
}

const PHASE_NAMES: Array<{ ko: string; en: string; emoji: string }> = [
  { ko: '삭 (신월)', en: 'New Moon', emoji: '🌑' },
  { ko: '초승달', en: 'Waxing Crescent', emoji: '🌒' },
  { ko: '상현달', en: 'First Quarter', emoji: '🌓' },
  { ko: '상현망간 (부푼 달)', en: 'Waxing Gibbous', emoji: '🌔' },
  { ko: '망 (보름달)', en: 'Full Moon', emoji: '🌕' },
  { ko: '하현망간 (기우는 달)', en: 'Waning Gibbous', emoji: '🌖' },
  { ko: '하현달', en: 'Last Quarter', emoji: '🌗' },
  { ko: '그믐달', en: 'Waning Crescent', emoji: '🌘' },
];

export function moonPhaseAngle(jd: number): number {
  // True elongation Sun→Moon (includes lunar/solar equation of center),
  // so new/full moons land within hours of published times.
  return norm360(moonGeocentricLongitude(jd) - sunTrueGeocentricLongitude(jd));
}

export function moonIllumination(jd: number): number {
  return (1 - Math.cos(deg2rad(moonPhaseAngle(jd)))) / 2;
}

export function moonAge(jd: number): number {
  return (moonPhaseAngle(jd) / 360) * MOON_SYNODIC_DAYS;
}

export function moonPhase(jd: number): MoonPhase {
  const phaseAngle = moonPhaseAngle(jd);
  const illumination = (1 - Math.cos(deg2rad(phaseAngle))) / 2;
  const age = moonAge(jd);
  const index8 = Math.floor(norm360(phaseAngle + 22.5) / 45) % 8;
  const names = PHASE_NAMES[index8];
  return { phaseAngle, illumination, age, index8, nameKo: names.ko, nameEn: names.en, emoji: names.emoji };
}

/**
 * Approximate moonrise / moonset local solar time (hours) from phase angle.
 * New moon rises ~06:00, full moon rises ~18:00. Classroom approximation.
 */
export function moonRiseSetApproximate(jd: number): { riseH: number; setH: number } {
  const angle = moonPhaseAngle(jd);
  const riseH = (6 + (angle / 360) * 24) % 24;
  const setH = (riseH + 12) % 24;
  return { riseH, setH };
}

export function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Elongation |Sun–Moon geocentric longitude| in degrees (0–180). */
export function elongation(jd: number): number {
  const d = Math.abs(norm360(moonGeocentricLongitude(jd) - sunGeocentricLongitude(jd)));
  const e = d > 180 ? 360 - d : d;
  return e;
}

export function phaseAngleDegrees(jd: number): number {
  return rad2deg(Math.acos(1 - 2 * moonIllumination(jd)));
}
