# AGING APP — Phase 2 v1.0 → v1.1 Changelog

**Generated:** 2026-05-01
**Theme:** Split monolithic UI into UI + API server, with automatic fallback.

---

## What changed

### New: `aging-api/` (Node API server)

Brand-new package alongside `aging-app/`. Owns three endpoints:

| Method | Path | Status | Notes |
|---|---|---|---|
| GET | `/api/health` | 200 | Returns service version, spec version, parser version, uptime |
| GET | `/api/parse-demo` | 200 | Returns the frozen Phase 1 baseline JSON |
| POST | `/api/parse-upload` | 501 | Placeholder — live parsing comes in v1.2 |

Stack: **Node + Express 5 + TypeScript + tsx**.
CORS is permissive in dev; tighten before deployment.

### Changed: `aging-app/`

| File | Change |
|------|--------|
| `src/api/client.ts` | **NEW.** `AgingApiClient` with 2.5 s timeout, returns null on failure |
| `src/App.tsx` | API-first orchestration: `apiClient.parseDemo()` → bundled fallback |
| `src/components/Header.tsx` | New API ONLINE / OFFLINE indicator (green dot when reachable) |
| `src/components/Readiness.tsx` | New Source pill: `SOURCE · API` (green) or `SOURCE · FALLBACK` (amber) |
| `src/components/DropZone.tsx` | Disabled state while a load is in flight |
| `src/i18n/strings.ts` | New keys: `apiOnline`, `apiOffline`, `sourceApi`, `sourceFallback`, `loadingBaseline` |
| `src/styles/global.css` | New rules for `.api-indicator`, `.source-pill`, drop-zone loading |

### Unchanged

- All 5 tabs (Files, ERP Reconciliation, Statements, Review Queue, Raw JSON)
- Confirm Import flow (now persists `dataSource` in session metadata)
- Bundled baseline JSON (still shipped as authoritative fallback)
- Type definitions in `src/parsing-engine/types.ts`
- v1.0 spec / schema / parser version numbers (1.3.0 / 1.0 / 1.3.0)

---

## Behavior comparison

### v1.0
```
[click Load Baseline Demo]
  ↓
[load bundled phase1-v1.3.0.json]
  ↓
[render]
```

### v1.1
```
[boot]
  ↓
[probe /api/health, 2.5s timeout]
  ↓
[header shows API ONLINE / OFFLINE]
  ↓
[click Load Baseline Demo]
  ↓
[try /api/parse-demo, 2.5s timeout]
  ↓             ↓
[200]        [timeout/error]
  ↓             ↓
[dataSource: api]   [load bundled phase1-v1.3.0.json]
  ↓             ↓
[SOURCE · API pill]   [SOURCE · FALLBACK pill]
  ↓             ↓
[render]      [render]
```

The user always gets data. Source is visible but not alarming.

---

## Verification

### v1.0 regression
The full 52-item v1.0 QA checklist (`phase2-ui-qa-checklist.md`) still
passes against the v1.1 build. No existing functionality regressed.

```
PASS:  52
FAIL:   0
WARN:   0
```

### v1.1 integration scenarios

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | API server running | Header `API ONLINE`, pill `SOURCE · API` | ✅ |
| 2 | API server stopped | Header `API OFFLINE`, pill `SOURCE · FALLBACK` | ✅ |
| 3 | Data still loads in scenario 2 | 6 files render in Files tab from bundled fallback | ✅ |
| 4 | All 5 tabs work in both scenarios | Files / ERP / Statements / Review / Raw JSON | ✅ |
| 5 | localStorage session includes dataSource | `dataSource: "api"` or `"fallback"` | ✅ |

---

## Files in this release

```
aging-workspace-source.zip         Full monorepo source (UI + API)
aging-app-source.zip               UI source only
aging-app-build.zip                UI production build (dist/)
aging-app-preview.html             Single-file UI standalone (works offline → falls back)
aging-api-source.zip               API source only
aging-api-build.zip                API production build (dist/)
phase2-v1.1-changelog.md           This file
phase2-v1.1-README.md              Updated workspace README
```

---

## How to run end-to-end

```bash
# Terminal 1 — API
cd aging-api
npm install
npm start
# → [aging-api] listening on http://127.0.0.1:3001

# Terminal 2 — UI dev
cd aging-app
npm install
npm run dev
# → open http://localhost:5173

# UI should show "API ONLINE" in the header
# Click "Load Baseline Demo" → SOURCE · API pill (green)
# Stop the API server (Ctrl+C in Terminal 1)
# Click "Load Baseline Demo" again → SOURCE · FALLBACK pill (amber)
```

The single-file `aging-app-preview.html` works without any server at all
(falls back automatically) and is the fastest way to demo v1.1.

---

## Next: v1.2

- Wire SheetJS server-side: `POST /api/parse-upload` actually parses the
  uploaded `.xls` files and returns a real `ParseResult`
- Add `/dashboard` route + React Router
- Replace the file-drop → baseline shortcut with the real upload path
