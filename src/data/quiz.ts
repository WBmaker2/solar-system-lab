import quizData from './quiz.json';
import { moonIllumination } from '../astro/phases';
import { eclipseStatus } from '../astro/eclipses';

export interface QuizCheckIllum { type: 'illumination'; min?: number; max?: number }
export interface QuizCheckDate { type: 'date'; month: number; day: number; toleranceDays: number }
export interface QuizCheckEclipse { type: 'eclipse' }
export type QuizCheck = QuizCheckIllum | QuizCheckDate | QuizCheckEclipse;

export interface QuizMission {
  id: string;
  title: string;
  prompt: string;
  hint: string;
  check: QuizCheck;
  points: number;
}

export const MISSIONS: QuizMission[] = (quizData as { missions: QuizMission[] }).missions;

export interface CheckContext {
  jd: number;
  date: Date;
}

export function checkMission(m: QuizMission, ctx: CheckContext): { pass: boolean; detail: string } {
  if (m.check.type === 'illumination') {
    const ill = moonIllumination(ctx.jd);
    const pct = (ill * 100).toFixed(1);
    if (m.check.min !== undefined) {
      return ill >= m.check.min
        ? { pass: true, detail: `조명율 ${pct}% — 조건 달성!` }
        : { pass: false, detail: `현재 조명율 ${pct}% — 목표 ${(m.check.min * 100).toFixed(0)}% 이상` };
    }
    const max = m.check.max ?? 0.02;
    return ill <= max
      ? { pass: true, detail: `조명율 ${pct}% — 조건 달성!` }
      : { pass: false, detail: `현재 조명율 ${pct}% — 목표 ${(max * 100).toFixed(0)}% 이하` };
  }
  if (m.check.type === 'date') {
    const target = Date.UTC(ctx.date.getUTCFullYear(), m.check.month - 1, m.check.day, 12);
    const diffDays = Math.abs(ctx.date.getTime() - target) / 86_400_000;
    return diffDays <= m.check.toleranceDays
      ? { pass: true, detail: `목표일과 ${diffDays.toFixed(1)}일 차이 — 조건 달성!` }
      : { pass: false, detail: `목표 ${m.check.month}/${m.check.day}와 ${diffDays.toFixed(0)}일 차이 — ±${m.check.toleranceDays}일 이내로 맞추세요` };
  }
  const st = eclipseStatus(ctx.jd);
  const hit = st.solar || st.lunar;
  return hit
    ? { pass: true, detail: `현재: ${st.label} — 조건 달성!` }
    : { pass: false, detail: '지금은 식 가능 구간이 아닙니다. 예측 목록의 날짜로 이동해 보세요.' };
}

export function totalPoints(): number {
  return MISSIONS.reduce((a, m) => a + m.points, 0);
}
