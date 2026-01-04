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
<summary>Click to expand English Version</summary>

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
- Monte Carlo simulations (1,000 to 10,000+ runs)
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
