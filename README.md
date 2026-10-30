# Solar System Lab

태양-지구-달 궤도, 계절, 달 위상, 일식/월식을 3D로 탐구하는 과학 수업 도구입니다. 초5~중3 대상, 설치형 PWA로 동작합니다.

- **정적 사이트**: 서버, 로그인, DB 없음.
- **런타임 AI 없음**: 빌드 후 LLM/API 호출 없음.
- **개념 모형**: 원형 궤도 근사, 크기·거리 과장 (수업용).

## 시작하기

Node.js 20 이상 필요.

```bash
npm install
npm run dev
```

```bash
npm run build
npm run preview
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사 후 정적 빌드 |
| `npm run verify` | 타입검사 + 린트 + 단위테스트 + 빌드 |
| `npm test` | Vitest 단위 테스트 |
| `npm run test:e2e` | Playwright E2E 테스트 |
| `npm run icons` | PWA 아이콘 재생성 |

자세한 학습 설계는 [`구현계획.md`](구현계획.md), 변경 기록은 [`docs/UPDATELOG.md`](docs/UPDATELOG.md) 참고.
