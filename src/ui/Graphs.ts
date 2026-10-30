import { OBLIQUITY_DEG } from '../astro/orbits';
import { dayLengthTable, solarNoonAltitude } from '../astro/seasons';
import type { ModelStore } from '../stores/modelStore';
import type { TimeStore } from '../stores/timeStore';

/** F4 + 기울기 실험실: latitude vs day-length bar graph (pure SVG, no chart dependency). */
export class Graphs {
  private unsubTime: (() => void) | null = null;
  private unsubModel: (() => void) | null = null;
  private jd = 0;
  private obliquity = OBLIQUITY_DEG;

  constructor(private root: HTMLElement, private time: TimeStore, private model: ModelStore) {
    root.innerHTML = `
      <section aria-labelledby="graph-heading" class="card">
        <h2 id="graph-heading">계절 그래프 <span class="en">Seasons</span></h2>
        <p class="muted">위도별 낮 길이와 서울 정오 태양 고도. 하짓날 남중 고도가 가장 높고 낮이 가장 깁니다.</p>
        <fieldset class="tilt-lab">
          <legend>기울기 실험실 — 자전축을 바꾸면 계절이 어떻게 달라질까요?</legend>
          <label class="field">자전축 기울기 <output id="gr-tilt-val" for="tilt-slider">23.4°</output>
            <input id="tilt-slider" type="range" min="0" max="45" step="0.1" value="23.4" aria-describedby="gr-tilt-hint" />
          </label>
          <p id="gr-tilt-hint" class="muted">0°에서는 계절이 사라지고, 많이 기울일수록 여름과 겨울의 차이가 커집니다.</p>
          <div class="row" role="group" aria-label="기울기 프리셋">
            <button type="button" data-tilt="0">0° (기울기 없음)</button>
            <button type="button" data-tilt="23.4">23.4° (지금 지구)</button>
            <button type="button" data-tilt="45">45° (많이 기울임)</button>
          </div>
        </fieldset>
        <div id="gr-chart"></div>
        <p id="gr-noon" class="summary"></p>
      </section>`;
    (root.querySelector('#tilt-slider') as HTMLInputElement).addEventListener('input', (e) => {
      this.model.setObliquity(Number((e.target as HTMLInputElement).value));
    });
    root.querySelectorAll<HTMLButtonElement>('[data-tilt]').forEach((b) => {
      b.addEventListener('click', () => this.model.setObliquity(Number(b.dataset.tilt)));
    });
    this.unsubTime = this.time.subscribe((s) => {
      this.jd = s.jd;
      this.render();
    });
    this.unsubModel = this.model.subscribe((m) => {
      this.obliquity = m.obliquityDeg;
      const slider = root.querySelector('#tilt-slider') as HTMLInputElement;
      if (document.activeElement !== slider) slider.value = String(m.obliquityDeg);
      (root.querySelector('#gr-tilt-val') as HTMLOutputElement).textContent = `${m.obliquityDeg.toFixed(1)}°`;
      this.render();
    });
  }

  private render(): void {
    if (!this.jd) return;
    const rows = dayLengthTable(this.jd, undefined, this.obliquity);
    const max = 24;
    const W = 520, rowH = 34, pad = 150;
    const H = rows.length * rowH + 16;
    const bars = rows.map((r, i) => {
      const w = ((W - pad - 60) * r.hours) / max;
      const y = 8 + i * rowH;
      const seoul = Math.abs(r.lat - 37.6) < 0.1;
      return `<g>
        <text x="0" y="${y + 15}" font-size="13" fill="${seoul ? '#ffd166' : '#c7d3ea'}">${r.lat > 0 ? `북위 ${r.lat}°` : r.lat < 0 ? `남위 ${Math.abs(r.lat)}°` : '적도 0°'}${seoul ? ' ★서울' : ''}</text>
        <rect x="${pad}" y="${y}" width="${w.toFixed(1)}" height="18" rx="4" fill="${seoul ? '#ffd166' : '#4da3ff'}"/>
        <text x="${pad + w + 6}" y="${y + 15}" font-size="12" fill="#c7d3ea">${r.hours.toFixed(1)}h</text>
      </g>`;
    }).join('');
    this.root.querySelector('#gr-chart')!.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="위도별 낮 길이 그래프" class="graph-svg">${bars}</svg>`;
    const noon = solarNoonAltitude(this.jd, 37.56, this.obliquity);
    this.root.querySelector('#gr-noon')!.textContent =
      `서울 정오 태양 고도: ${noon.toFixed(1)}° (기울기 ${this.obliquity.toFixed(1)}°)`;
  }

  destroy(): void {
    this.unsubTime?.();
    this.unsubModel?.();
  }
}
