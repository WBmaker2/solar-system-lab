import { dayLengthTable, solarNoonAltitude } from '../astro/seasons';
import type { TimeStore } from '../stores/timeStore';

/** F4: latitude vs day-length bar graph (pure SVG, no chart dependency). */
export class Graphs {
  private unsub: (() => void) | null = null;

  constructor(private root: HTMLElement, private time: TimeStore) {
    root.innerHTML = `
      <section aria-labelledby="graph-heading" class="card">
        <h2 id="graph-heading">계절 그래프 <span class="en">Seasons</span></h2>
        <p class="muted">위도별 낮 길이와 서울 정오 태양 고도. 하짓날 남중 고도가 가장 높고 낮이 가장 깁니다.</p>
        <div id="gr-chart"></div>
        <p id="gr-noon" class="summary"></p>
      </section>`;
    this.unsub = this.time.subscribe((s) => this.render(s.jd));
  }

  private render(jd: number): void {
    const rows = dayLengthTable(jd);
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
    const noon = solarNoonAltitude(jd, 37.56);
    this.root.querySelector('#gr-noon')!.textContent = `서울 정오 태양 고도: ${noon.toFixed(1)}°`;
  }

  destroy(): void {
    this.unsub?.();
  }
}
