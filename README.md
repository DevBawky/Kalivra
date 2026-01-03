# Kalivra

<div align="center">
  <img src="assets/AppIcon.png" alt="Kalivra Logo" width="200" height="200">
  <br>
  <h3>Game Balance Adjustment Tool</h3>
  <p>Dedicated utility for visualizing complex numerical data and real-time balance tuning in games</p>
  <br>

  ![Electron](https://img.shields.io/badge/Electron-39.2.7-blue?logo=electron)
  ![Category](https://img.shields.io/badge/Category-Game%20Dev%20Tool-orange)
  ![Version](https://img.shields.io/badge/version-1.0.0-green)
  ![License](https://img.shields.io/badge/license-ISC-lightgrey)
</div>

---

<details>
<summary>Click to expand English Version</summary>

## Project Introduction

Kalivra is a data balancing utility designed for game developers.<br>It allows you to intuitively load and edit numerical data such as item stats, monster difficulty curves,<br>and drop rates in a GUI environment without modifying code.

The goal of Kalivra is to shorten the repetitive numerical testing process and provide an environment<br>where you can focus on finding the "Golden Balance" of your game.

## Key Features

* Game Data Processing: Identify and modify core in-game variables such as attack power, defense, and probabilities at a glance.
* Data Load & Sync: Instantly load game data files like JSON/CSV, with a stable loading system for immediate application after editing.
* Precise Balance Editing: Prevents input errors that may occur immediately after loading data, allowing accurate editing and saving down to fine numerical units.
* Dev-Optimized UI: Applies a dark theme to minimize eye fatigue during long hours of data work.

## Tech Stack

* Runtime: Node.js & Electron
* Data Handling: File System for local data manipulation
* Packaging: electron-builder

## Getting Started

1. Install Dependencies
```bash
npm install
```

2. Run Development Mode
```bash
npm start
```

3. Build Executable (For Distribution)
```bash
npm run build
```

## Project Structure
* main.js: Main logic for data I/O and window management
* assets/: Icons and graphic resources
* dist/: Final built executable files (.exe, .dmg, .AppImage)
* index.html: Balancing dashboard UI

## Author
* Bawky

## License
This project is licensed under the ISC License.

---
</details>

<details open>
<summary>한국어 버전 펼치기 (기본)</summary>

## 프로젝트 소개

Kalivra는 게임 개발자를 위한 데이터 밸런싱 보조 도구입니다.<br> 게임의 방대한 아이템 스탯, 몬스터 난이도 곡선, 드랍률 등의 수치 데이터를<br>코드 수정 없이 GUI 환경에서 직관적으로 불러오고 편집할 수 있도록 도와줍니다.

반복적인 수치 테스트 과정을 단축하고, 게임의 '황금 밸런스'를 찾는 데 집중할 수 있는 환경을 제공하는 것이 Kalivra의 목표입니다.

## 핵심 기능

* 수치 가공: 공격력, 방어력, 확률 등 게임 내 핵심 변수들을 한눈에 파악하고 수정합니다.
* 데이터 로드 및 동기화: JSON/CSV 등 게임 데이터 파일을 즉시 불러오며, 수정 후 즉시 적용을 위한 안정적인 로드 시스템을 갖추고 있습니다.
* 정밀한 밸런싱 편집: 데이터 로드 직후 발생할 수 있는 입력 오류를 방지하고, 세밀한 수치 단위까지 정확하게 편집 및 저장할 수 있습니다.
* 개발 최적화 UI: 다크 테마를 적용하여 장시간 데이터 작업 시에도 눈의 피로를 최소화합니다.

## 기술 스택

* Runtime: Node.js & Electron
* Data Handling: File System for local data manipulation
* Packaging: electron-builder

## 시작하기

1. 의존성 설치
```bash
npm install
```

2. 개발 모드 실행
```bash
npm start
```

3. 실행 파일 빌드(배포용)
```bash
npm run build
```

## 프로젝트 구조
* main.js: 데이터 입출력 및 윈도우 관리 메인 로직
* assets/: 아이콘 및 그래픽 리소스
* dist/: 최종 빌드된 실행 파일 (.exe, .dmg, .AppImage)
* index.html: 밸런싱 대시보드 UI

## 제작자
* Bawky

## 라이선스
This project is licensed under the ISC License.

</details>
