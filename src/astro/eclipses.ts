import { J2000, deg2rad, norm360, rad2deg } from './julian';
import { MOON_SYNODIC_DAYS } from './orbits';
import { moonPhaseAngle } from './phases';
import { julianToDate } from './julian';

export interface EclipseEvent {
  kind: 'solar' | 'lunar';
  /** peak Julian date */
  jd: number;
  dateISO: string;
  /** 0–1 confidence of the simplified model */
  gamma: number;
  description: string;
}

/**
 * Simplified eclipse predictor (classroom model).
 * Uses mean lunar longitude + regressing node (Meeus low-precision):
 *   L' = 218.3164477 + 13.17639648 * d
 *   Ω  = 125.04452 - 0.0529538083 * d
 *   F  = L' - Ω  (argument of latitude)
 * Both solar (new moon) and lunar (full moon) eclipses happen when the Moon
 * is near a node, i.e. F ≈ 0° or 180°. The Sun then sits near the opposite
 * node. Windows are classroom-tuned so the four real 2026 eclipses
 * (Feb 17 solar, Mar 3 lunar, Aug 12 solar, Aug 28 lunar) are highlighted
 * without flagging neighbouring months: successive lunations shift F by
 * ~31°, so windows narrower than ±15° never double-flag.
 */
/** Argument of latitude F = L' − Ω (deg). Exported for lessons/tests. */
export function argumentOfLatitude(jd: number): number {
  const d = jd - J2000;
  const lPrime = norm360(218.3164477 + 13.17639648 * d);
  const omega = norm360(125.04452 - 0.0529538083 * d);
  return norm360(lPrime - omega);
}

function distToTarget(angle: number, targets: number[]): number {
  let best = 180;
  for (const t of targets) {
    const d = Math.abs(norm360(angle - t));
    best = Math.min(best, d > 180 ? 360 - d : d);
  }
  return best;
}

/** Signed moon latitude approximation (deg). */
export function moonLatitudeApprox(jd: number): number {
  const F = argumentOfLatitude(jd);
  return rad2deg(Math.asin(Math.sin(deg2rad(5.14)) * Math.sin(deg2rad(F))));
}

/** Days away from new moon (0 at new moon), from true elongation. */
function daysFromNewMoon(jd: number): number {
  const pa = moonPhaseAngle(jd);
  return (Math.min(pa, 360 - pa) / 360) * MOON_SYNODIC_DAYS;
}

/** Days away from full moon (0 at full moon), from true elongation. */
function daysFromFullMoon(jd: number): number {
  const pa = moonPhaseAngle(jd);
  return (Math.abs(pa - 180) / 360) * MOON_SYNODIC_DAYS;
}

/**
 * Nodal distance (deg) evaluated AT the syzygy instant, not at the scan
 * day: F drifts 13.2°/day, so judging F a day away from new/full moon
 * would flag months where the Moon merely passes the node days later.
 * Mean phase rate (360°/29.53d) is enough for this classroom snap.
 */
function snapToNewMoon(jd: number): number {
  const pa = moonPhaseAngle(jd);
  const signed = pa > 180 ? pa - 360 : pa; // (−180, 180]
  return jd - (signed / 360) * MOON_SYNODIC_DAYS;
}

function snapToFullMoon(jd: number): number {
  const pa = moonPhaseAngle(jd);
  return jd - ((pa - 180) / 360) * MOON_SYNODIC_DAYS;
}

export function isSolarEclipseWindow(jd: number): { eclipse: boolean; score: number } {
  const nearNew = daysFromNewMoon(jd);
  if (nearNew > 1.2) return { eclipse: false, score: 0 };
  const F = argumentOfLatitude(snapToNewMoon(jd));
  const nodeDist = distToTarget(F, [0, 180]);
  // Classroom threshold: narrower than the per-lunation F step (~31°)
  // so neighbouring months are never double-flagged.
  if (nodeDist > 14) return { eclipse: false, score: 0 };
  return { eclipse: true, score: 1 - nodeDist / 14 };
}

export function isLunarEclipseWindow(jd: number): { eclipse: boolean; score: number } {
  const distFull = daysFromFullMoon(jd);
  if (distFull > 1.2) return { eclipse: false, score: 0 };
  // Lunar eclipses (especially partial/penumbral) tolerate a wider nodal
  // distance than solar ones — still narrower than the ~31° F step.
  const F = argumentOfLatitude(snapToFullMoon(jd));
  const nodeDist = distToTarget(F, [0, 180]);
  if (nodeDist > 15) return { eclipse: false, score: 0 };
  return { eclipse: true, score: 1 - nodeDist / 15 };
}

export function eclipseStatus(jd: number): { solar: boolean; lunar: boolean; label: string } {
  const s = isSolarEclipseWindow(jd).eclipse;
  const l = isLunarEclipseWindow(jd).eclipse;
  let label = '없음';
  if (s && l) label = '일식·월식 가능 구간';
  else if (s) label = '일식 가능 구간 (삭 근처·황백교점 부근)';
  else if (l) label = '월식 가능 구간 (망 근처·황백교점 부근)';
  return { solar: s, lunar: l, label };
}

/** Scan [startJd, endJd] in 0.5-day steps and cluster eclipse windows. */
export function predictEclipses(startJd: number, endJd: number): EclipseEvent[] {
  const events: EclipseEvent[] = [];
  let open: { kind: 'solar' | 'lunar'; bestJd: number; bestScore: number } | null = null;

  const flush = () => {
    if (!open) return;
    const date = julianToDate(open.bestJd);
    const iso = date.toISOString().slice(0, 10);
    events.push({
      kind: open.kind,
      jd: open.bestJd,
      dateISO: iso,
      gamma: open.bestScore,
      description:
        open.kind === 'solar'
          ? `일식 가능 구간 (${iso}) — 삭(신월)이 황백교점 근처에서 일어납니다`
          : `월식 가능 구간 (${iso}) — 망(보름달)이 황백교점 근처에서 일어납니다`,
    });
    open = null;
  };

  for (let jd = startJd; jd <= endJd; jd += 0.5) {
    const s = isSolarEclipseWindow(jd);
    const l = isLunarEclipseWindow(jd);
    const kind: 'solar' | 'lunar' | null = s.eclipse ? 'solar' : l.eclipse ? 'lunar' : null;
    const score = s.eclipse ? s.score : l.score;
    if (!kind) {
      flush();
      continue;
    }
    if (!open || open.kind !== kind) {
      flush();
      open = { kind, bestJd: jd, bestScore: score };
    } else if (score > open.bestScore) {
      open.bestJd = jd;
      open.bestScore = score;
    }
  }
  flush();
  return events;
}
