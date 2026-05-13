# Phase 2 v1.2 E2E Report

Date: 2026-05-01

## Result

Phase 2 v1.2 is accepted as the current baseline.

The application now supports:

- API-first Upload + Parsing Preview
- Real `.xls` / `.xlsx` upload through `POST /api/parse-upload`
- `X-Aging-Upload-Token` development auth gate
- Phase 1 parser isolation through a child process worker
- Confirm Import flow
- Dashboard MVP

## Verified Manually In Browser

Environment:

- API: `http://127.0.0.1:3001`
- UI: `http://localhost:5173`
- Node: `v24.15.0`
- API token: configured

### 3-file ERP E2E

Files:

- `1.INVOICE_JAN-APR 2026.xls`
- `2.CRDR_JAN-APR 2026.xls`
- `3.AP_JAN-APR 2026.xls`

Observed:

- Source: API
- Files classified: 3
- AP confidence: 100%
- INVOICE confidence: 100%
- CRDR confidence: 100%
- Critical errors: 0
- ERP reconciliation: no diff observed

### 6-file Full E2E

Files:

- `1.INVOICE_JAN-APR 2026.xls`
- `2.CRDR_JAN-APR 2026.xls`
- `3.AP_JAN-APR 2026.xls`
- `AGENT STATEMENT MAR 2026 -EXCEL FORM.xls`
- `LOCAL STATEMENT MAR2026 CAD.xls`
- `LOCAL STATEMENT MAR2026 USD.xls`

Observed in Confirm Import:

- Files classified: 6/6
- ERP reconciliation: PASSED
- Critical errors: 0
- Review candidates: 7

Observed in Dashboard:

- USD receivable: 187,985.58
- USD payable: 35,415.65
- USD net: 152,569.93
- CAD receivable: 307,104.74
- CAD payable: 275,497.75
- CAD net: 31,606.99
- 90+ count: 20
- Duplicate groups: 40
- Unknown department rows: 2
- Agent statements: 33
- Agent matched refs: 85
- Agent unmatched refs: 0
- Local statements: 249
- Local exact matches: 162
- Local not in ERP extract: 7

## Automated / Local Checks

- Phase 1 regression tests: 11/11 PASS
- API build: PASS
- UI TypeScript check: PASS
- `xlsx` dependency removed from UI
- `busboy@1.6.0` installed in API

## Known Tooling Note

In the Codex sandbox, `vite build` fails with `spawn EPERM`.
The user PowerShell environment successfully built the UI earlier, and the
dev server rendered the final Dashboard polish correctly. Use local
PowerShell for final production UI builds.

## Deferred

- Rate limiting
- Microsoft Entra / Teams SSO
- SharePoint persistence
- Audit log
- Dashboard drill-down interactions

