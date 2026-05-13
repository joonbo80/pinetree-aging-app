# AGING APP — Phase 2 UI v1.0

Upload + Parsing Preview screen for the Pinetree Express AGING application.

This is the first Phase 2 screen. It must appear before the Dashboard.
Goal: make users trust the data **before** they see analysis.

---

## Status

| Item | Value |
|------|-------|
| Spec | v1.2.1 (Phase 1 frozen baseline) |
| Schema | 1.0 |
| Parser | 1.1.0 (referenced via baseline JSON) |
| Stack | Vite + React 19 + TypeScript |
| Live parsing | **Phase 2 v1.1** (deferred). Current version uses the baseline JSON. |

---

## What is included

```
src/
├── App.tsx                  Main shell, status logic, tabs, modal
├── main.tsx                 Entry
├── styles/global.css        Operational accounting tone (Inter Tight + JetBrains Mono)
├── i18n/strings.ts          KO/EN copy
├── parsing-engine/types.ts  Phase 1 type definitions
├── baselines/
│   └── phase1-v1.3.0.json   Frozen Phase 1 audit baseline
└── components/
    ├── Header.tsx
    ├── DropZone.tsx
    ├── Readiness.tsx
    ├── Tabs.tsx
    ├── ConfirmModal.tsx
    └── tabs/
        ├── FilesTab.tsx
        ├── ReconciliationTab.tsx
        ├── StatementsTab.tsx
        ├── ReviewQueueTab.tsx
        └── RawJsonTab.tsx
```

---

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Build for production

```bash
npm run build
```

Build output is in `dist/`. Paths are relative (`base: './'`), so the folder
can be served from any host (SharePoint document library, static CDN, etc.).

---

## Phase 2 v1 features

### Header
- Pinetree wordmark links to https://pinetreeexpress.com
- Sticky at top
- KO / EN toggle (persisted to localStorage)
- Shows current as-of date once data is loaded

### Upload Workbench
- Drop zone accepting `.xls / .xlsx / .pdf`
- Browse button as fallback
- **Load Baseline Demo** button — instantly loads `phase1-v1.3.0.json`
  so the entire UI is exercisable without a real upload
- Live file uploads call the same baseline loader for now (placeholder)
- Import Readiness panel with status + KPI cells

### Tabs
1. **Files** — classification table (file, type, confidence, rules, sheet, rows)
2. **ERP Reconciliation** — INVOICE / CRDR / AP cards, direction strip, per-currency table, skipped rows
3. **Statements** — Agent + Local statement metrics with `AS_OF_DATE_MISMATCH` notice
4. **Review Queue** — 7 Local Statement candidates + duplicate top-10 + CSV export + reviewed checkboxes (localStorage)
5. **Raw JSON** — collapsible viewer with copy/download

### Confirm Import flow
- Disabled while Blocked
- Enabled while Ready or Needs Review
- Modal summarises: files / reconciliation / critical / candidates
- On confirm, session metadata is persisted to localStorage

### localStorage keys
```
agingApp.language
agingApp.lastImportSession
agingApp.reviewState
```

Raw uploaded files are **never** persisted to localStorage.

---

## Phase 2 v1 acceptance criteria

- [x] Upload multiple files (currently routes to baseline)
- [x] Show classification results
- [x] Show ERP reconciliation
- [x] Show Agent + Local statement validation
- [x] Show 7 Local review candidates from current baseline
- [x] Export JSON
- [x] Export Local review CSV
- [x] Confirm Import only when not Blocked
- [x] KO / EN toggle persists in localStorage

---

## Roadmap

### v1.1 — Live parsing (next iteration)
- Wire SheetJS to parse `.xls / .xlsx` in the browser
- Replace the baseline shortcut with the real Phase 1 engine output
- Reuse all current screens unchanged

### v1.2 — Dashboard placeholder
- `/` Upload + Parsing Preview (current)
- `/dashboard` placeholder until Phase 2.2

### v2.0 — Full Dashboard
- KPI cards (USD / CAD separated, never combined)
- Aging buckets, party drilldowns, statement send tracking

---

## Design notes

Tone follows the spec: **operational, clear, dense for accounting review.**

- Type: Inter Tight (sans), JetBrains Mono (numbers / IDs / rules)
- Numerics: tabular figures, never proportional
- Color signals: green = pass, amber = needs review, red = blocked
- Color is never the only signal — every status carries a text label too
- Sticky tables, sticky tabs, sticky header
- No gradients, no oversized hero, no decorative chrome
