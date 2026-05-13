# AGING APP Phase 2 v2.1 Review Queue UI Spec

Status: Frozen for implementation  
Date: 2026-05-04  
Depends on: Phase 2 v2.0 schema 1.1 details block

## North Star

The Review Queue must preserve the trust chain from dashboard number to source row.

Every review row should answer three questions without guesswork:

1. Why is this row here?
2. What amount / party / currency is affected?
3. Where is the source row in the original upload?

This is not a decorative dashboard. It is an audit surface.

## Scope

Included in v2.1:

- `/review` index page.
- `/review/:type` category pages.
- Five review categories:
  - `warnings`
  - `aging-90-plus`
  - `duplicates`
  - `not-in-erp-extract`
  - `unknown-department`
- Client-side filters and sorting.
- Inline row expansion for trace details.
- CSV export for the current filtered category.
- Graceful empty states.

Excluded from v2.1:

- Party detail rendering. `/party/:partyKey` remains reserved for v2.2.
- Editing memos, settlement, dispatch, or payment state.
- Server-side pagination.
- Virtual scrolling.
- Raw row cell rendering.

## Routes

| Route | Purpose |
| --- | --- |
| `/review` | Review category index |
| `/review/warnings` | Warning review rows |
| `/review/aging-90-plus` | Open 90+ aging rows |
| `/review/duplicates` | Duplicate transaction groups and members |
| `/review/not-in-erp-extract` | Strict local statement rows not found in ERP extract |
| `/review/unknown-department` | Rows with unmapped or unknown department |

Unknown category routes show a neutral empty page with a Back to Dashboard action.

## Review Index

The index page shows five compact category cards.

Each card shows:

- Category label.
- Row count.
- A small impact metric where available.
- Primary reason text.

Cards are navigation controls. They must be keyboard accessible with Tab and Enter.

## Category Page Layout

Each category page uses the same structure:

1. Header
   - Category name.
   - Total row count.
   - USD/CAD amount summary when applicable.
   - Back to Dashboard button.

2. Filter bar
   - Currency: All / USD / CAD.
   - Direction: All / Receivable / Payable / Settled.
   - Search: party, reference, invoice, source file, reason.
   - Sort: amount desc, aging desc, party asc, source row asc.

3. Table
   - Compact accounting-oriented table.
   - No nested cards inside table rows.
   - Row click expands trace details inline.
   - Party name is a separate link to reserved `/party/:partyKey`.

4. Footer
   - Filtered row count.
   - Export CSV button.

## Row Model

The UI derives rows from `ParsingPreviewResult.details`.

### Warnings

Source: `details.reviewItems` where `category === "WARNINGS"`.

Main columns:

- Severity
- Reason code
- Party
- Currency
- Amount
- Source type
- Source row

### 90+ Aging

Source: `details.reviewItems` where `category === "AGING_90_PLUS"`.

Main columns:

- Party
- Aging days
- Bucket
- Currency
- Direction
- Amount
- Source type
- Source row

### Duplicates

Source: `details.duplicateGroups`.

Display one group row per duplicate group. Expanding the group shows member transaction IDs and their trace rows.

Main columns:

- Identity key
- Currency
- Count
- Potential signed impact
- Member count

### Not In ERP Extract

Source: `details.reviewItems` where `category === "NOT_IN_ERP_EXTRACT"`.

This is the strict review count used by the dashboard. Current baseline count is 7.

`details.statementLinks` may contain broader historical/outside-upload-period rows. Those are not part of this strict category unless represented as review items.

Main columns:

- Party
- Statement source
- Reference
- Currency
- Statement balance
- Source file
- Source row

### Unknown Department

Source: `details.reviewItems` where `category === "UNKNOWN_DEPARTMENT"`.

Main columns:

- Party
- Source type
- Currency
- Direction
- Amount
- Department
- Source row

## Trace Expansion

Clicking a row expands a trace panel under that row.

The trace panel shows:

- Source file
- Source sheet, if present
- Source row
- Transaction ID, if present
- Party key
- Reference fields available in the row details
- Reason details as key/value pairs

The trace panel must not show `rawRow`.

## CSV Export

CSV exports the currently filtered category.

Required columns:

- category
- severity
- reasonCode
- reason
- partyKey
- partyName
- currency
- direction
- amount
- sourceType
- sourceFile
- sourceSheet
- sourceRow
- transactionId

For duplicate groups, one row is exported per duplicate group, with `transactionIds` joined by `;`.

File naming:

`aging-review-{category}-{YYYYMMDD-HHmm}.csv`

## URL State

v2.1 keeps URL state simple:

- Route stores category.
- Filters and sort remain local React state.

Query-string filter persistence is deferred to v2.2 unless users need bookmarked review views.

## Empty States

Use neutral language:

- `No items in this category.`
- `Try clearing filters.`

No celebratory copy. This is an accounting work surface.

## Accessibility

Required in v2.1:

- Tab navigation.
- Enter / Space activates category cards and expandable rows.
- Esc collapses an expanded row.
- Buttons use real `<button>` elements.
- Tables keep readable header text.

Deferred:

- Vim-style row shortcuts.
- Roving table focus.

## Performance

Current baseline:

- Review items: 234
- Duplicate groups: 40

Render all rows client-side in v2.1. Revisit pagination or virtualization only if real customer payloads exceed 1,000 visible rows in one category.

## Implementation Order

1. Replace placeholder review routes with `ReviewQueuePage`.
2. Add review row selectors / adapters from `details`.
3. Implement `/review` index cards.
4. Implement category table with filters and sort.
5. Implement inline trace expansion.
6. Implement CSV export.
7. Wire dashboard links to category pages.
8. Verify schema 1.0 graceful degradation.
9. Run TypeScript checks and baseline count checks.

## Acceptance Criteria

- Dashboard links land on the correct category.
- `/review` shows five category cards.
- `/review/not-in-erp-extract` shows exactly 7 strict rows on current baseline.
- Duplicate category shows 40 groups on current baseline.
- Expanded rows show source file and source row.
- CSV export includes trace columns.
- No raw row cell arrays appear in UI.
- Schema 1.0 payload still shows summary dashboard and disables drill-down with notice.
