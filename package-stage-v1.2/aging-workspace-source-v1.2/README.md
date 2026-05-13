# Pinetree Express AGING APP

Current baseline: **Phase 2 v1.2**

## What Works

- Phase 1 parsing engine for ERP and statement Excel files
- API-first Upload + Parsing Preview
- Real `.xls` / `.xlsx` upload through `aging-api`
- Development upload auth via `X-Aging-Upload-Token`
- Confirm Import flow
- Dashboard MVP

## Main Folders

```text
aging-api/        Express + TypeScript API
aging-app/        Vite + React UI
parsing-engine/   Phase 1 parsing engine
tools/            Excel extraction and reports
docs/             specs, reports, checklists
baselines/        frozen Phase 1 baseline outputs
```

## Run API

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project\aging-api"
$env:AGING_UPLOAD_TOKEN="dev-secret-change-me"
$env:AGING_PYTHON="C:\Users\samue\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$env:AGING_PHASE1_ROOT="C:\Users\samue\OneDrive\Documents\New project"
npm.cmd run dev
```

## Run UI

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project\aging-app"
$env:VITE_AGING_UPLOAD_TOKEN="dev-secret-change-me"
npm.cmd run dev
```

Open:

```text
http://localhost:5173/
```

## E2E Status

See:

- `docs/phase2-v1.2-e2e-report.md`
- `docs/phase2-v1.2-e2e-checklist.md`
- `docs/phase2-v1.2-implementation-notes.md`

