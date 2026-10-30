import type { ModelStore } from './modelStore';
import { MAX_OBLIQUITY, MIN_OBLIQUITY } from './modelStore';
import type { TimeStore } from './timeStore';
import type { ScaleMode, ViewMode, ViewStore } from './viewStore';

export interface SharedState {
  v: 1;
  jd: number;
  mode: ViewMode;
  scale: ScaleMode;
  sel: string | null;
  obl: number;
}

const JD_MIN = 2415020.5; // 1900-01-01
const JD_MAX = 2500000.0; // far-future guard
const HASH_RE = /^#s=([A-Za-z0-9\-_]+)$/;

function toBase64Url(json: string): string {
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeSharedState(s: SharedState): string {
  return `#s=${toBase64Url(JSON.stringify(s))}`;
}

export function decodeSharedState(hash: string): SharedState | null {
  try {
    const m = HASH_RE.exec(hash.trim());
    if (!m) return null;
    const o = JSON.parse(fromBase64Url(m[1])) as Partial<SharedState>;
    if (o.v !== 1 || typeof o.jd !== 'number' || !(o.jd >= JD_MIN && o.jd <= JD_MAX)) return null;
    if (!['space', 'earth', 'moon', 'observer'].includes(o.mode as string)) return null;
    if (!['classroom', 'realistic'].includes(o.scale as string)) return null;
    if (typeof o.obl !== 'number' || !(o.obl >= MIN_OBLIQUITY && o.obl <= MAX_OBLIQUITY)) return null;
    if (o.sel !== null && o.sel !== undefined && typeof o.sel !== 'string') return null;
    return {
      v: 1,
      jd: o.jd,
      mode: o.mode as ViewMode,
      scale: o.scale as ScaleMode,
      sel: (o.sel as string | null | undefined) ?? null,
      obl: o.obl,
    };
  } catch {
    return null;
  }
}

export function collectSharedState(time: TimeStore, view: ViewStore, model: ModelStore): SharedState {
  const v = view.get();
  return { v: 1, jd: time.get().jd, mode: v.mode, scale: v.scale, sel: v.selectedId, obl: model.get().obliquityDeg };
}

export function applySharedState(time: TimeStore, view: ViewStore, model: ModelStore, s: SharedState): void {
  time.setJulian(s.jd);
  model.setObliquity(s.obl);
  view.patch({ mode: s.mode, scale: s.scale, selectedId: s.sel, followEarth: s.mode !== 'space' });
}
