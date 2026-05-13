# Phase 2 v1.2 Implementation Notes

Date: 2026-05-01

## Implemented

- Absorbed the hardened v1.1.1 API/UI structure into the main workspace:
  - `aging-api/`
  - `aging-app/`
- Implemented `POST /api/parse-upload`.
- Added `busboy` multipart upload handling.
- Enforced upload limits:
  - max 10 files
  - max 25 MB per file
  - max 100 MB per request
  - `.xls` / `.xlsx` only
  - magic-byte validation for OLE `.xls` and ZIP `.xlsx`
- Added temp upload isolation and cleanup.
- Added Phase 1 worker isolation:
  - `aging-api/scripts/phase1-worker.mjs`
  - spawned with `--max-old-space-size=512`
  - 90 second wall-clock timeout from API runner
- Added raw Phase 1 result to `ParsingPreviewResult` conversion:
  - `aging-api/src/services/previewTransform.ts`
- Connected UI file drop / browse to real upload parsing.
- Added `/dashboard` placeholder through React Router.
- Added a development auth gate for upload parsing:
  - `X-Aging-Upload-Token`
  - server-side `AGING_UPLOAD_TOKEN`
  - UI-side `VITE_AGING_UPLOAD_TOKEN`

## Runtime variables

```bash
AGING_PYTHON="C:/path/to/python.exe"
AGING_PHASE1_ROOT="C:/Users/samue/OneDrive/Documents/New project"
AGING_UPLOAD_TOKEN="dev-secret-change-me"
```

`AGING_PHASE1_ROOT` must contain `parsing-engine/`, `tools/`, and the Python
dependency path used by `tools/extract_workbook.py`.

## Verified

- Phase 1 regression tests: 11/11 pass.
- Phase 1 worker successfully parsed the real INVOICE workbook through the
  child process path.

## Not fully verified in this Codex environment

- `npm install` / TypeScript build for `aging-api` and `aging-app`.

Reason: the local execution environment exposes bundled `node.exe` but not
`npm`. The code has been updated, but `package-lock.json` still needs to be
refreshed after installing the new `busboy` dependency:

```bash
cd aging-api
npm install
npm run build

cd ../aging-app
npm install
npm run build
```

## E2E checklist

See `docs/phase2-v1.2-e2e-checklist.md`.
