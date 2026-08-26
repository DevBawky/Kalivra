# Kalivra 현재 아키텍처와 전환 지도

이 문서는 2026-08-26의 저장소 상태를 바탕으로 한 리팩터링 기준선이다. 작업 전에 실제
코드와 `package.json`을 확인하고, 구조가 달라졌다면 이 문서도 함께 갱신한다.

## 현재 구성

| 영역 | 파일 | 현재 책임 | 주요 결합/위험 |
| --- | --- | --- | --- |
| Electron 진입 | `main.js` | 창 생성, 앱 수명, IPC 등록 | renderer에 Node 전체 권한 제공, preload 없음 |
| Main IPC | `src/main/ipcHandlers.js` | 창 제어, save/load/export 채널 | 문자열 채널 분산, payload 검증 없음, 등록 해제 없음 |
| 파일 저장 | `src/main/fileManager.js` | 대화상자, 현재 경로, `.kal`/export I/O | module 전역 경로, 동기 I/O, 오류/취소 결과가 모호함 |
| Renderer 조립 | `renderer.js` | 이벤트, modal, 명령, simulation, report/export, 화면 조정 | 1,100줄 이상, 전역 상태와 책임 집중, `innerHTML` 다수 |
| 프로젝트 상태 | `src/renderer/dataManager.js` | 기본 데이터, mutable CRUD, snapshot/item set, 일부 명령, engine export | 내부 가변 객체 노출, renderer와 명령 스택 중복 |
| 수치 계산 | `src/renderer/calculator.js` | 수식 평가/검증, 레벨 stat, crossover | `new Function`, 실패를 0으로 숨김 |
| 전투 | `src/renderer/battle.js` | trait trigger, turn simulation, Monte Carlo/phase 분석 | `Math.random` 직접 사용, 규칙·로그·집계 혼합 |
| 역산 | `src/renderer/solver.js` | 목표 값에 맞는 growth 이분 탐색 | 계산기 구체 모듈 결합, 실패 원인 소실 |
| UI 생성 | `src/renderer/uiManager.js` | entity/item/bulk DOM 생성과 이벤트 연결 | 상태 객체 직접 mutation, 동적 HTML과 callback 계약 혼합 |
| 차트 | `src/renderer/chartManager.js` | Chart.js 인스턴스 생성/수명/resize | module singleton, 전역 `Chart` 의존 |
| 외부 피드백 | `src/services/*` | Firebase 초기화와 feedback 저장 | renderer/window 직접 의존, 외부 실패 계약 약함 |

`index.html`은 CDN 라이브러리와 단일 `renderer.js`를 로드한다. 소스는 CommonJS이며 현재
자동화된 test/lint script가 없다. 13개 JavaScript 파일은 기준선에서 `node --check`를
통과했다.

## 현재 데이터 계약

기본 `.kal` 문서 형태는 아래 개념 구조다.

```text
project
├─ meta
├─ snapshots[]
├─ itemSets[]
└─ current
   ├─ entities[]
   ├─ items[]
   └─ gameRules
```

`dataManager.loadProject`는 과거 형태인 `{ entities, items, gameRules }`도 받는다. 이 legacy
경로는 명시적 migration으로 대체할 때까지 호환 계약으로 취급한다. Entity의 stat은
`{ b, g }`, item은 `targets`, `modifiers`, `traits`를 포함하며 Unity/Unreal export가 이
필드와 ID 관계에 의존한다.

보호해야 할 대표 동작:

- 현재 문서와 legacy 문서의 load -> edit -> save round trip
- snapshot/item set의 깊은 복사와 복원
- entity/item/stat/trait/bulk edit의 Undo/Redo
- CP/damage 수식과 레벨 성장, item add/mult 적용 순서
- seed가 고정된 전투의 명중, 회피, 치명타, variance, trigger와 buff 만료
- CSV/JSON 공유 형식과 Unity/Unreal 내보내기의 ID 참조
- 저장 대화상자 취소, 잘못된 JSON, 쓰기 실패, 피드백 전송 실패

## 목표 경계

폴더 이름보다 의존성 방향이 중요하다. 다음 역할을 유지한다.

```text
bootstrap/composition
├─ Electron main + preload
└─ renderer bootstrap
        │
adapters (IPC, fs, Firebase, Chart.js, DOM)
        │ implements ports
application (commands and use cases)
        │
domain (project model, formulas, stats, battle rules)
```

권장 포트의 예시는 `ProjectRepository`, `FormulaEvaluator`, `RandomSource`, `Clock`,
`FeedbackGateway`, `ChartView`다. 실제 대체 구현이나 테스트 seam이 필요한 포트만 만든다.
JavaScript에서는 작은 객체 계약이나 함수 인자로 충분하며 class/interface 흉내를 강제하지
않는다.

## 권장 전환 순서

각 단계는 독립적으로 검증·되돌릴 수 있어야 한다. 큰 기능 요청이 없다면 앞 단계의 안전망을
건너뛰어 뒤 구조를 한꺼번에 만들지 않는다.

### 1. 안전망과 계약 고정

- Node 내장 test runner 등 최소 테스트 기반과 fixture 위치를 정한다.
- 현재/legacy/손상 `.kal` fixture, 대표 계산/전투 fixture를 추가한다.
- 수식, 시간, ID, RNG 호출을 감쌀 seam을 추가하되 결과는 바꾸지 않는다.
- 성공 기준: 기존 계산과 round trip, Undo/Redo를 자동 재현할 수 있다.

### 2. 순수 도메인 분리

- 프로젝트 기본값/검증/정규화, stat 성장과 modifier, formula engine을 UI에서 분리한다.
- 전투를 turn 규칙, trigger/effect, 로그 수집, batch 통계로 나누고 RNG를 주입한다.
- solver는 `FormulaEvaluator`와 stat 계산 계약에만 의존하게 한다.
- 성공 기준: Electron이나 DOM 없이 도메인 테스트가 실행된다.

### 3. 상태와 명령 경계 통합

- 프로젝트 상태를 캡슐화하고 mutation을 이름 있는 유스케이스로 제한한다.
- `dataManager.js`와 `renderer.js`의 두 Undo/Redo 구현을 하나로 통합한다.
- snapshot/item set/load가 명령 이력과 modified 상태에 미치는 규칙을 명시한다.
- 성공 기준: 모든 편집 경로에 execute/undo/redo 불변조건 테스트가 있다.

### 4. 저장소와 IPC 안정화

- 문서 parser/validator/migrator와 파일 adapter를 분리한다.
- 구조화된 `{ status: 'ok' | 'cancelled' | 'error', ... }` 결과와 IPC schema를 둔다.
- 비동기·원자적 저장과 창별/session별 현재 경로 수명을 정의한다.
- preload 최소 API로 호출부를 옮긴 뒤 Node integration을 끈다.
- 성공 기준: renderer가 `electron`, `fs`, Firebase SDK를 직접 require하지 않는다.

### 5. Renderer 분해

- `renderer.js`를 bootstrap, controller/presenter, modal/report/export 유스케이스로 분리한다.
- DOM 생성과 상태 변경을 분리하고 동적 텍스트의 `innerHTML` 사용을 제거한다.
- Chart.js 인스턴스 수명은 명시적 adapter가 소유한다.
- 성공 기준: 핵심 controller는 DOM port를 mock해 테스트할 수 있고 bootstrap은 조립만 한다.

### 6. 외부 adapter와 성능

- Firebase feedback을 renderer 밖의 최소 gateway로 이동하고 timeout/실패 정책을 둔다.
- 큰 Monte Carlo/league 작업의 병목을 측정한 뒤 필요할 때 worker와 취소/진행률을 도입한다.
- 패키징 smoke test와 CI test/lint/check 단계를 release 전에 실행한다.
- 성공 기준: 외부 서비스 장애가 편집 흐름을 막지 않고, 대량 작업 중 UI 응답성이 검증된다.

## 피해야 할 전환

- 테스트 없이 TypeScript, ESM, 프레임워크, 상태 관리 라이브러리와 전체 폴더 구조를 동시에 교체
- 기존 모듈을 이름만 바꾼 manager/service 계층으로 감싸고 가변 singleton은 그대로 유지
- 새 구현과 이전 구현이 프로젝트 상태나 저장 파일에 동시에 쓰는 장기 이중 경로
- IPC hardening 전에 renderer 기능을 preload에 통째로 노출
- 계산 오류를 호환성이라는 이유로 계속 0으로 삼키거나 모든 예외를 하나의 사용자 메시지로 변환
- 성능 측정 없이 worker, 캐시, 복잡한 event bus를 먼저 도입

## 문서 갱신 조건

진입점, 데이터 스키마, 의존성 방향, 테스트/빌드 명령, 단계 완료 상태가 바뀌면 이 문서를
함께 갱신한다. 완료한 단계는 삭제하기보다 현재 구조 표와 남은 위험을 먼저 현실에 맞춘 뒤,
전환 순서를 다음 미완료 seam부터 다시 작성한다.
