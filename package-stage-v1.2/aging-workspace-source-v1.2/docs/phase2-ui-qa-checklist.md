# Phase 2 Upload Preview QA Checklist

Use this checklist before connecting live Excel upload parsing.

## Open The App

- Open `phase2-ui/index.html` directly with `file://`.
- Click `Load baseline demo`.
- Confirm no server is required for baseline demo mode.

## Header

- Pinetree Express brand is visible.
- Brand click opens `https://pinetreeexpress.com`.
- KO/EN toggle changes visible labels.
- Language choice persists after refresh.
- Search input is visible and disabled before loading data.

## Files Tab

- Six files appear.
- All six files show confidence `100%`.
- Rules are visible:
  - INVOICE: `sheet_name`, `col1_pattern`, `column_count`
  - CRDR: `sheet_name`, `col1_pattern`, `column_count`
  - AP: `sheet_name`, `ap_heuristic`, `column_count`
  - AGENT: `sheet_name`, `agent_heuristic`, `column_count`
  - LOCAL: `sheet_name`, `local_heuristic`, `column_count`

## ERP Reconciliation Tab

- INVOICE diff is `0.00`.
- CRDR diff is `0.00`.
- AP diff is `0.00`.
- Rejected rows are `0`.
- Skipped INVOICE rows are visible as neutral, not as an error.

## Statements Tab

- Agent statements show:
  - Statements: `33`
  - Transaction refs: `85`
  - Matched CRDR refs: `85`
  - As-of mismatches: `16`
  - Settled in ERP after statement: `15`
  - Changed in ERP after statement: `1`
- Local statements show:
  - Statements: `249`
  - Transaction refs: `354`
  - Review candidates: `7`
  - Reconciliation errors: `0`

## Review Queue Tab

- Local review queue shows exactly `7` rows.
- `NOT_IN_UPLOADED_ERP_EXTRACT` rows are visually marked for review.
- Duplicate candidates are counted but not auto-excluded.
- No USD/CAD values are merged.

## Raw JSON Tab

- Version values show:
  - `specVersion`: `1.3.0`
  - `schemaVersion`: `1.0`
  - `parserVersion`: `1.3.0`

## Export

- `Export JSON` downloads a JSON file.
- `Export review CSV` downloads a CSV with 7 rows.

## Confirm Import

- `Confirm Import` opens a confirmation modal.
- Modal shows:
  - classified files
  - ERP reconciliation status
  - critical count
  - review candidate count
- Confirming saves session metadata to localStorage.
- Confirming navigates to Dashboard placeholder.

## Responsive Check

- Desktop width: tables remain readable.
- Narrow width: workbench stacks vertically.
- Buttons do not overflow.
- Table scrolling works horizontally when needed.

## Known Phase 2 v1 Limits

- Live `.xls/.xlsx` browser parsing is not connected yet.
- SharePoint/Teams integration is excluded.
- Dashboard is a placeholder until Upload + Parsing Preview is approved.
