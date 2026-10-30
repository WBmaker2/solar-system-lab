// Tiny pub/sub store (no external dependency). Holds simulation time state.
import { DAY_MS, dateToJulian, julianToDate } from '../astro/julian';

export type SpeedKey = 'day' | 'month' | 'year';
export const SPEEDS: Record<SpeedKey, { daysPerSec: number; label: string }> = {
  day: { daysPerSec: 1, label: '1일/초' },
  month: { daysPerSec: 30, label: '1개월/초' },
  year: { daysPerSec: 120, label: '빠르게' },
};

export interface TimeState {
  jd: number;
  playing: boolean;
  speed: number; // days per second
  speedKey: SpeedKey;
}

type Listener = (s: TimeState) => void;

const START = Date.UTC(2026, 2, 21, 12, 0, 0); // 2026-03-21 춘분 근처에서 시작

export class TimeStore {
  private state: TimeState = {
    jd: dateToJulian(new Date(START)),
    playing: false,
    speed: SPEEDS.day.daysPerSec,
    speedKey: 'day',
  };
  private listeners = new Set<Listener>();

  get(): TimeState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  setJulian(jd: number): void {
    this.state = { ...this.state, jd };
    this.emit();
  }

  addDays(days: number): void {
    this.setJulian(this.state.jd + days);
  }

  setDate(date: Date): void {
    this.setJulian(dateToJulian(date));
  }

  getDate(): Date {
    return julianToDate(this.state.jd);
  }

  setPlaying(playing: boolean): void {
    this.state = { ...this.state, playing };
    this.emit();
  }

  toggle(): void {
    this.setPlaying(!this.state.playing);
  }

  setSpeedKey(key: SpeedKey): void {
    this.state = { ...this.state, speedKey: key, speed: SPEEDS[key].daysPerSec };
    this.emit();
  }

  /** Advance simulation clock by wall-clock dt (seconds). */
  tick(dtSec: number): void {
    if (!this.state.playing) return;
    this.state = { ...this.state, jd: this.state.jd + this.state.speed * dtSec };
    this.emit();
  }

  /** For tests: Julian date after dt seconds of playback. */
  project(dtSec: number): number {
    return this.state.jd + this.state.speed * dtSec;
  }
}

export function msToDays(ms: number): number {
  return ms / DAY_MS;
}
