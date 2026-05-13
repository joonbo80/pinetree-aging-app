# Phase 2 v2.0 Step 4-8 Notes

Date: 2026-05-02

## Completed

Step 4 - Baseline fixture generator

- Added `tools/generate-baseline-fixture.mjs`.
- Generator imports compiled `aging-api/dist/services/previewTransform.js`.
- Writes schema `1.1` baseline fixture to both:
  - `aging-app/src/baselines/phase1-v1.3.0.json`
  - `aging-api/src/baselines/phase1-v1.3.0.json`

Step 5 - API client schema dispatch

- `aging-app/src/api/client.ts` now logs schema-version handling:
  - missing schema: summary-only fallback warning
  - `1.0`: details unavailable warning
  - `1.1`: full v2 details
  - unknown: forward-compatible warning

Step 6 - Router placeholders

- Added placeholders for:
  - `/review`
  - `/review/:type`
  - `/party/:partyKey`

Step 7 - Dashboard click handlers

- Dashboard cards can navigate to the v2.1 Review Queue routes.
- If `details` is absent, the Dashboard shows a summary-mode notice instead of
  navigating.

Step 8 - API contract docs

- Rewrote `docs/api-contract.md` for schema `1.1`.
- Documented `details`, `StatementLink.referenceStatus`, and
  `StatementLink.differenceType`.

## Verification

Type checks:

- API TypeScript check: PASS
- UI TypeScript check: PASS

Baseline generation:

| Metric | Value |
|---|---:|
| Schema | 1.1 |
| Transactions | 1,230 |
| Review items | 234 |
| Duplicate groups | 40 |
| Statement links | 439 |
| AGENT matched | 85 |
| LOCAL exact signed | 162 |
| Strict not-in-ERP review rows | 7 |

`aging-app` and `aging-api` baseline fixtures are byte-equivalent after
generation.

## Next

Phase 2 v2.1 can start actual Review Queue rendering:

- `/review` index
- five category list views
- currency filter
- default sort per category
- CSV export per category

