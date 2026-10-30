import { eclipseStatus } from '../astro/eclipses';
import { SolarScene } from '../scene/SolarScene';
import { ModelStore } from '../stores/modelStore';
import { applySharedState, collectSharedState, decodeSharedState, encodeSharedState } from '../stores/share';
import { TimeStore } from '../stores/timeStore';
import { ViewStore, type ViewMode } from '../stores/viewStore';
import { EclipsePanel } from '../ui/EclipsePanel';
import { Graphs } from '../ui/Graphs';
import { InfoCard } from '../ui/InfoCard';
import { ObserverPanel } from '../ui/ObserverPanel';
import { QuizPanel } from '../ui/QuizPanel';
import { TimePanel } from '../ui/TimePanel';

const VIEW_LABELS: Array<{ id: ViewMode; ko: string }> = [
  { id: 'space', ko: '우주' },
  { id: 'earth', ko: '지구 따라가기' },
  { id: 'moon', ko: '달 따라가기' },
  { id: 'observer', ko: '관측자' },
];

export class App {
  private time = new TimeStore();
  private view = new ViewStore();
  private model = new ModelStore();
  private scene: SolarScene | null = null;

  constructor(private root: HTMLElement) {
    this.root.innerHTML = `
      <a class="skip-link" href="#main">본문으로 건너뛰기</a>
      <header class="topbar">
        <h1>Solar System Lab <span class="sub">3D 태양계 &amp; 지구과학 실험실</span></h1>
        <p class="top-desc">공전·자전·계절·달의 위상·일식과 월식을 직접 조작하며 배워요 (초5~중3).</p>
        <div class="row share-row">
          <button id="share-btn" type="button">🔗 이 장면 링크 복사</button>
          <span id="share-msg" class="muted" aria-live="polite"></span>
        </div>
      </header>
      <nav class="mobile-tabs" aria-label="화면 전환">
        <button type="button" data-tab="scene" class="active" aria-pressed="true">장면</button>
        <button type="button" data-tab="lab" aria-pressed="false">관측·분석</button>
        <button type="button" data-tab="panels" aria-pressed="false">시간·정보</button>
        <button type="button" data-tab="quiz" aria-pressed="false">퀴즈</button>
      </nav>
      <main id="main" class="layout" data-tab="scene">
        <section class="stage" aria-label="3D 장면">
          <div class="toolbar" role="group" aria-label="시점과 표시 설정">
            <div class="seg" role="group" aria-label="시점 전환">
              ${VIEW_LABELS.map((v) => `<button type="button" data-view="${v.id}">${v.ko}</button>`).join('')}
            </div>
            <div class="seg" role="group" aria-label="크기 모형">
              <button type="button" data-scale="classroom">수업용 크기</button>
              <button type="button" data-scale="realistic">실제 비율 크기</button>
            </div>
            <label class="check"><input type="checkbox" id="tgl-orbits" checked /> 궤도선</label>
            <label class="check"><input type="checkbox" id="tgl-labels" checked /> 이름표</label>
          </div>
          <div id="scene-wrap" class="scene-wrap">
            <canvas id="scene" aria-label="태양 지구 달 3D 장면. 드래그로 회전, 스크롤로 확대할 수 있습니다."></canvas>
          </div>
          <p id="eclipse-badge" class="badge stage-badge" hidden></p>
          <p class="model-note">개념 모형: 원형 궤도 근사 · 크기·거리 과장됨 · 천문 계산은 수업용 근사식</p>
        </section>
        <section class="lab-row" aria-label="관측과 분석">
          <div id="ui-graphs"></div>
          <div id="ui-observer"></div>
        </section>
        <aside class="panel" aria-label="조작 패널">
          <div id="ui-time"></div>
          <div id="ui-info"></div>
          <div id="ui-eclipse"></div>
        </aside>
        <section class="quiz-wrap" aria-label="퀴즈">
          <div id="ui-quiz"></div>
        </section>
      </main>
      <footer class="footer"><small>Keyboard: 슬라이더·버튼은 Tab과 방향키로 조작할 수 있습니다. 움직임 줄이기 설정에서는 자동 애니메이션을 줄였습니다.</small></footer>
    `;

    this.wireToolbar();
    this.wireMobileTabs();

    // Restore a shared scene before anything renders (panels scene read
    // store state on subscribe, so this must come first).
    const shared = decodeSharedState(window.location.hash);
    if (shared) applySharedState(this.time, this.view, this.model, shared);

    const canvas = this.root.querySelector<HTMLCanvasElement>('#scene')!;
    const wrap = this.root.querySelector<HTMLElement>('#scene-wrap')!;
    try {
      this.scene = new SolarScene(canvas, wrap, this.time, this.view, {
        onSelect: () => undefined,
      }, this.model);
    } catch (err) {
      // Headless / no-WebGL environments: keep every panel functional.
      console.warn('3D 장면을 초기화하지 못했습니다. 2D 패널은 정상 동작합니다.', err);
      wrap.innerHTML = '<p class="model-note">이 브라우저에서는 3D(WebGL)를 사용할 수 없어 2D 정보 패널만 표시됩니다.</p>';
    }

    const q = (sel: string): HTMLElement => {
      const el = this.root.querySelector<HTMLElement>(sel);
      if (!el) throw new Error(`missing ${sel}`);
      return el;
    };
    // Panels self-subscribe to stores (stores hold the listeners alive).
    new TimePanel(q('#ui-time'), this.time);
    new InfoCard(q('#ui-info'), this.time, this.view, this.model);
    new Graphs(q('#ui-graphs'), this.time, this.model);
    new ObserverPanel(q('#ui-observer'), this.time, this.model);
    new EclipsePanel(q('#ui-eclipse'), this.time);
    new QuizPanel(q('#ui-quiz'), this.time);
    this.time.subscribe((s) => this.onTime(s.jd));
    this.view.subscribe((v) => this.onView(v.mode));
    this.onView(this.view.get().mode);
    this.wireSharing();
  }

  private wireToolbar(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        const mode = b.dataset.view as ViewMode;
        if (mode === 'observer') {
          this.view.patch({ mode, followEarth: true });
          // NOTE: intentionally no scrollIntoView here — keep the user's
          // viewport stable and only flash the observer card in place.
          this.root.querySelector('#ui-observer .card')?.classList.add('highlight');
          window.setTimeout(() => this.root.querySelector('#ui-observer .card')?.classList.remove('highlight'), 2400);
        } else {
          this.view.patch({ mode, followEarth: mode !== 'space' });
        }
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) => {
      b.addEventListener('click', () => {
        this.view.patch({ scale: b.dataset.scale === 'realistic' ? 'realistic' : 'classroom' });
      });
    });
    this.root.querySelector('#tgl-orbits')?.addEventListener('change', (e) => {
      this.view.patch({ showOrbits: (e.target as HTMLInputElement).checked });
    });
    this.root.querySelector('#tgl-labels')?.addEventListener('change', (e) => {
      this.view.patch({ showLabels: (e.target as HTMLInputElement).checked });
    });
  }

  private wireMobileTabs(): void {
    const main = this.root.querySelector<HTMLElement>('#main')!;
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        main.dataset.tab = b.dataset.tab ?? 'scene';
        this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((x) => {
          const active = x === b;
          x.classList.toggle('active', active);
          x.setAttribute('aria-pressed', String(active));
        });
      });
    });
  }

  private onView(mode: ViewMode): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
      const active = b.dataset.view === mode;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const scale = this.view.get().scale;
    this.root.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((b) => {
      const active = (b.dataset.scale ?? 'classroom') === scale;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  private onTime(jd: number): void {
    const st = eclipseStatus(jd);
    const badge = this.root.querySelector('#eclipse-badge') as HTMLElement;
    if (st.solar || st.lunar) {
      badge.hidden = false;
      badge.textContent = st.solar && st.lunar
        ? '🌒 지금은 일식·월식 가능 구간입니다'
        : st.solar ? '🌞 지금은 일식 가능 구간입니다' : '🌚 지금은 월식 가능 구간입니다';
    } else {
      badge.hidden = true;
    }
    this.scene?.setEclipseHighlight(st.solar, st.lunar);
  }

  /** URL 공유: 해시 복원·자동 반영·링크 복사. */
  private wireSharing(): void {
    const msg = this.root.querySelector('#share-msg') as HTMLElement;
    const syncHash = (): void => {
      const hash = encodeSharedState(collectSharedState(this.time, this.view, this.model));
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash);
      }
    };
    let timer = 0;
    const schedule = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(syncHash, 400);
    };
    this.time.subscribe(schedule);
    this.view.subscribe(schedule);
    this.model.subscribe(schedule);
    window.addEventListener('hashchange', () => {
      const shared = decodeSharedState(window.location.hash);
      if (shared) applySharedState(this.time, this.view, this.model, shared);
    });

    this.root.querySelector('#share-btn')?.addEventListener('click', async () => {
      syncHash();
      window.clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(window.location.href);
        msg.textContent = '링크를 복사했습니다. 수업 자료에 붙여넣으세요.';
      } catch {
        msg.textContent = '자동 복사가 안 됩니다. 주소창의 링크를 직접 복사해 주세요.';
      }
      window.setTimeout(() => { msg.textContent = ''; }, 4000);
    });
  }
}
