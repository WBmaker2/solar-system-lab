# A+B 구현계획 — 자전축 기울기 실험실 + URL 상태 공유

> **For agentic workers:** 인라인 실행(현재 세션에서 Task 순서대로 구현). 단계는 체크박스(`- [ ]`)로 추적.

**Goal:** 지구 자전축 기울기를 0~45°로 바꿔 계절의 까닭을 실험하는 기능과, 현재 화면 상태(날짜·시점·기울기)를 URL 하나로 공유하는 기능을 만든다.

**Architecture:** 황도경사각을 `seasons.ts` 전역 상수에서 함수 매개변수로 바꾼 뒤(기본값 유지), 기울기 값은 기존 스토어 패턴(`timeStore`·`viewStore`와 동일한 pub/sub)의 새 `modelStore.ts`가 보관한다. URL 공유는 `#s=` 해시에 상태를 base64url 인코딩하며, 부팅 시 복원·변경 시 자동 반영한다.

**Tech Stack:** TypeScript + Three.js(기존), 신규 의존성 없음, 테스트 Vitest + Playwright(Chromium·WebKit).

**Spec:** docs/UPDATELOG.md의 A+B 항목 승인 내용(2026-10-30 대화: A 자전축 실험실 + B URL 공유 함께 진행).

## Global Constraints

- `npm run verify`(타입체크·린트·단위테스트·빌드)가 항상 통과해야 한다.
- 새 하드코딩 상수 금지 — 기존 `OBLIQUITY_DEG = 23.4393`을 기본값으로 재사용한다.
- 일식·월식 판정(`eclipses.ts`)은 황백교점 기준이라 기울기와 무관하다 — 건드리지 않는다.
- 퀴즈 정답 판정(하지·동지 날짜)은 달력 기준이라 기울기와 무관하다 — 건드리지 않는다.
- 모바일 탭·키보드 조작·`prefers-reduced-motion` 동작을 깨지 않는다.
- 쉬운 한국어 UI 문구, 교사가 JSON 없이 쓸 수 있는 수준을 유지한다.

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/stores/modelStore.ts` (신규) | 기울기 상태 `{ obliquityDeg }` 보관. `timeStore`와 동일한 subscribe/patch 패턴 |
| `src/astro/seasons.ts` (수정) | `solarDeclination`·`solarNoonAltitude`·`dayLengthHours`·`dayLengthTable`에 `obliquity = OBLIQUITY_DEG` 선택 매개변수 추가 |
| `src/scene/skyView.ts` (수정) | `renderSkySVG`·`moonAltitudeAt`·`sunAltitudeAt`에 `obliquity` 전달(기본값 유지) |
| `src/scene/SolarScene.ts` (수정) | 생성자에 `model?: ModelStore` 추가, 구독 시 `earthGroup.rotation.z` 실시간 갱신 |
| `src/ui/Graphs.ts` (수정) | "기울기 실험실" 슬라이더(0~45°, 0.1 단위) + `0°`·`23.4°`·`45°` 프리셋 버튼, model 구독 렌더 |
| `src/ui/InfoCard.ts` (수정) | model 구독, 기울기 값 표시 추가 (`계절` 행 옆 `기울기 ○○°`) |
| `src/ui/ObserverPanel.ts` (수정) | model 구독, `renderSkySVG`에 기울기 전달 |
| `src/stores/share.ts` (신규) | 해시 인코딩/디코딩 + `applySharedState`/`collectSharedState` |
| `src/app/App.ts` (수정) | 부팅 시 해시 복원(패널 생성 전), 3개 스토어 변경 시 해시 자동 반영(400ms 디바운스), 헤더 "이 장면 링크 복사" 버튼 |
| `src/tests/unit/tilt.test.ts` (신규) | 기울기 단위테스트 |
| `src/tests/unit/share.test.ts` (신규) | URL 인코딩 왕복 테스트 |
| `src/tests/e2e/app.spec.ts` (수정) | 기울기 슬라이더 e2e + 해시 복원 e2e 추가 |

---

### Task 1: 기울기 매개변수화 (astro)

**Files:**
- Modify: `src/astro/seasons.ts`
- Test: `src/tests/unit/tilt.test.ts`

**Interfaces:**
- Consumes: 기존 `OBLIQUITY_DEG`, `sunTrueGeocentricLongitude(jd)`
- Produces: `solarDeclination(jd, obliquity?)`, `solarNoonAltitude(jd, lat, obliquity?)`, `dayLengthHours(jd, lat, obliquity?)`, `dayLengthTable(jd, latitudes?, obliquity?)` — 전부 기본값 `OBLIQUITY_DEG`라 기존 호출부는 그대로 동작

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import { dateToJulian } from '../../astro/julian';
import { dayLengthHours, solarNoonAltitude } from '../../astro/seasons';

const JD = (iso: string): number => dateToJulian(new Date(`${iso}T12:00:00Z`));

describe('axial tilt lab', () => {
  it('zero obliquity means 12h days at every latitude', () => {
    for (const lat of [-60, -30, 0, 37.56, 60]) {
      expect(dayLengthHours(JD('2026-06-21'), lat, 0)).toBeCloseTo(12, 1);
    }
  });
  it('larger tilt means stronger seasonal contrast in Seoul', () => {
    const span = (obl: number): number =>
      dayLengthHours(JD('2026-06-21'), 37.56, obl) - dayLengthHours(JD('2026-12-22'), 37.56, obl);
    expect(span(45)).toBeGreaterThan(span(23.4393));
    expect(span(23.4393)).toBeGreaterThan(span(0));
  });
  it('default parameter keeps the classic 23.4° behavior', () => {
    expect(dayLengthHours(JD('2026-06-21'), 37.56)).toBeCloseTo(
      dayLengthHours(JD('2026-06-21'), 37.56, 23.4393), 9);
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npx vitest run src/tests/unit/tilt.test.ts`
Expected: FAIL — `dayLengthHours`가 3번째 인자를 받지 않아 TS 에러(또는 첫 테스트 실패)

- [ ] **Step 3: 최소 구현** — `seasons.ts`의 4개 함수에 `obliquity: number = OBLIQUITY_DEG` 추가, 내부의 `OBLIQUITY_DEG` 참조를 매개변수로 교체:

```ts
export function solarDeclination(jd: number, obliquity: number = OBLIQUITY_DEG): number {
  const lambda = deg2rad(sunTrueGeocentricLongitude(jd));
  const eps = deg2rad(obliquity);
  return rad2deg(Math.asin(Math.sin(eps) * Math.sin(lambda)));
}
```

`solarNoonAltitude(jd, latitudeDeg, obliquity = OBLIQUITY_DEG)`,
`dayLengthHours(jd, latitudeDeg, obliquity = OBLIQUITY_DEG)`,
`dayLengthTable(jd, latitudes = [...], obliquity = OBLIQUITY_DEG)` 동일 패턴.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/tests/unit/tilt.test.ts` + 전체 `npx vitest run`
Expected: 전부 PASS (기존 `astro.test.ts` 포함 — 기본값 덕분)

- [ ] **Step 5: 커밋**

```bash
git add src/astro/seasons.ts src/tests/unit/tilt.test.ts
git commit -m "자전축 기울기 매개변수화: seasons 계산에 obliquity 선택 인자 추가"
```

---

### Task 2: modelStore + 3D 축 기울기 연동

**Files:**
- Create: `src/stores/modelStore.ts`
- Modify: `src/scene/SolarScene.ts`

**Interfaces:**
- Consumes: Task 1 없음(독립). `ViewState` 패턴 모방
- Produces: `ModelStore` 클래스 — `get(): { obliquityDeg: number }`, `subscribe(fn): unsubscribe`, `setObliquity(deg)` (0~45로 클램프). `SolarScene` 생성자 5번째 선택 인자 `model?: ModelStore`

- [ ] **Step 1: 스토어 생성** (`timeStore.ts`의 subscribe/set 패턴 그대로):

```ts
export const DEFAULT_OBLIQUITY = 23.4393;
export const MIN_OBLIQUITY = 0;
export const MAX_OBLIQUITY = 45;

export interface ModelState { obliquityDeg: number; }
type Listener = (s: ModelState) => void;

export class ModelStore {
  private state: ModelState = { obliquityDeg: DEFAULT_OBLIQUITY };
  private listeners = new Set<Listener>();
  get(): ModelState { return this.state; }
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
}
```

- [ ] **Step 2: SolarScene 연동** — 생성자 시그니처에 `model?: ModelStore` 추가, 생성 직후 적용 + 구독:

```ts
this.applyObliquity(model?.get().obliquityDeg ?? 23.4393);
model?.subscribe((m) => this.applyObliquity(m.obliquityDeg));
```

```ts
private applyObliquity(deg: number): void {
  this.earthGroup.rotation.z = THREE.MathUtils.deg2rad(deg);
}
```

기존 생성자의 `rotation.z = deg2rad(23.4393)` 한 줄을 이 호출로 교체한다. 축 막대(axis stick)는 `earthGroup` 자식이므로 함께 기울어진다. 주야 셰이더는 월드 법선을 쓰므로 기울어진 채로도 terminator가 태양에 고정된다.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS (선택 인자라 `App.ts` 기존 호출 그대로 통과)

- [ ] **Step 4: 커밋**

```bash
git add src/stores/modelStore.ts src/scene/SolarScene.ts
git commit -m "modelStore 추가 및 3D 지구 자전축 실시간 기울기 연동"
```

---

### Task 3: UI 연동 (그래프 슬라이더·정보·관측자)

**Files:**
- Modify: `src/ui/Graphs.ts`, `src/ui/InfoCard.ts`, `src/ui/ObserverPanel.ts`, `src/scene/skyView.ts`
- Test: e2e 추가 (`src/tests/e2e/app.spec.ts`)

**Interfaces:**
- Consumes: Task 1의 `obliquity` 인자, Task 2의 `ModelStore`
- Produces: 화면의 기울기 슬라이더 `#tilt-slider`(0~45, step 0.1) + 프리셋 버튼 3개, 정보카드 `#ic-tilt` 행

- [ ] **Step 1: `skyView.ts`에 기울기 전달** — `sunAltitudeAt(hour, jd, lat = SEOUL_LAT, obliquity = OBLIQUITY_DEG)`, `moonAltitudeAt(hour, jd, lat = SEOUL_LAT, obliquity = OBLIQUITY_DEG)`, `renderSkySVG(jd, date, lat = SEOUL_LAT, obliquity = OBLIQUITY_DEG)`로 시그니처 확장 후 내부 `dayLengthHours`·`solarNoonAltitude`·`solarDeclination` 호출에 전달. `OBLIQUITY_DEG`는 `orbits.ts`에서 import.

- [ ] **Step 2: `Graphs.ts`** — 카드 상단에 필드셋 추가:

```html
<fieldset class="tilt-lab">
  <legend>기울기 실험실 — 자전축을 바꾸면 계절이 어떻게 달라질까요?</legend>
  <label>자전축 기울기 <output id="gr-tilt-val">23.4°</output>
    <input id="tilt-slider" type="range" min="0" max="45" step="0.1" value="23.4" />
  </label>
  <div class="row">
    <button type="button" data-tilt="0">0° (기울기 없음)</button>
    <button type="button" data-tilt="23.4">23.4° (지금 지구)</button>
    <button type="button" data-tilt="45">45° (많이 기울임)</button>
  </div>
</fieldset>
```

`render(jd)` → `render(jd, obliquity)`로 바꾸고 model 구독 추가. 슬라이더 input → `model.setObliquity()`.

- [ ] **Step 3: `InfoCard.ts`·`ObserverPanel.ts`** — model 구독 추가 후 계산 함수에 기울기 전달. InfoCard `계절` 행 아래에 `<div><dt>자전축 기울기</dt><dd id="ic-tilt">—</dd></div>` 추가.

- [ ] **Step 4: e2e 테스트 추가**

```ts
test('tilt slider changes seasonal contrast', async ({ page }) => {
  await page.goto('/');
  const noon = page.locator('#gr-noon');
  const before = await noon.textContent();
  await page.locator('#tilt-slider').fill('0');
  await expect(page.locator('#gr-tilt-val')).toContainText('0');
  const after = await noon.textContent();
  expect(before).not.toBe(after);
});
```

- [ ] **Step 5: 실행 확인** — `npx playwright test --project=chromium` PASS

- [ ] **Step 6: 커밋**

```bash
git add src/ui src/scene/skyView.ts src/tests/e2e/app.spec.ts
git commit -m "기울기 실험실 UI: 슬라이더·프리셋·정보/관측자 연동"
```

---

### Task 4: URL 상태 공유

**Files:**
- Create: `src/stores/share.ts`, `src/tests/unit/share.test.ts`
- Modify: `src/app/App.ts`

**Interfaces:**
- Consumes: Task 2의 `ModelStore`, 기존 `TimeStore`·`ViewStore`
- Produces: `encodeSharedState(s): string`, `decodeSharedState(hash): SharedState | null`, `collectSharedState(time, view, model): SharedState`, `applySharedState(stores, state): void`

상태 스키마(고정, 버전 포함):

```ts
export interface SharedState {
  v: 1;
  jd: number;
  mode: ViewMode;
  scale: ScaleMode;
  sel: string | null;
  obl: number;
}
```

- [ ] **Step 1: 실패하는 테스트 작성** (`share.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { decodeSharedState, encodeSharedState } from '../../stores/share';

describe('share', () => {
  it('round-trips state through the URL hash', () => {
    const s = { v: 1 as const, jd: 2461121.0, mode: 'earth' as const, scale: 'classroom' as const, sel: 'mars', obl: 30 };
    expect(decodeSharedState(encodeSharedState(s))).toEqual(s);
  });
  it('rejects garbage and out-of-range values', () => {
    expect(decodeSharedState('!!!not-base64!!!')).toBeNull();
    expect(decodeSharedState(encodeSharedState({ v: 1 as const, jd: 99_999_999, mode: 'earth' as const, scale: 'classroom' as const, sel: null, obl: 30 }))).toBeNull();
    expect(decodeSharedState(encodeSharedState({ v: 1 as const, jd: 2461121.0, mode: 'earth' as const, scale: 'classroom' as const, sel: null, obl: 999 }))).toBeNull();
  });
});
```

- [ ] **Step 2: 실행해 실패 확인** — `npx vitest run src/tests/unit/share.test.ts`, FAIL(모듈 없음)

- [ ] **Step 3: `share.ts` 최소 구현**:

```ts
import type { TimeStore } from './timeStore';
import { MAX_OBLIQUITY, MIN_OBLIQUITY, type ModelStore } from './modelStore';
import type { ScaleMode, ViewMode, ViewStore } from './viewStore';

export interface SharedState { v: 1; jd: number; mode: ViewMode; scale: ScaleMode; sel: string | null; obl: number; }

const JD_MIN = 2415020.5; // 1900-01-01
const JD_MAX = 2500000.0; // far future guard

function toBase64Url(json: string): string {
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeSharedState(s: SharedState): string {
  return `#s=${toBase64Url(JSON.stringify(s))}`;
}

export function decodeSharedState(hash: string): SharedState | null {
  try {
    const m = /^#s=([A-Za-z0-9\-_]+)$/.exec(hash.trim());
    if (!m) return null;
    const o = JSON.parse(fromBase64Url(m[1])) as Partial<SharedState>;
    if (o.v !== 1 || typeof o.jd !== 'number' || !(o.jd >= JD_MIN && o.jd <= JD_MAX)) return null;
    if (!['space', 'earth', 'moon', 'observer'].includes(o.mode as string)) return null;
    if (!['classroom', 'realistic'].includes(o.scale as string)) return null;
    if (typeof o.obl !== 'number' || !(o.obl >= MIN_OBLIQUITY && o.obl <= MAX_OBLIQUITY)) return null;
    if (o.sel !== null && typeof o.sel !== 'string') return null;
    return { v: 1, jd: o.jd, mode: o.mode as ViewMode, scale: o.scale as ScaleMode, sel: o.sel ?? null, obl: o.obl };
  } catch {
    return null;
  }
}

export function collectSharedState(time: TimeStore, view: ViewStore, model: ModelStore): SharedState {
  const v = view.get();
  return { v: 1, jd: time.get().jd, mode: v.mode, scale: v.scale, sel: v.selectedId, obl: model.get().obliquityDeg };
}

export function applySharedState(time: TimeStore, view: ViewStore, model: ModelStore, s: SharedState): void {
  time.setJulian(s.jd);
  model.setObliquity(s.obl);
  view.patch({ mode: s.mode, scale: s.scale, selectedId: s.sel, followEarth: s.mode !== 'space' });
}
```

- [ ] **Step 4: `App.ts` 연결** —
  1. 스토어 생성 직후, 패널 생성 전에 복원: `const shared = decodeSharedState(location.hash); if (shared) applySharedState(this.time, this.view, this.model, shared);`
  2. `ModelStore` 필드 추가 + `SolarScene` 5번째 인자로 전달 + Graphs/InfoCard/ObserverPanel에 전달.
  3. 헤더에 복사 버튼: `<button id="share-btn" type="button">이 장면 링크 복사</button>` + `#share-msg` 상태 문구. 클릭 시 `collectSharedState` → `location.hash` 갱신 → `navigator.clipboard.writeText(location.href)` 성공 시 "링크를 복사했습니다", 실패 시 해시가 이미 주소창에 있으니 "주소창의 링크를 복사해 주세요"로 폴백.
  4. 3개 스토어 구독 → 400ms 디바운스 `history.replaceState(null, '', encodeSharedState(...))`로 해시 자동 반영. `hashchange` 리스너로 뒤로/앞으로 가기 복원.
  5. e2e 추가:

```ts
test('shared link restores date and tilt', async ({ page }) => {
  await page.goto('/');
  await page.locator('#tp-input').fill('2026-08-12');
  await page.locator('#tilt-slider').fill('30');
  await page.waitForTimeout(700); // debounce flush
  const url = page.url();
  expect(url).toContain('#s=');
  await page.goto(url);
  await expect(page.locator('#tp-date')).toContainText('2026-08-12');
  await expect(page.locator('#gr-tilt-val')).toContainText('30');
});
```

- [ ] **Step 5: 전체 테스트** — `npx vitest run`, `npx playwright test` PASS

- [ ] **Step 6: 커밋**

```bash
git add src/stores/share.ts src/tests/unit/share.test.ts src/app/App.ts src/tests/e2e/app.spec.ts
git commit -m "URL 상태 공유: 해시 인코딩·복원·링크 복사 버튼"
```

---

### Task 5: 마무리 (검증·기록·배포)

- [ ] **Step 1: 전체 검증** — `npm run verify` (타입·린트·단위·빌드) + `npx playwright test` (Chromium·WebKit) 전부 PASS
- [ ] **Step 2: UPDATELOG 기록** — `docs/UPDATELOG.md` 맨 위 `## 2026-10-30` 섹션에 두 줄 추가:
  - 자전축 기울기 실험실(0~45° 슬라이더·프리셋, 3D 축·그래프·하늘 연동)
  - URL 장면 공유(해시 인코딩, 링크 복사 버튼)
- [ ] **Step 3: 커밋·푸시** — `git add -A && git commit -m "A+B 완료: ..." && git push`
- [ ] **Step 4: 배포 확인** — `gh run watch`로 Pages 워크플로 성공 확인, 사이트 200 응답 확인

---

## Self-Review

1. **Spec coverage:** 기울기 슬라이더·프리셋·3D/그래프/하늘 연동(Task 1~3) ✓, URL 인코딩·복원·복사(Task 4) ✓, 검증·기록·배포(Task 5) ✓. 퀴즈·식은 기울기 독립이라 제외 근거를 Constraints에 명시 ✓.
2. **Placeholder scan:** 모든 단계에 실제 코드·명령·예상 결과 포함. "적절히 처리" 같은 위임 표현 없음.
3. **Type consistency:** `obliquity` 매개변수명·기본값 전 Task 통일. `SharedState.sel: string | null` ↔ `ViewState.selectedId: string | null` 일치. `mode`·`scale`은 기존 `ViewMode`·`ScaleMode` 타입 재사용. `applySharedState`의 `followEarth`는 기존 App 로직(`mode !== 'space'`)과 동일 규칙.
