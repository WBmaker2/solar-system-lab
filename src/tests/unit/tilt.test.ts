import { describe, expect, it } from 'vitest';
import { dateToJulian } from '../../astro/julian';
import { dayLengthHours, solarNoonAltitude } from '../../astro/seasons';

const JD = (iso: string): number => dateToJulian(new Date(`${iso}T12:00:00Z`));

describe('axial tilt lab', () => {
  it('zero obliquity means ~12h days at every latitude (no seasons)', () => {
    // The -0.833° refraction correction adds ~0.2h everywhere, so assert
    // uniformity + nearness instead of exactly 12.
    const hours = [-60, -30, 0, 37.56, 60].map((lat) => dayLengthHours(JD('2026-06-21'), lat, 0));
    for (const h of hours) {
      expect(h).toBeGreaterThan(11.9);
      expect(h).toBeLessThan(12.4);
    }
    expect(Math.max(...hours) - Math.min(...hours)).toBeLessThan(0.2);
  });
  it('larger tilt means stronger seasonal contrast in Seoul', () => {
    const span = (obl: number): number =>
      dayLengthHours(JD('2026-06-21'), 37.56, obl) - dayLengthHours(JD('2026-12-22'), 37.56, obl);
    expect(span(45)).toBeGreaterThan(span(23.4393));
    expect(span(23.4393)).toBeGreaterThan(span(0));
  });
  it('default parameter keeps the classic 23.4° behavior', () => {
    expect(dayLengthHours(JD('2026-06-21'), 37.56)).toBeCloseTo(
      dayLengthHours(JD('2026-06-21'), 37.56, 23.4393),
      9,
    );
  });
  it('zero tilt flattens solar noon altitude across the year', () => {
    const jun = solarNoonAltitude(JD('2026-06-21'), 37.56, 0);
    const dec = solarNoonAltitude(JD('2026-12-22'), 37.56, 0);
    expect(Math.abs(jun - dec)).toBeLessThan(0.6);
  });
});
