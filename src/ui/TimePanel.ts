import { formatDateUTC } from '../astro/julian';
import { SPEEDS, type SpeedKey, type TimeStore } from '../stores/timeStore';

const SPEED_KEYS: SpeedKey[] = ['day', 'month', 'year'];

export class TimePanel {
  private els: Record<string, HTMLElement> = {};
  private unsub: (() => void) | null = null;
  private sliderSync = false;

  constructor(private root: HTMLElement, private time: TimeStore) {
    root.innerHTML = `
      <section aria-labelledby="time-heading" class="card">
        <h2 id="time-heading">시간 조절 <span class="en">Time</span></h2>
        <p class="date-line"><strong id="tp-date">—</strong> <span id="tp-season" class="muted"></span></p>
        <div class="row">
          <button id="tp-play" class="btn-pulse" type="button" aria-pressed="false">▶ 재생하기</button>
          <button id="tp-now" type="button">오늘로</button>
        </div>
        <label class="field">날짜 슬라이더 (1년)
          <input id="tp-slider" type="range" min="0" max="364" step="1" value="0" aria-describedby="tp-date" />
        </label>
        <div class="row" role="group" aria-label="하루 한 달 일 년 이동">
          <button id="tp-m-year" type="button">−1년</button>
          <button id="tp-m-month" type="button">−1개월</button>
          <button id="tp-m-day" type="button">−1일</button>
          <button id="tp-p-day" type="button">+1일</button>
          <button id="tp-p-month" type="button">+1개월</button>
          <button id="tp-p-year" type="button">+1년</button>
        </div>
        <fieldset class="speeds">
          <legend>재생 속도</legend>
          <div class="row" role="group" aria-label="재생 속도">
            ${SPEED_KEYS.map((k) => `<button type="button" data-speed="${k}">${SPEEDS[k].label}</button>`).join('')}
          </div>
        </fieldset>
        <label class="field">날짜 직접 입력
          <input id="tp-input" type="date" value="2026-03-21" min="2020-01-01" max="2032-12-31" />
        </label>
      </section>`;
    const q = (id: string): HTMLElement => {
      const el = root.querySelector<HTMLElement>(`#${id}`);
      if (!el) throw new Error(`missing #${id}`);
      this.els[id] = el;
      return el;
    };
    ['tp-date', 'tp-season', 'tp-play', 'tp-now', 'tp-slider', 'tp-input',
      'tp-m-year', 'tp-m-month', 'tp-m-day', 'tp-p-day', 'tp-p-month', 'tp-p-year'].forEach(q);

    (this.els['tp-play'] as HTMLButtonElement).addEventListener('click', () => this.time.toggle());
    (this.els['tp-now'] as HTMLButtonElement).addEventListener('click', () => {
      const now = new Date();
      this.time.setDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12)));
    });
    const step = (days: number) => () => this.time.addDays(days);
    (this.els['tp-m-day'] as HTMLButtonElement).addEventListener('click', step(-1));
    (this.els['tp-p-day'] as HTMLButtonElement).addEventListener('click', step(1));
    (this.els['tp-m-month'] as HTMLButtonElement).addEventListener('click', step(-30));
    (this.els['tp-p-month'] as HTMLButtonElement).addEventListener('click', step(30));
    (this.els['tp-m-year'] as HTMLButtonElement).addEventListener('click', step(-365));
    (this.els['tp-p-year'] as HTMLButtonElement).addEventListener('click', step(365));

    (this.els['tp-slider'] as HTMLInputElement).addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      const d = this.time.getDate();
      const start = Date.UTC(d.getUTCFullYear(), 0, 1, 12);
      this.sliderSync = true;
      this.time.setJulian((start / 86_400_000) + 2440587.5 + v);
      this.sliderSync = false;
    });
    (this.els['tp-input'] as HTMLInputElement).addEventListener('change', (e) => {
      const v = (e.target as HTMLInputElement).value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, d] = v.split('-').map(Number);
        this.time.setDate(new Date(Date.UTC(y, m - 1, d, 12)));
      }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
      b.addEventListener('click', () => this.time.setSpeedKey(b.dataset.speed as SpeedKey));
    });

    this.unsub = this.time.subscribe((s) => this.render(s.jd, s.playing, s.speedKey));
  }

  private render(jd: number, playing: boolean, speedKey: SpeedKey): void {
    const date = new Date((jd - 2440587.5) * 86_400_000);
    (this.els['tp-date'] as HTMLElement).textContent = `${formatDateUTC(date)} (율리우스일 ${jd.toFixed(2)})`;
    const play = this.els['tp-play'] as HTMLButtonElement;
    play.textContent = playing ? '⏸ 정지하기' : '▶ 재생하기';
    play.setAttribute('aria-pressed', String(playing));
    if (!this.sliderSync) {
      const start = Date.UTC(date.getUTCFullYear(), 0, 1);
      const day = Math.min(364, Math.max(0, Math.floor((date.getTime() - start) / 86_400_000)));
      (this.els['tp-slider'] as HTMLInputElement).value = String(day);
    }
    const input = this.els['tp-input'] as HTMLInputElement;
    if (document.activeElement !== input) input.value = formatDateUTC(date);
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => {
      const active = b.dataset.speed === speedKey;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  setSeasonText(text: string): void {
    this.els['tp-season'].textContent = text;
  }

  destroy(): void {
    this.unsub?.();
  }
}
