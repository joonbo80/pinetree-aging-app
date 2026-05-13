# AGING APP — Phase 2 v1.1

Pinetree Express AGING application — Upload + Parsing Preview screen
with API backend and browser fallback.

This is the second Phase 2 milestone. The first milestone (v1.0) shipped a
self-contained UI with a bundled baseline JSON. **v1.1 splits the system into
a UI client and a Node API server**, and the UI now prefers live API data
with automatic fallback to the bundled baseline if the API is unreachable.

---

## Status

| Item | Value |
|------|-------|
| Spec | v1.3.0 (Phase 2 baseline) |
| Schema | 1.0 |
| Parser | v1.3.0 |
| API service | v1.1.0 |
| UI | Vite + React 19 + TypeScript |
| API | Node + Express + TypeScript |
| Live `.xls` parsing | Deferred to v1.2 |
| SharePoint / Teams integration | Phase 4 |

---

## Workspace layout

```
aging-workspace/
├── aging-api/                           Node API server
│   ├── src/
│   │   ├── server.ts                    Express entry, CORS, routing
│   │   ├── types.ts                     Response shapes
│   │   ├── routes/
│   │   │   ├── health.ts                GET  /api/health
│   │   │   └── parse.ts                 GET  /api/parse-demo
│   │   │                                POST /api/parse-upload  (501 placeholder)
│   │   └── baselines/
│   │       └── phase1-v1.3.0.json       Frozen baseline (mirror of UI copy)
│   ├── package.json                     scripts: dev / start / build / serve
│   └── tsconfig.json
│
└── aging-app/                           UI
    ├── src/
    │   ├── App.tsx                      API-first → fallback orchestration
    │   ├── api/
    │   │   └── client.ts                AgingApiClient with timeout
    │   ├── components/
    │   │   ├── Header.tsx               + API ONLINE / OFFLINE indicator
    │   │   ├── DropZone.tsx             + loading state
    │   │   ├── Readiness.tsx            + Source pill (API / Fallback)
    │   │   ├── Tabs.tsx
    │   │   ├── ConfirmModal.tsx
    │   │   └── tabs/
    │   │       ├── FilesTab.tsx
    │   │       ├── ReconciliationTab.tsx
    │   │       ├── StatementsTab.tsx
    │   │       ├── ReviewQueueTab.tsx
    │   │       └── RawJsonTab.tsx
    │   ├── i18n/strings.ts              KO / EN copy (+ API strings)
    │   ├── parsing-engine/types.ts      Phase 1 type definitions
    │   ├── baselines/
    │   │   └── phase1-v1.3.0.json       Bundled fallback (mirror of API copy)
    │   ├── styles/global.css            Operational accounting tone
    │   └── main.tsx                     Entry
    ├── index.html
    ├── package.json
    └── vite.config.ts                   base: './' for portable hosting
```

---

## API endpoints

### `GET /api/health`

Liveness + version metadata. Used by the UI on boot to decide whether to
show "API ONLINE" or "API OFFLINE".

```json
{
  "status": "ok",
  "service": "aging-api",
  "version": "1.1.0",
  "specVersion": "1.3.0",
  "parserVersion": "1.3.0",
  "uptime": 42,
  "timestamp": "2026-05-01T19:45:05.710Z"
}
```

### `GET /api/parse-demo`

Returns the frozen baseline parse result. Identical to the bundled
fallback the UI ships with, so the two are interchangeable.

The response carries `X-Aging-Source: api-baseline` so the UI can label
the data origin in the Readiness panel.

### `POST /api/parse-upload`

**501 Not Implemented** — placeholder for the v1.2 live-parsing endpoint.
Returns:

```json
{
  "error": "Upload parsing not implemented in this build",
  "code": "NOT_IMPLEMENTED",
  "detail": "Phase 2 v1.1 ships /api/parse-demo only. Live parsing of .xls/.xlsx is planned for v1.2."
}
```

---

## UI behaviour

### Boot
1. App renders empty state.
2. `apiClient.health()` is called with a 2.5 s timeout.
3. Header shows `API ONLINE` (green) on success, `API OFFLINE` (muted) on failure.

### Load Baseline Demo / file drop
1. UI calls `apiClient.parseDemo()` first.
2. **On success** → state is set with `dataSource = 'api'` and the Readiness
   panel shows a green `SOURCE · API` pill.
3. **On timeout / error** → UI silently falls back to the bundled
   `phase1-v1.3.0.json` and shows an amber `SOURCE · FALLBACK` pill.

The user always sees data. The pill makes the origin obvious without
making fallback feel like an error.

### Confirm Import
The session metadata persisted to `localStorage` now includes the
`dataSource` field, so post-import audits can tell whether the data
came from the API or the bundled fallback.

---

## Run locally

### API server

```bash
cd aging-api
npm install
npm start          # tsx src/server.ts
# → listening on http://127.0.0.1:3001
```

### UI

```bash
cd aging-app
npm install
npm run dev        # http://localhost:5173
```

The UI defaults to API base `http://127.0.0.1:3001`. Override with:

```bash
VITE_AGING_API_BASE=https://aging.pinetreeexpress.com npm run dev
```

### Production build

```bash
cd aging-api && npm run build && npm run serve
cd aging-app && npm run build
```

UI build is fully relative-path (`base: './'`) so the `dist/` folder can
be served from a SharePoint document library, S3, or any static host.

---

## QA verification

### v1.0 checklist
All 52 items in `phase2-ui-qa-checklist.md` still pass after the v1.1
refactor. See `phase2-ui-qa-report.md`.

### v1.1 integration scenarios
| Scenario | Expected | Result |
|----------|----------|--------|
| API server is running | Header shows `API ONLINE`, Readiness shows `SOURCE · API` | ✅ |
| API server is unreachable | Header shows `API OFFLINE`, Readiness shows `SOURCE · FALLBACK` | ✅ |
| Drop multiple files | Routes through the same API → fallback path | ✅ |
| API server returns 500 | UI silently falls back, no error toast | ✅ |
| API server times out (> 2.5 s) | UI silently falls back | ✅ |

---

## localStorage keys

```
agingApp.language           "en" | "ko"
agingApp.lastImportSession  { importBatchId, timestamp, asOfDate, fileCount, reviewCount, dataSource }
agingApp.reviewState        { reviewedKeys: string[], notes: Record<string,string> }
```

Raw uploaded files are **never** persisted to `localStorage`.

---

## Roadmap

### v1.2 — Live parsing + Dashboard placeholder
- Wire SheetJS server-side in `POST /api/parse-upload`
- Replace the baseline shortcut with a real Phase 1 parse
- Add `/dashboard` route, render a placeholder until v2.0
- React Router

### v1.3 — Persistence
- SharePoint Lists for memo / dispatch / payment / exclusion flags
- Session log of all imports

### v2.0 — Full Dashboard
- KPI cards (USD / CAD separated, never combined)
- Aging buckets, party drilldowns, statement send tracking

---

## Design notes

Tone: **operational, clear, dense for accounting review.** Same as v1.0.

- Type: Inter Tight (sans), JetBrains Mono (numbers / IDs / rules)
- Numerics: tabular figures
- Color signals: green = pass / online / API, amber = needs review / fallback, red = blocked / fail
- Color is never the only signal — every status carries a text label
- Sticky header, sticky tabs, sticky table headers
- No gradients, no oversized hero, no decorative chrome
