# Phase 2 v1.2 E2E Checklist

## Environment

API environment:

```powershell
$env:AGING_UPLOAD_TOKEN="dev-secret-change-me"
$env:AGING_PYTHON="C:\Users\samue\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$env:AGING_PHASE1_ROOT="C:\Users\samue\OneDrive\Documents\New project"
```

UI environment:

```powershell
$env:VITE_AGING_UPLOAD_TOKEN="dev-secret-change-me"
```

## Preflight

- [ ] `cd aging-api && npm install && npm run build`
- [ ] `cd aging-app && npm install && npm run build`
- [ ] `GET /api/health` returns `version: 1.2.0`
- [ ] `POST /api/parse-upload` without `X-Aging-Upload-Token` returns `401 UPLOAD_UNAUTHORIZED`
- [ ] `POST /api/parse-upload` with wrong token returns `401 UPLOAD_UNAUTHORIZED`
- [ ] `.pdf` upload returns `415 UNSUPPORTED_FILE_TYPE`
- [ ] fake `.xls` text file returns `415 INVALID_FILE_SIGNATURE`

## ERP 3-file E2E

Upload:

- `1.INVOICE_JAN-APR 2026.xls`
- `2.CRDR_JAN-APR 2026.xls`
- `3.AP_JAN-APR 2026.xls`

Expected:

- [ ] UI shows `SOURCE · API`
- [ ] Files tab shows 3 files
- [ ] INVOICE classification confidence 100
- [ ] CRDR classification confidence 100
- [ ] AP classification confidence 100
- [ ] Reconciliation diff is 0 for INVOICE / CRDR / AP
- [ ] Raw JSON has a new `uploadSession.importBatchId`
- [ ] No server temp folder remains after request

## Full 6-file E2E

Upload:

- ERP 3 files above
- `AGENT STATEMENT MAR 2026 -EXCEL FORM.xls`
- `LOCAL STATEMENT MAR2026 CAD.xls`
- `LOCAL STATEMENT MAR2026 USD.xls`

Expected:

- [ ] UI shows `SOURCE · API`
- [ ] Files tab shows 6 files
- [ ] Agent statement match: 85 matched CRDR refs, 0 unmatched
- [ ] Local statement transactions/review metrics render
- [ ] Local review candidates render in Review Queue
- [ ] Reconciliation diff is 0 for ERP files
- [ ] Statement as-of differences are warnings/info, not critical blockers
- [ ] No server path or Python stack trace appears in UI errors
- [ ] No server temp folder remains after request

## Notes

- Rate limiting is intentionally deferred until auth/routing shape is stable.
- Production must replace `X-Aging-Upload-Token` with Microsoft Entra /
  Teams SSO.

