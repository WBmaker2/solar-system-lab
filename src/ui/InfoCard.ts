import factsData from '../data/facts.json';
import { eclipseStatus } from '../astro/eclipses';
import { formatHour, moonPhase, moonRiseSetApproximate } from '../astro/phases';
import { PLANETS } from '../astro/orbits';
import { SEOUL_LAT, dayLengthHours, seasonNameNorthern, solarDeclination, solarNoonAltitude } from '../astro/seasons';
import { formatDateUTC } from '../astro/julian';
import type { TimeStore } from '../stores/timeStore';
import type { ViewState, ViewStore } from '../stores/viewStore';
import type { ModelStore } from '../stores/modelStore';

interface Fact { id: string; title: string; body: string }
const FACTS: Fact[] = (factsData as { facts: Fact[] }).facts;

export class InfoCard {
  private unsubTime: (() => void) | null = null;
  private unsubView: (() => void) | null = null;
  private unsubModel: (() => void) | null = null;
  private factIndex = 0;
  private lastJd = 0;
  private obliquity = 23.4393;

  constructor(
    private root: HTMLElement,
    private time: TimeStore,
    private view: ViewStore,
    model?: ModelStore,
  ) {
    root.innerHTML = `
      <section aria-labelledby="info-heading" class="card" aria-live="polite">
        <h2 id="info-heading">오늘의 우주 <span class="en">Info</span></h2>
        <p id="ic-summary" class="summary"></p>
        <dl class="facts-list">
          <div><dt>선택 천체</dt><dd id="ic-body">—</dd></div>
          <div><dt>계절 (북반구)</dt><dd id="ic-season">—</dd></div>
          <div><dt>자전축 기울기</dt><dd id="ic-tilt">—</dd></div>
          <div><dt>태양 적위</dt><dd id="ic-dec">—</dd></div>
          <div><dt>서울 낮 길이</dt><dd id="ic-daylen">—</dd></div>
          <div><dt>달 위상</dt><dd id="ic-moon">—</dd></div>
          <div><dt>달 출몰 (대략)</dt><dd id="ic-moonrise">—</dd></div>
          <div><dt>일식·월식</dt><dd id="ic-eclipse">—</dd></div>
        </dl>
        <p id="ic-eclipse-badge" class="badge" hidden></p>
        <aside class="fact" aria-label="오늘의 과학 상식">
          <strong>🔭 <span id="ic-fact-title"></span></strong>
          <p id="ic-fact-body"></p>
          <button id="ic-fact-next" type="button">다른 상식 보기</button>
        </aside>
      </section>`;
    this.renderFact();
    root.querySelector('#ic-fact-next')?.addEventListener('click', () => {
      this.factIndex = (this.factIndex + 1) % FACTS.length;
      this.renderFact();
    });
    this.unsubTime = this.time.subscribe((s) => this.render(s.jd));
    this.unsubView = this.view.subscribe((v) => this.renderBody(v));
    this.unsubModel = model?.subscribe((m) => {
      this.obliquity = m.obliquityDeg;
      this.render(this.lastJd || this.time.get().jd);
    }) ?? null;
  }

  private renderFact(): void {
    const f = FACTS[this.factIndex];
    this.root.querySelector('#ic-fact-title')!.textContent = f.title;
    this.root.querySelector('#ic-fact-body')!.textContent = f.body;
  }

  private renderBody(v: ViewState): void {
    const def = PLANETS.find((p) => p.id === v.selectedId);
    const label = v.selectedId === 'sun'
      ? '태양 — 태양계 중심의 별'
      : v.selectedId === 'moon'
        ? '달 — 지구의 위성'
        : def ? `${def.nameKo} (${def.nameEn}) — ${def.description}` : '—';
    this.root.querySelector('#ic-body')!.textContent = label;
  }

  private render(jd: number): void {
    if (!jd) return;
    this.lastJd = jd;
    const date = new Date((jd - 2440587.5) * 86_400_000);
    const phase = moonPhase(jd);
    const st = eclipseStatus(jd);
    const dec = solarDeclination(jd, this.obliquity);
    const dayLen = dayLengthHours(jd, SEOUL_LAT, this.obliquity);
    const noon = solarNoonAltitude(jd, SEOUL_LAT, this.obliquity);
    const { riseH, setH } = moonRiseSetApproximate(jd);
    const season = seasonNameNorthern(jd, date);

    this.root.querySelector('#ic-summary')!.textContent =
      `${formatDateUTC(date)} · ${season} · 서울 낮 ${dayLen.toFixed(1)}시간 · ${phase.emoji} ${phase.nameKo} ${(phase.illumination * 100).toFixed(1)}%`;
    this.root.querySelector('#ic-season')!.textContent = `${season} (정오 태양 고도 ${noon.toFixed(1)}°)`;
    this.root.querySelector('#ic-tilt')!.textContent = `${this.obliquity.toFixed(1)}°${Math.abs(this.obliquity - 23.4393) < 0.05 ? ' (지금 지구와 같음)' : ''}`;
    this.root.querySelector('#ic-dec')!.textContent = `${dec >= 0 ? '+' : ''}${dec.toFixed(2)}°`;
    this.root.querySelector('#ic-daylen')!.textContent = `${dayLen.toFixed(2)}시간 (서울 위도 ${SEOUL_LAT}°)`;
    this.root.querySelector('#ic-moon')!.textContent = `${phase.emoji} ${phase.nameKo} · 조명율 ${(phase.illumination * 100).toFixed(1)}% · 나이 ${phase.age.toFixed(1)}일`;
    this.root.querySelector('#ic-moonrise')!.textContent = `출 ${formatHour(riseH)} · 몰 ${formatHour(setH)} (지방시 근사)`;
    this.root.querySelector('#ic-eclipse')!.textContent = st.label;
    const badge = this.root.querySelector('#ic-eclipse-badge') as HTMLElement;
    if (st.solar || st.lunar) {
      badge.hidden = false;
      badge.textContent = st.solar && st.lunar ? '🌒 일식·월식 가능 구간!' : st.solar ? '🌞 일식 가능 구간!' : '🌚 월식 가능 구간!';
    } else {
      badge.hidden = true;
    }
    this.renderBody(this.view.get());
  }

  getLastJd(): number {
    return this.lastJd;
  }

  destroy(): void {
    this.unsubTime?.();
    this.unsubView?.();
    this.unsubModel?.();
  }
}
