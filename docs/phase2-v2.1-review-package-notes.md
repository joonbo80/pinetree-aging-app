# Phase 2 v2.1 Review Queue Verification Package

Date: 2026-05-04

## What This Package Contains

This package is for external review of the v2.1 Review Queue UI.

Key files:

- `docs/phase2-v2.1-review-queue-spec.md`
- `docs/phase2-v2.0-step4-8-notes.md`
- `docs/api-contract.md`
- `aging-app/src/components/review/ReviewQueuePage.tsx`
- `aging-app/src/App.tsx`
- `aging-app/src/styles/global.css`
- `aging-app/src/baselines/phase1-v1.3.0.json`
- `aging-api/src/services/previewTransform.ts`
- `aging-api/src/baselines/phase1-v1.3.0.json`
- `tools/generate-baseline-fixture.mjs`

## Expected Baseline Counts

Current schema 1.1 baseline:

```text
transactions: 1230
reviewItems: 234
warnings: 97
aging90: 20
notInErpStrict: 7
unknownDepartment: 30
duplicateGroups: 40
statementLinks: 439
```

## Browser Verification Targets

Run the UI through HTTP, not `file://`, because React Router uses browser history.

Recommended:

```powershell
cd aging-app
npm.cmd install
npm.cmd run dev
```

Then open:

- `http://localhost:5173/review`
- `http://localhost:5173/review/warnings`
- `http://localhost:5173/review/aging-90-plus`
- `http://localhost:5173/review/duplicates`
- `http://localhost:5173/review/not-in-erp-extract`
- `http://localhost:5173/review/unknown-department`

Important checks:

1. `/review/not-in-erp-extract` shows exactly 7 strict rows.
2. `/review/duplicates` shows 40 group rows.
3. Clicking a row expands a trace panel.
4. Expanded trace panel shows source file and source row.
5. CSV export includes trace columns and opens Korean text correctly in Excel.
6. Party links navigate to reserved `/party/:partyKey`.

## Recent Micro-Fixes Before Packaging

- CSV export now prefixes UTF-8 BOM so Korean text opens correctly in Excel.
- Trace panel now renders blank `sourceSheet` as `-` instead of an empty visual gap.

## Known Non-Blocking Warning

`npm run build` emits a Vite chunk size warning because the schema 1.1 baseline JSON is bundled into the app for offline review. This is expected for the preview build. Production can later lazy-load baseline data or rely on API-only payloads.
