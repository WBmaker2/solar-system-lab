import { dateToJulian } from '../astro/julian';
import { predictEclipses, type EclipseEvent } from '../astro/eclipses';
import type { TimeStore } from '../stores/timeStore';

/** F5: eclipse predictor — yearly scan with jump-to-date buttons. */
export class EclipsePanel {
  private unsub: (() => void) | null = null;

  constructor(private root: HTMLElement, private time: TimeStore) {
    root.innerHTML = `
      <section aria-labelledby="eclipse-heading" class="card">
        <h2 id="eclipse-heading">일식·월식 예측 <span class="en">Eclipses</span></h2>
        <p class="muted">수업용 단순 모형(평균 황경+교점 후퇴)으로 찾은 <strong>가능 구간</strong>입니다. 실제 관측 가능 지역·종류와 다를 수 있어요.</p>
        <div class="row">
          <label>연도 <input id="ec-year" type="number" value="2026" min="2020" max="2032" step="1" /></label>
          <button id="ec-scan" type="button">예측 다시 계산</button>
        </div>
        <ul id="ec-list" class="eclipse-list"></ul>
      </section>`;
    const scan = (): void => {
      const year = Number((root.querySelector('#ec-year') as HTMLInputElement).value) || 2026;
      this.renderList(year);
    };
    root.querySelector('#ec-scan')?.addEventListener('click', scan);
    this.renderList(2026);
    this.unsub = this.time.subscribe(() => undefined);
  }

  private renderList(year: number): void {
    const start = dateToJulian(new Date(Date.UTC(year, 0, 1, 12)));
    const end = dateToJulian(new Date(Date.UTC(year, 11, 31, 12)));
    const events: EclipseEvent[] = predictEclipses(start, end);
    const ul = this.root.querySelector('#ec-list') as HTMLUListElement;
    ul.innerHTML = '';
    if (events.length === 0) {
      ul.innerHTML = '<li>이 해에는 뚜렷한 가능 구간이 없습니다.</li>';
      return;
    }
    for (const ev of events) {
      const li = document.createElement('li');
      const icon = ev.kind === 'solar' ? '🌞' : '🌚';
      li.innerHTML = `<span>${icon} ${ev.dateISO} — ${ev.kind === 'solar' ? '일식' : '월식'} 가능 구간</span> `;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '이 날짜로 이동';
      btn.addEventListener('click', () => this.time.setJulian(ev.jd));
      li.appendChild(btn);
      ul.appendChild(li);
    }
  }

  destroy(): void {
    this.unsub?.();
  }
}
