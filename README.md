# Kalivra

<div align="center">
  <img src="assets/AppIcon.png" alt="Kalivra Logo" width="200" height="200">
  <br>
  <h3>Game Balance Adjustment Tool</h3>
  <p>Dedicated utility for visualizing complex numerical data and real-time balance tuning in games</p>
  <br>

  ![Electron](https://img.shields.io/badge/Electron-39.2.7-blue?logo=electron)
  ![Category](https://img.shields.io/badge/Category-Game%20Dev%20Tool-orange)
  ![Version](https://img.shields.io/badge/version-0.1.0--alpha-green)
  ![License](https://img.shields.io/badge/license-MIT-lightgrey)
</div>

---

<details>
<summary>English Version</summary>

## Project Introduction

Kalivra is an open-source game balance analysis and simulation tool  
designed for Technical Game Designers and system-driven game developers.

It allows you to load, edit, simulate, and analyze complex game balance data  
such as character stats, growth curves, item synergies, and probabilistic combat outcomes  
within a structured and reversible GUI environment.

Kalivra focuses on **explainable balance decisions** rather than intuition or static spreadsheets.

---

## Core Features

### Project-Based Balance Management

- Project file format (`.kal`) with multiple internal balance presets
- Safe iteration across versions, patches, and experiments
- Clear separation between project metadata and balance states

### Full Undo / Redo Safety

- All data mutations are command-based
- Global undo and redo support
- Ctrl + Z / Ctrl + Y available for all actions
- No irreversible balance changes

### Validation and Error Prevention

- Min / Max and type validation for all numeric inputs
- Formula validation with live warnings and highlights
- Lockable entities and stats to prevent accidental edits

### Advanced Simulation Engine

- Lightweight combat logic optimized for high iteration counts
- Monte Carlo simulations (10,000 runs)
- Conditional logic support (HP thresholds, triggers, synergies)
- Simulation results based on distributions, not single averages

### Distribution-Based Analysis

- Damage and TTK histograms
- Win-rate confidence intervals
- Outlier and long-tail visibility
- Clear separation between average behavior and risk behavior

### Explainable Battle Logs

- Timeline-based battle playback
- Step-by-step combat resolution
- Text logs linked directly to simulation results
- Debugging support for unexpected balance outcomes

### Bulk Editing and Grid View

- Spreadsheet-like grid editor
- Multi-select batch editing
- Formula-based mass updates
- Designed to replace Excel in balance workflows

### Preset Comparison and Diff

- Overlay graphs between presets
- CP, DPS, and metric difference visualization
- Clear before/after analysis for balance patches

### Formula Preset Library

- Reusable CP and damage formulas
- Centralized formula management
- Rapid experimentation without rewriting logic

### Engine Data Export

- Export to JSON, CSV, C# classes, ScriptableObject formats
- Direct export into Unity or Unreal project paths
- Snapshot export for team sharing

### Intelligent Balance Watchdog

- Automatic imbalance pattern detection
- Meta dominance scanning by level range
- Warning and critical flags in analysis logs

### Segment-Based Reports

- Early / Mid / Late game balance summaries
- Level-range win-rate tables
- PDF and image report export for presentations

### Goal-Seeking Adjustment

- Define target metrics (e.g. Lv20 DPS = 1000)
- Automatic growth-rate recalculation
- Guided inverse balance tuning

---

## Tech Stack

- Runtime: Node.js, Electron
- UI: HTML, CSS, JavaScript
- Simulation: Custom Monte Carlo engine
- Packaging: electron-builder

---

## Getting Started

### Install Dependencies

```bash
npm install
```

### Run in Development Mode
```bash
npm start
```

### Build Executable (For Distribution)
```bash
npm run build
```

## Project Structure
- `main.js`
Electron main process, window lifecycle, file I/O
- `renderer.js`
Simulation logic, UI state, analysis pipeline
- `index.html`
Application UI layout
- `assets/`
Icons and visual resources
- `dist/`
Built executables for distribution

## Alpha Status
Kalivra is currently released as an Alpha version.
- Core functionality is complete and stable
- UX and workflows may evolve
- Feedback and issue reports are welcome

## Author
- Bawky
- Bawky Studio
</details>

---

<details open>
<summary>한국어 버전</summary>

## 프로젝트 소개

Kalivra는 Technical Game Designer와 시스템 중심 게임 개발자를 위한  
오픈소스 게임 밸런스 분석 및 시뮬레이션 도구입니다.

캐릭터 스탯, 성장 곡선, 아이템 시너지, 확률 기반 전투 결과와 같은  
복잡한 게임 밸런스 데이터를  
되돌릴 수 있는 안전한 GUI 환경에서 불러오고, 수정하고, 시뮬레이션하고, 분석할 수 있도록 설계되었습니다.

Kalivra는 감이나 직관, 정적인 스프레드시트가 아닌  
**설명 가능한 데이터 기반 밸런싱**을 목표로 합니다.

---

## 핵심 기능

### 프로젝트 단위 밸런스 관리

- `.kal` 프로젝트 파일 포맷 기반 구조
- 하나의 프로젝트 내 다수 밸런스 프리셋 관리
- 패치, 실험, 시도 간 안전한 반복 작업 가능
- 프로젝트 메타 정보와 밸런스 상태의 명확한 분리

### Undo / Redo 안전성

- 모든 데이터 변경은 명령 단위로 관리
- 전체 기능에 대해 Undo / Redo 지원
- Ctrl + Z / Ctrl + Y 전역 사용 가능
- 실수로 인한 영구적인 데이터 손실 방지

### 데이터 유효성 검사 및 오류 방지

- 모든 수치 입력에 대해 Min / Max 및 타입 검사
- 수식 입력 시 실시간 경고 및 하이라이트
- 엔티티 및 스탯 잠금 기능으로 오입력 방지

### 고급 시뮬레이션 엔진

- 대량 반복 실행에 최적화된 전투 로직
- 몬테카를로 방식 시뮬레이션 (10,000회)
- HP 조건, 트리거, 시너지 등 조건부 로직 처리
- 단일 평균값이 아닌 분포 기반 결과 도출

### 분포 기반 분석

- 데미지 및 TTK 히스토그램 제공
- 승률 신뢰 구간 시각화
- 이상치 및 롱테일 결과 확인 가능
- 평균 행동과 위험 행동의 명확한 분리

### 전투 로그 및 타임라인

- 전투 과정 타임라인 기반 재생
- 단계별 전투 로그 제공
- 시뮬레이션 결과와 직접 연결된 로그 분석
- 예상치 못한 결과에 대한 디버깅 지원

### 대량 편집 및 그리드 뷰

- 엑셀과 유사한 그리드 기반 UI
- 다중 선택 후 일괄 수정 가능
- 수식 기반 대량 적용 지원
- 스프레드시트 기반 밸런스 작업 대체 목적

### 프리셋 비교 및 차이 분석

- 프리셋 간 그래프 오버레이 비교
- CP, DPS 등 핵심 지표 차이 시각화
- 패치 전후 밸런스 변화 명확화

### 수식 프리셋 관리

- 자주 사용하는 CP 및 데미지 수식 라이브러리화
- 수식 재사용 및 빠른 실험 가능

### 엔진 데이터 Export

- JSON, CSV, C#, ScriptableObject 포맷 지원
- Unity 및 Unreal 프로젝트 경로로 직접 출력
- 팀 공유를 위한 스냅샷 파일 생성

### 지능형 밸런스 감지

- 불균형 패턴 자동 감지
- 특정 레벨 구간 메타 지배 여부 스캔
- Warning / Critical 로그 자동 생성

### 구간별 리포트 생성

- Early / Mid / Late 구간 요약
- 레벨 구간별 승률 테이블 제공
- PDF 및 이미지 리포트 생성 가능

### 목표 기반 자동 조정

- 목표 수치 입력 기반 역산 로직
- 성장 계수 자동 보정
- 가이드형 밸런스 튜닝 지원

---

## 기술 스택

- Runtime: Node.js, Electron
- UI: HTML, CSS, JavaScript
- Simulation: 커스텀 몬테카를로 엔진
- Packaging: electron-builder

---

## 시작하기

### 의존성 설치

```bash
npm install
```

### 개발 모드 실행
```bash
npm start
```

### 실행 파일 빌드
```bash
npm run build
```

## 프로젝트 구조
- `main.js`
Electron 메인 프로세스, 윈도우 생명주기, 파일 입출력
- `renderer.js`
시뮬레이션 로직, UI 상태, 분석 파이프라인
- `index.html`
애플리케이션 UI 레이아웃
- `assets/`
아이콘 및 그래픽 리소스
- `dist/`
최종 빌드된 실행 파일

## 알파 버전 안내
Kalivra는 현재 알파 버전으로 공개되어 있습니다.
- 핵심 기능은 완성된 상태입니다
- UX 및 워크플로우는 지속적으로 개선될 수 있습니다
- 피드백 및 이슈 제보를 환영합니다

## 제작자
- Bawky
- Bawky Studio

</details>
