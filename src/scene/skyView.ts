import { formatHour, moonPhase, moonRiseSetApproximate } from '../astro/phases';
import { OBLIQUITY_DEG } from '../astro/orbits';
import { SEOUL_LAT, dayLengthHours, solarDeclination, solarNoonAltitude } from '../astro/seasons';

/**
 * Observer (ground) sky diagram for Seoul latitude.
 * Classroom approximation: sunrise/sunset from day length, altitude follows a sine arc.
 */
export interface SkyBody {
  kind: 'sun' | 'moon';
  visible: boolean;
  altitude: number;
  azimuth: number; // deg, 0=N 90=E 180=S 270=W
  riseH: number;
  setH: number;
}

export function sunAltitudeAt(
  hour: number,
  jd: number,
  lat = SEOUL_LAT,
  obliquity: number = OBLIQUITY_DEG,
): { altitude: number; azimuth: number; riseH: number; setH: number } {
  const day = Math.max(dayLengthHours(jd, lat, obliquity), 0.5);
  const riseH = 12 - day / 2;
  const setH = 12 + day / 2;
  const maxAlt = solarNoonAltitude(jd, lat, obliquity);
  if (hour < riseH || hour > setH) {
    const frac = hour < riseH ? (hour + 24 - setH) / (24 - day) : (hour - setH) / (24 - day);
    return { altitude: -12 * Math.sin(Math.PI * Math.min(Math.max(frac, 0), 1)), azimuth: hour < 12 ? 60 : 300, riseH, setH };
  }
  const frac = (hour - riseH) / day;
  return { altitude: Math.max(0, maxAlt * Math.sin(Math.PI * frac)), azimuth: 90 + 180 * frac, riseH, setH };
}

export function moonAltitudeAt(
  hour: number,
  jd: number,
  lat = SEOUL_LAT,
  obliquity: number = OBLIQUITY_DEG,
): { altitude: number; riseH: number; setH: number } {
  const { riseH, setH } = moonRiseSetApproximate(jd);
  const dec = -solarDeclination(jd, obliquity) * Math.cos((moonPhase(jd).phaseAngle * Math.PI) / 180);
  const maxAlt = Math.max(5, 90 - Math.abs(lat - dec));
  const span = (setH - riseH + 24) % 24;
  const rel = (hour - riseH + 24) % 24;
  if (rel > span) return { altitude: -8, riseH, setH };
  return { altitude: Math.max(0, maxAlt * Math.sin((Math.PI * rel) / span)), riseH, setH };
}

function arcPath(cx: number, cy: number, r: number, altFn: (frac: number) => number, maxAlt: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const frac = i / 40;
    const alt = Math.max(0, altFn(frac));
    const angle = Math.PI - (frac * Math.PI); // east -> west over the top
    const rr = r * (1 - alt / Math.max(maxAlt, 1) / 2.6);
    const x = cx + Math.cos(angle) * rr;
    const y = cy - Math.sin(angle) * rr * 0.72;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function renderSkySVG(jd: number, date: Date, lat = SEOUL_LAT, obliquity: number = OBLIQUITY_DEG): string {
  const hour = date.getUTCHours() + 9; // KST display; model uses local solar approx
  const h = ((hour % 24) + 24) % 24;
  const sun = sunAltitudeAt(h, jd, lat, obliquity);
  const moon = moonAltitudeAt(h, jd, lat, obliquity);
  const phase = moonPhase(jd);
  const W = 520, H = 300, cx = 260, cy = 250, r = 200;
  const dayLen = Math.max(dayLengthHours(jd, lat, obliquity), 0.5);
  const sunMax = solarNoonAltitude(jd, lat, obliquity);
  const moonMax = 90 - Math.abs(lat + solarDeclination(jd, obliquity) * 0.9);

  const sunPath = arcPath(cx, cy, r, (f) => sunMax * Math.sin(Math.PI * f), sunMax);
  const moonPath = arcPath(cx, cy, r * 0.78, (f) => moonMax * Math.sin(Math.PI * f), Math.max(moonMax, 1));

  const marker = (alt: number, frac: number, rr: number, color: string, glyph: string): string => {
    const angle = Math.PI - frac * Math.PI;
    const rad = rr * (1 - Math.max(0, alt) / 90 / 2.6);
    const x = cx + Math.cos(angle) * rad;
    const y = cy - Math.sin(angle) * rad * 0.72;
    if (alt < 0) return `<text x="${x.toFixed(0)}" y="${(cy + 34).toFixed(0)}" text-anchor="middle" font-size="13" fill="${color}" opacity="0.65">${glyph} (지평선 아래)</text>`;
    return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-size="22">${glyph}</text>`;
  };

  const sunFrac = sun.riseH <= sun.setH
    ? Math.min(Math.max((h - sun.riseH) / Math.max(dayLen, 0.01), 0), 1)
    : 0;
  const span = (moon.setH - moon.riseH + 24) % 24 || 12;
  const moonFrac = Math.min(Math.max(((h - moon.riseH + 24) % 24) / span, 0), 1);

  return `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="서울 하늘의 태양과 달 궤적" class="sky-svg">
    <rect x="20" y="10" width="480" height="240" rx="120" fill="#0b1526" stroke="#263a63"/>
    <line x1="20" y1="${cy}" x2="500" y2="${cy}" stroke="#3b547f" stroke-dasharray="6 4"/>
    <text x="30" y="${cy - 8}" font-size="12" fill="#8c9bb9">동 E</text>
    <text x="478" y="${cy - 8}" font-size="12" fill="#8c9bb9">서 W</text>
    <text x="${cx}" y="34" font-size="12" fill="#8c9bb9" text-anchor="middle">남 S · 자오선</text>
    <path d="${sunPath}" fill="none" stroke="#ffb62e" stroke-width="2.5"/>
    <path d="${moonPath}" fill="none" stroke="#9fb2d8" stroke-width="2" stroke-dasharray="7 4"/>
    ${marker(sun.altitude, sunFrac, r, '#ffb62e', '☀️')}
    ${marker(moon.altitude, moonFrac, r * 0.78, '#9fb2d8', phase.emoji)}
    <g font-size="12" fill="#c7d3ea">
      <text x="30" y="272">일출 ${formatHour((sun.riseH + 24) % 24)} · 일몰 ${formatHour(sun.setH % 24)}</text>
      <text x="30" y="290">월출 ≈ ${formatHour(moon.riseH)} · 월몰 ≈ ${formatHour(moon.setH)} · ${phase.nameKo} ${(phase.illumination * 100).toFixed(0)}%</text>
    </g>
  </svg>`;
}
