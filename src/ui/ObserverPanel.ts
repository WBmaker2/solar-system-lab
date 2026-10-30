import { renderSkySVG, sunAltitudeAt } from '../scene/skyView';
import type { ModelStore } from '../stores/modelStore';
import type { TimeStore } from '../stores/timeStore';

/** F2 (observer) + F3 helper panel: ground sky diagram + moon-phase viewer. */
export class ObserverPanel {
  private unsubTime: (() => void) | null = null;
  private unsubModel: (() => void) | null = null;
  private jd = 0;
  private obliquity = 23.4393;

  constructor(private root: HTMLElement, private time: TimeStore, model?: ModelStore) {
    root.innerHTML = `
      <section aria-labelledby="obs-heading" class="card">
        <h2 id="obs-heading">관측자 뷰 · 서울 <span class="en">Observer</span></h2>
        <p class="muted">지평선 위에 뜬 태양(실선)과 달(점선)의 하루 궤적입니다. 상단 시점 버튼에서 <strong>관측자</strong>를 누르면 3D 장면과 함께 볼 수 있어요.</p>
        <div id="ob-sky"></div>
        <p id="ob-now" class="summary" aria-live="polite"></p>
      </section>`;
    this.unsubTime = this.time.subscribe((s) => {
      this.jd = s.jd;
      this.render();
    });
    this.unsubModel = model?.subscribe((m) => {
      this.obliquity = m.obliquityDeg;
      this.render();
    }) ?? null;
  }

  private render(): void {
    if (!this.jd) return;
    const jd = this.jd;
    const date = this.time.getDate();
    this.root.querySelector('#ob-sky')!.innerHTML = renderSkySVG(jd, date, undefined, this.obliquity);
    const h = ((date.getUTCHours() + 9) % 24 + 24) % 24;
    const sun = sunAltitudeAt(h, jd, undefined, this.obliquity);
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    const when = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} (KST 기준)`;
    this.root.querySelector('#ob-now')!.textContent =
      sun.altitude >= 0
        ? `${when} — 태양이 지평선 위에 있습니다 (고도 약 ${sun.altitude.toFixed(1)}°)`
        : `${when} — 지금은 밤입니다 (태양 고도 약 ${sun.altitude.toFixed(1)}°)`;
  }

  destroy(): void {
    this.unsubTime?.();
    this.unsubModel?.();
  }
}
