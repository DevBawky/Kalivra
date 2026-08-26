---
name: refactor-kalivra
description: Plan, implement, or review architecture refactors in the Kalivra Electron app while preserving project-file compatibility, balance calculations, Undo/Redo, exports, and process security. Use for module extraction, dependency cleanup, test seams, IPC or persistence hardening, and broad maintainability work; do not use for isolated copy or styling-only edits.
---

# Refactor Kalivra

Kalivra를 동작 보존형으로 점진 리팩터링한다. 먼저 저장소 루트의 `AGENTS.md`를 따르고,
요청 범위와 현재 코드가 달라졌는지 확인한 뒤 판단한다.

## 필요한 컨텍스트만 읽기

- 여러 모듈을 가로지르는 설계, 리팩터링 순서 결정, `.kal`/IPC/보안 경계 변경에는
  [현재 아키텍처와 전환 지도](references/architecture.md)를 읽는다.
- 한 순수 함수나 이미 경계가 명확한 모듈 내부만 다루면 reference를 생략하고 관련
  구현·호출자·테스트만 확인한다.
- reference는 기준선이지 영구적인 사실이 아니다. 실제 파일과 `package.json`을 우선한다.

## 요청 유형 선택

- **진단/계획**: 의존성과 변경 축을 추적하고, 위험도와 검증 가능한 작은 단계 및 완료
  조건을 제안한다. 사용자가 구현을 요청하지 않았다면 코드 동작은 바꾸지 않는다.
- **구현**: 가장 작은 안전한 seam부터 만들고 호출부를 전환한다. 다음 안전한 단계가
  남아 있으면 테스트와 문서까지 완료한다.
- **리뷰**: diff가 제품 계약과 의존성 방향을 지키는지 확인한다. 문제는 영향과 재현
  경로가 큰 순서로 보고하고, 안전한 대안을 함께 제시한다.

## 리팩터링 절차

1. **계약을 특정한다.** 사용자 관점 동작, 입력/출력, `.kal` 및 export 형태, 오류와
   취소 동작, 성능 기대치를 적는다. 구조 개선과 별개의 동작 변경은 분리한다.
2. **변경 그래프를 좁힌다.** 정의뿐 아니라 모든 `require`, IPC 송수신자, DOM 이벤트,
   데이터 mutation, export 소비자를 찾는다. 숨은 전역과 singleton을 표시한다.
3. **기준선을 고정한다.** 기존 테스트가 없으면 대표 fixture와 characterization test를
   먼저 추가한다. 버그를 고치는 작업이라면 실패를 재현하는 테스트와 의도된 새 결과를
   명확히 구분한다.
4. **seam을 만든다.** 난수, 시각, ID, 수식 평가, 저장소, IPC, DOM, Chart.js, Firebase를
   작은 인터페이스 또는 함수 인자로 감싼다. 하나의 대체 구현만 있는 안정된 순수 계산에
   불필요한 interface/class를 만들지 않는다.
5. **책임을 이동한다.** 한 단계에서 하나의 변경 축만 옮기고 기존 public entry point는
   필요하면 얇은 호환 facade로 유지한다. 새 코드의 의존성은 도메인 쪽을 향하게 한다.
6. **호출부를 전환한다.** 일부 호출부만 새 상태 소유자를 쓰는 이중 쓰기 상태를 남기지
   않는다. 특히 명령 기록, 저장 경로, chart 인스턴스, IPC 등록은 소유자를 하나로 만든다.
7. **관찰 후 제거한다.** 동작과 실패 경로를 검증한 뒤에만 이전 코드와 facade를 제거한다.
   단순히 사용되지 않아 보인다는 이유로 파일 형식 호환 코드나 export 코드를 삭제하지 않는다.
8. **결과를 인계한다.** 바뀐 경계, 보존한 계약, 실행한 검증, 남은 위험과 다음으로 작은
   단계를 간결하게 보고한다.

## SOLID 적용 판단

- **SRP**: 파일 크기가 아니라 변경 이유로 나눈다. 전투 규칙, 확률원, 로그 수집,
  통계 집계가 독립적으로 변한다면 분리한다.
- **OCP**: modifier, trait, export 형식처럼 실제 변형점에는 registry/strategy를 고려한다.
  아직 변형점이 아닌 단일 계산에 플러그인 구조를 미리 만들지 않는다.
- **LSP**: adapter/strategy는 성공값뿐 아니라 취소, 오류, 경계값 계약도 동일하게 지킨다.
- **ISP**: renderer에 거대한 application API를 노출하지 말고 창 제어, 프로젝트 파일,
  export 등 사용처별 최소 기능으로 나눈다.
- **DIP**: 도메인과 유스케이스가 `fs`, Electron, DOM, Firebase, Chart.js를 직접 알지 않게
  한다. 조립 지점에서 구체 구현을 주입한다.

상속보다 작은 함수 조합과 명시적 데이터 흐름을 우선한다. `Manager`, `Service`, `Helper`
같은 이름은 책임과 계약이 드러날 때만 사용한다.

## 안정성 기준

- 프로젝트 문서는 load 직후 검증하고 정규화한다. 버전이 없던 legacy 문서도 fixture로
  보존한다. 알 수 없는 향후 버전은 묵시적으로 덮어쓰지 않는다.
- 저장은 취소와 실패를 구분하고, 성공하기 전 현재 경로/수정 상태를 갱신하지 않는다.
- 명령은 실행 전후 모든 영향 상태를 캡처해 정확히 역연산한다. `execute -> undo -> redo`와
  새 명령 이후 redo 제거를 검증한다.
- 시뮬레이션은 seed 가능한 RNG로 같은 입력을 재현할 수 있게 한다. 통계 테스트는 허용
  오차와 표본 수를 명시하되 핵심 규칙은 고정 RNG 단위 테스트로 검증한다.
- 수식 엔진은 허용 식별자와 연산을 제한하고 구문 오류, 알 수 없는 stat, `NaN`, `Infinity`,
  0으로 나누기와 실행 오류를 구분한다. 오류를 임의의 0으로 바꾸지 않는다.
- IPC 요청/응답은 구조화된 결과(성공, 취소, 오류)를 사용하고 중복 handler 등록과 창 수명
  이후 callback을 방지한다.
- 대량 시뮬레이션이 UI를 막는 변경은 피한다. worker 도입 시 순수 serializable payload와
  취소/진행률 계약을 먼저 정의한다.

## 검증 선택

변경 위험에 비례해 다음을 조합한다.

- 순수 계산/도메인: 정상, 경계, 실패, 결정적 RNG 테스트
- 프로젝트 모델: 현재/legacy/손상 fixture의 load-save round trip과 migration 테스트
- 명령: 상태 snapshot을 이용한 execute/undo/redo 불변조건 테스트
- adapter: mock 포트를 이용한 취소, 권한 오류, 쓰기 실패, Firebase 실패 계약 테스트
- IPC: 채널 allowlist, payload 검증, 응답 구조, handler lifecycle 테스트
- renderer: 핵심 이벤트가 올바른 유스케이스를 호출하고 안전하게 DOM을 갱신하는지 확인
- 모든 변경 JS: `node --check`
- 패키징/보안 설정 변경: 관련 플랫폼 build와 Electron smoke test

현재 test/lint 기반이 없으면 검증 도구 자체를 한 변경 단위로 먼저 도입하고, 테스트를
통과시키기 위해 제품 코드를 한꺼번에 재작성하지 않는다. 실행할 수 없었던 GUI·플랫폼
검증은 명시한다.

## 완료 조건

- 새 경계의 책임과 의존성 방향을 한 문장으로 설명할 수 있다.
- 변경 전 사용자 동작과 파일 호환성이 테스트 또는 명시적 검증으로 보호된다.
- 새 전역 상태, 중복 상태 소유자, 무검증 IPC/동적 실행, 숨겨진 오류가 추가되지 않았다.
- 관련 호출자와 문서가 갱신되고 죽은 경로가 의도적으로 정리되었다.
- 실행한 검증과 실행하지 못한 검증이 구분되어 보고된다.

