import { MISSIONS, checkMission, totalPoints } from '../data/quiz';
import type { TimeStore } from '../stores/timeStore';

const SCORE_KEY = 'solar-system-lab-score-v1';

export class QuizPanel {
  private unsub: (() => void) | null = null;
  private cleared = new Set<string>(QuizPanel.load());
  private openMission: string | null = null;

  constructor(private root: HTMLElement, private time: TimeStore) {
    root.innerHTML = `
      <section aria-labelledby="quiz-heading" class="card quiz">
        <div class="quiz-head">
          <h2 id="quiz-heading">도전! 퀴즈 <span class="en">Quiz</span></h2>
          <p id="qz-score" class="score" aria-live="polite"></p>
        </div>
        <ol id="qz-list" class="quiz-list"></ol>
      </section>`;
    this.renderList();
    this.updateScore();
    this.unsub = this.time.subscribe(() => undefined);
  }

  private static load(): string[] {
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(SCORE_KEY, JSON.stringify([...this.cleared]));
    } catch {
      /* storage unavailable — ignore */
    }
  }

  private updateScore(): void {
    const pts = MISSIONS.filter((m) => this.cleared.has(m.id)).reduce((a, m) => a + m.points, 0);
    this.root.querySelector('#qz-score')!.textContent = `내 점수 ${pts} / ${totalPoints()}점`;
  }

  private renderList(): void {
    const ol = this.root.querySelector('#qz-list') as HTMLOListElement;
    ol.innerHTML = '';
    for (const m of MISSIONS) {
      const li = document.createElement('li');
      li.className = 'quiz-item';
      const done = this.cleared.has(m.id);
      li.innerHTML = `
        <strong>${done ? '✅ ' : ''}${m.title} <span class="points">${m.points}점</span></strong>
        <p>${m.prompt}</p>
        <p class="hint" ${this.openMission === m.id ? '' : 'hidden'}>💡 힌트: ${m.hint}</p>
        <p class="result" aria-live="polite"></p>
        <div class="row">
          <button type="button" data-act="hint">힌트 보기</button>
          <button type="button" data-act="check" class="btn-pulse">정답 확인하기</button>
        </div>`;
      const result = li.querySelector('.result') as HTMLElement;
      const checkBtn = li.querySelector('[data-act="check"]') as HTMLButtonElement;
      if (done) {
        checkBtn.disabled = true;
        checkBtn.textContent = '완료!';
      }
      li.querySelector('[data-act="hint"]')?.addEventListener('click', () => {
        this.openMission = this.openMission === m.id ? null : m.id;
        this.renderList();
      });
      checkBtn.addEventListener('click', () => {
        const s = this.time.get();
        const r = checkMission(m, { jd: s.jd, date: this.time.getDate() });
        result.textContent = r.detail;
        if (r.pass && !this.cleared.has(m.id)) {
          this.cleared.add(m.id);
          this.save();
          this.updateScore();
          const title = li.querySelector('strong');
          if (title && !title.textContent?.startsWith('✅')) {
            title.textContent = `✅ ${title.textContent ?? m.title}`;
          }
          checkBtn.disabled = true;
          checkBtn.textContent = '완료!';
        }
      });
      ol.appendChild(li);
    }
  }

  destroy(): void {
    this.unsub?.();
  }
}
