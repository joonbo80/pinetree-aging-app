# AGING APP — Phase 2 v1.1 (hardened)

Pinetree Express AGING application — Upload + Parsing Preview screen
with API backend and browser fallback.

This release builds on the v1.1 split (UI client + Node API server) by
applying a security/safety hardening pass based on external code review.

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
| Live `.xls` parsing | Deferred to v1.2 (with explicit modal warning users in current build) |
| SharePoint / Teams integration | Phase 4 |
| **Node engine** | **>= 20.10 < 23** (declared in both `package.json`) |
| **Lockfiles** | **Both `package-lock.json` files committed** |
| **Encoding** | **UTF-8 + LF enforced via `.editorconfig` + `.gitattributes`** |

---

## Hardening fixes applied (vs initial v1.1)

| ID | Severity | Issue | Fix |
|---|---|---|---|
| P1-1 | Critical | File drop silently loaded baseline → users could believe their accounting files were analyzed | Added `UploadNotSupportedModal` — file drop/browse now shows an explicit warning listing the attempted files, with "Close" (no data) and "Load demo baseline instead" (explicit opt-in) |
| P1-2 | Critical | `aging-api-build.zip` was unrunnable — `dist/` only, no `package.json` | Build artifact now ships `dist/` + `package.json` + `package-lock.json` + `README.md`. Verified `npm install --omit=dev && node dist/server.js` works |
| P1-3 | High | UI type `ParseResult` mis-named — actually a preview DTO, not raw parser output | Renamed to `ParsingPreviewResult`. Old name kept as `@deprecated` alias for one release. `docs/api-contract.md` documents the two-payload distinction |
| P2-1 | Medium | `cors({ origin: true })` reflected any Origin | Replaced with explicit allowlist (`localhost:5173`, `127.0.0.1:5173`, `localhost:5000`, `127.0.0.1:5000`); override via `AGING_API_CORS_ORIGINS` env |
| P2-2 | Medium | `import x.json with { type: 'json' }` flagged experimental on some Node 20 lines | Switched to `fs.readFileSync` + `JSON.parse` for runtime safety |
| P2-3 | Medium | Reviewer reported mojibake in `strings.ts` | All 28 source files verified pure UTF-8. Added `.editorconfig` + `.gitattributes` to lock encoding/EOL across editors. KO modal renders Hangul correctly in browser |
| P2-4 | Medium | Aggressive caret ranges with no Node engine | Added `engines: { node: ">=20.10 <23" }` to both packages, lockfiles committed |

---

## Workspace layout

```
aging-workspace/
├── .editorconfig                        Encoding/EOL contract
├── .gitattributes                       Per-extension UTF-8 + LF rules
├── README.md                            (this file)
├── docs/
│   └── api-contract.md                  Two-payload spec, endpoint reference, v1.2 plan
│
├── aging-api/                           Node API server
│   ├── src/
│   │   ├── server.ts                    Express + CORS allowlist
│   │   ├── types.ts
│   │   ├── routes/
│   │   │   ├── health.ts                fs.readFileSync + JSON.parse
│   │   │   └── parse.ts                 GET /api/parse-demo, POST /api/parse-upload (501)
│   │   └── baselines/
│   │       └── phase1-v1.3.0.json
│   ├── scripts/
│   │   └── copy-assets.mjs              Post-build: copies JSON assets to dist/
│   ├── dist-README.md                   Shipped inside aging-api-build.zip
│   ├── package.json                     engines, type:module, build/serve scripts
│   ├── package-lock.json
│   └── tsconfig.json
│
└── aging-app/                           UI
    ├── src/
    │   ├── App.tsx                      API-first → fallback; explicit upload modal
    │   ├── api/
    │   │   └── client.ts                AgingApiClient (2.5 s timeout)
    │   ├── components/
    │   │   ├── Header.tsx               + API ONLINE / OFFLINE pill
    │   │   ├── DropZone.tsx
    │   │   ├── Readiness.tsx            + Source pill (API / Fallback)
    │   │   ├── Tabs.tsx
    │   │   ├── ConfirmModal.tsx
    │   │   ├── UploadNotSupportedModal.tsx   [P1 fix]
    │   │   └── tabs/
    │   │       ├── FilesTab.tsx
    │   │       ├── ReconciliationTab.tsx
    │   │       ├── StatementsTab.tsx
    │   │       ├── ReviewQueueTab.tsx
    │   │       └── RawJsonTab.tsx
    │   ├── i18n/strings.ts              KO / EN copy
    │   ├── parsing-engine/types.ts      ParsingPreviewResult (+ deprecated ParseResult alias)
    │   ├── baselines/
    │   │   └── phase1-v1.3.0.json
    │   ├── styles/global.css
    │   └── main.tsx
    ├── index.html
    ├── package.json                     + engines, + version 1.1.0
    ├── package-lock.json
    └── vite.config.ts                   base: './'
```

---

## API endpoints — quick reference

| Method | Path | Result | Notes |
|---|---|---|---|
| GET | `/api/health` | 200 OK | Versions + uptime; UI uses for ONLINE/OFFLINE indicator |
| GET | `/api/parse-demo` | 200 OK | `ParsingPreviewResult` body, sets `X-Aging-Source: api-baseline` |
| POST | `/api/parse-upload` | 501 | Placeholder — see `docs/api-contract.md` for v1.2 design (busboy, allowlist, child process limits) |

---

## Run locally

### API server

```bash
cd aging-api
npm install
npm start          # tsx src/server.ts
# → listening on http://127.0.0.1:3001
# → CORS allowlist: http://localhost:5173, http://127.0.0.1:5173, ...
```

Override CORS for production:

```bash
AGING_API_CORS_ORIGINS="https://aging.pinetreeexpress.com" npm start
```

### UI (development)

```bash
cd aging-app
npm install
npm run dev        # http://localhost:5173
```

Override API base:

```bash
VITE_AGING_API_BASE=https://aging.pinetreeexpress.com npm run dev
```

### Production build (UI)

```bash
cd aging-app
npm run build
# dist/ is fully relative — drop it in any static host
```

### Production run (API)

```bash
cd aging-api
npm run build       # tsc + copy-assets (baseline JSON → dist/)
npm install --omit=dev
node dist/server.js
```

The `aging-api-build.zip` artifact bundles exactly what's needed for
this last command, plus a `README.md` describing it.

---

## Verification done in this release

| Check | Result |
|---|---|
| v1.0 QA checklist (52 items) regression | **52 / 52 PASS** |
| API ON scenario: indicator + Source pill | **PASS** (green ONLINE, green Source · API) |
| API OFF scenario: silent fallback | **PASS** (muted OFFLINE, amber Source · Fallback, data still loads) |
| File drop shows explicit modal (P1-1) | **PASS** (modal + 3 attempted files listed, no auto-load) |
| Modal "Close" keeps empty state | **PASS** (no leak into baseline) |
| Modal "Load demo baseline instead" loads data | **PASS** (explicit opt-in) |
| KO modal renders Hangul | **PASS** (visual confirmation in screenshot) |
| `aging-api-build.zip` runs standalone | **PASS** (`npm install --omit=dev && node dist/server.js` confirmed) |
| Source files UTF-8 (28 files scanned for mojibake bytes) | **PASS** (0 hits) |

---

## localStorage keys

```
agingApp.language           "en" | "ko"
agingApp.lastImportSession  { importBatchId, timestamp, asOfDate, fileCount, reviewCount, dataSource }
agingApp.reviewState        { reviewedKeys: string[], notes: Record<string,string> }
```

Raw uploaded files are **never** persisted to `localStorage`. (And in
this release, they are never even parsed — see P1-1 fix above.)

---

## Roadmap

### v1.2 — Live parsing + Dashboard placeholder
- `POST /api/parse-upload` accepts multipart via **busboy** (no hand-rolled multipart)
- Server-side Phase 1 parser run, raw → `ParsingPreviewResult` conversion layer
- File size limit at busboy layer, magic-byte validation
- Auth before opening upload (Microsoft Entra / Teams SSO)
- React Router + `/dashboard` placeholder route

### v1.3 — Persistence
- SharePoint Lists for memo / dispatch / payment / exclusion flags
- Session log of imports

### v2.0 — Full Dashboard
- KPI cards (USD / CAD separated)
- Aging buckets, party drilldowns, statement send tracking

---

## Design notes

Same as v1.0 / v1.1. Operational, dense, accounting tone.
Inter Tight (sans) + JetBrains Mono (numerics). Tabular figures.
Color is never the only signal.
