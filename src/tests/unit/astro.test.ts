import { describe, expect, it } from 'vitest';
import { dateToJulian, formatDateUTC, julianToDate } from '../../astro/julian';
import { EARTH, MOON_SYNODIC_DAYS, heliocentricScene, meanLongitude } from '../../astro/orbits';
import { moonAge, moonIllumination, moonPhase } from '../../astro/phases';
import { eclipseStatus, predictEclipses } from '../../astro/eclipses';
import { dayLengthHours, solarNoonAltitude } from '../../astro/seasons';
import { checkMission, MISSIONS } from '../../data/quiz';
import { TimeStore } from '../../stores/timeStore';

const JD = (iso: string): number => dateToJulian(new Date(`${iso}T12:00:00Z`));

describe('julian', () => {
  it('round-trips J2000 epoch', () => {
    expect(dateToJulian(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)))).toBeCloseTo(2451545.0, 6);
  });
  it('round-trips arbitrary dates', () => {
    const d = new Date(Date.UTC(2026, 5, 21, 12));
    expect(formatDateUTC(julianToDate(dateToJulian(d)))).toBe('2026-06-21');
  });
});

describe('orbits', () => {
  it('earth completes one revolution in a year', () => {
    const start = JD('2026-03-21');
    const lon0 = meanLongitude(EARTH, start);
    const lon1 = meanLongitude(EARTH, start + 365.25);
    const diff = Math.abs(((lon1 - lon0) % 360 + 360) % 360);
    expect(diff).toBeGreaterThan(359);
    const p0 = heliocentricScene(EARTH, start);
    const p1 = heliocentricScene(EARTH, start + 365.25);
    const dist = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    expect(dist).toBeLessThan(0.5); // scene units (radius 24)
  });
});

describe('moon phases', () => {
  it('full moon illumination exceeds 98%', () => {
    // Scan March 2026 for the fullest moon (known full moon: 2026-03-03).
    let best = 0;
    for (let d = 0; d < 31; d += 0.25) best = Math.max(best, moonIllumination(JD('2026-03-01') + d));
    expect(best).toBeGreaterThan(0.98);
  });
  it('new moon illumination is below 2%', () => {
    let best = 1;
    for (let d = 0; d < 31; d += 0.25) best = Math.min(best, moonIllumination(JD('2026-03-01') + d));
    expect(best).toBeLessThan(0.02);
  });
  it('synodic month is ~29.53 days between equal phases', () => {
    const t0 = JD('2026-01-01');
    const target = moonAge(t0);
    let found = -1;
    for (let d = 20; d < 40; d += 0.05) {
      if (Math.abs(moonAge(t0 + d) - target) < 0.05) { found = d; break; }
    }
    expect(found).toBeGreaterThan(0);
    expect(found).toBeCloseTo(MOON_SYNODIC_DAYS, 0);
  });
  it('names all 8 phases in Korean', () => {
    const names = new Set<string>();
    for (let d = 0; d < 30; d += 0.5) names.add(moonPhase(JD('2026-01-01') + d).nameKo);
    expect(names.size).toBe(8);
  });
});

describe('seasons', () => {
  it('Seoul day length order: solstice > equinox > winter solstice', () => {
    const jun = dayLengthHours(JD('2026-06-21'), 37.56);
    const mar = dayLengthHours(JD('2026-03-21'), 37.56);
    const dec = dayLengthHours(JD('2026-12-22'), 37.56);
    expect(jun).toBeGreaterThan(13.5);
    expect(dec).toBeLessThan(10.5);
    expect(jun).toBeGreaterThan(mar);
    expect(mar).toBeGreaterThan(dec);
  });
  it('solar noon altitude is highest in June in Seoul', () => {
    expect(solarNoonAltitude(JD('2026-06-21'), 37.56)).toBeGreaterThan(
      solarNoonAltitude(JD('2026-12-22'), 37.56),
    );
  });
});

describe('eclipses', () => {
  it('flags an eclipse window near known 2026 events', () => {
    // Known 2026 eclipses: Feb 17 (solar), Mar 3 (lunar), Aug 12 (solar), Aug 28 (lunar).
    const events = predictEclipses(JD('2026-01-01'), JD('2026-12-31'));
    expect(events.length).toBeGreaterThanOrEqual(4);
    const near = (iso: string, kind: 'solar' | 'lunar'): boolean =>
      events.some((e) => e.kind === kind && Math.abs(e.jd - JD(iso)) < 4);
    expect(near('2026-02-17', 'solar')).toBe(true);
    expect(near('2026-03-03', 'lunar')).toBe(true);
    expect(near('2026-08-12', 'solar')).toBe(true);
    expect(near('2026-08-28', 'lunar')).toBe(true);
  });
  it('reports no eclipse on an ordinary day', () => {
    expect(eclipseStatus(JD('2026-04-10'))).toMatchObject({ solar: false, lunar: false });
  });
});

describe('quiz', () => {
  it('full-moon mission passes at full moon and fails at new moon', () => {
    const full = MISSIONS.find((m) => m.id === 'full-moon')!;
    // Find the fullest moment in early March 2026.
    let bestJd = JD('2026-03-01');
    let best = -1;
    for (let d = 0; d < 10; d += 0.1) {
      const ill = moonIllumination(JD('2026-03-01') + d);
      if (ill > best) { best = ill; bestJd = JD('2026-03-01') + d; }
    }
    expect(checkMission(full, { jd: bestJd, date: julianToDate(bestJd) }).pass).toBe(true);
    const nm = JD('2026-03-19');
    expect(checkMission(full, { jd: nm, date: julianToDate(nm) }).pass).toBe(false);
  });
});

describe('time store', () => {
  it('advances with tick and projects playback', () => {
    const t = new TimeStore();
    const start = t.get().jd;
    t.setPlaying(true);
    t.tick(2);
    expect(t.get().jd).toBeGreaterThan(start);
    expect(t.project(10)).toBeCloseTo(t.get().jd + t.get().speed * 10, 9);
    t.setPlaying(false);
    const frozen = t.get().jd;
    t.tick(5);
    expect(t.get().jd).toBe(frozen);
  });
});
