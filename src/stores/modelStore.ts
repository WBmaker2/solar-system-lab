// Classroom model parameters (axial tilt). Same pub/sub pattern as timeStore/viewStore.
export const DEFAULT_OBLIQUITY = 23.4393;
export const MIN_OBLIQUITY = 0;
export const MAX_OBLIQUITY = 45;

export interface ModelState {
  obliquityDeg: number;
}

type Listener = (s: ModelState) => void;

export class ModelStore {
  private state: ModelState = { obliquityDeg: DEFAULT_OBLIQUITY };
  private listeners = new Set<Listener>();

  get(): ModelState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  setObliquity(deg: number): void {
    const clamped = Math.min(MAX_OBLIQUITY, Math.max(MIN_OBLIQUITY, deg));
    if (clamped === this.state.obliquityDeg) return;
    this.state = { obliquityDeg: clamped };
    for (const fn of this.listeners) fn(this.state);
  }

  reset(): void {
    this.setObliquity(DEFAULT_OBLIQUITY);
  }
}
