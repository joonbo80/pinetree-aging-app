# AGING APP Phase 2 UI Spec

## Upload + Parsing Preview v1.0

This is the first Phase 2 screen. It must appear before Dashboard.

The goal is to make users trust the data before they see analysis.

## Product Principle

The app should answer these questions immediately after upload:

- Did the app classify each file correctly?
- Do ERP totals reconcile?
- Are USD and CAD kept separate?
- Are there critical parse blockers?
- Which statement differences are informational vs review-worthy?
- Can the user safely confirm this import?

## Primary User Flow

1. User opens the app.
2. User drags or selects files.
3. App parses files with Phase 1 engine.
4. App shows Upload + Parsing Preview.
5. User reviews classification, reconciliation, warnings, and statement checks.
6. User confirms import.
7. App moves to Dashboard.

## First Screen Layout

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Fixed Header                                                        │
│ [Pinetree Express Logo]  Aging App                  [KO/EN] [User]  │
├─────────────────────────────────────────────────────────────────────┤
│ Upload Workbench                                                    │
│                                                                     │
│ ┌─────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ Drop Zone                   │ │ Import Readiness                 │ │
│ │                             │ │ Status: Ready / Needs Review     │ │
│ │ Drag Excel files here       │ │ Files: 6                         │ │
│ │ or browse                   │ │ Critical: 0                      │ │
│ │                             │ │ Warnings: 97 etc.                │ │
│ └─────────────────────────────┘ └─────────────────────────────────┘ │
│                                                                     │
│ Preview Tabs                                                        │
│ [Files] [ERP Reconciliation] [Statements] [Review Queue] [Raw JSON] │
│                                                                     │
│ Tab Content                                                         │
│                                                                     │
│ Footer Actions                                                      │
│ [Clear] [Export JSON] [Export Review CSV]           [Confirm Import]│
└─────────────────────────────────────────────────────────────────────┘
```

## Header

### Required

- Fixed at top.
- Pinetree Express logo or wordmark on left.
- Logo click opens `https://pinetreeexpress.com`.
- Language toggle: KO / EN.
- Search box can be present but disabled or scoped to preview rows in v1.

### Do Not

- Do not show Dashboard KPIs before import confirmation.
- Do not show marketing hero content.

## Upload Workbench

### Drop Zone

Accept:

- `.xls`
- `.xlsx`
- `.pdf` metadata only, later phase for rendering

Interactions:

- Drag files over app: show active border.
- Drop multiple files: parse immediately.
- Browse button: file input.
- Re-upload: replaces current preview session only after confirmation if a session is already loaded.

### File Validation

Display per file:

- file name
- size
- detected type
- confidence
- rules passed
- status

Status values:

- `classified`
- `needs_user_selection`
- `unsupported`
- `parse_failed`

## Import Readiness Panel

This is the summary panel that decides whether the user can proceed.

### States

#### Ready

Conditions:

- no critical validation errors
- all files classified or manually assigned
- ERP reconciliation matches

Primary action:

- `Confirm Import`

#### Needs Review

Conditions:

- warnings exist
- statement informational differences exist
- Local review candidates exist

Primary action:

- `Confirm Import`

Secondary action:

- `Review Items`

#### Blocked

Conditions:

- critical validation errors
- unknown file without manual type
- invalid currency
- invalid balance
- required date missing

Primary action disabled.

## Preview Tabs

## Tab 1: Files

Purpose: verify automatic classification.

Columns:

- File
- Detected Type
- Confidence
- Rules Passed
- Rows
- Status
- Action

Actions:

- Change type, only when confidence < 100 or `UNKNOWN`.
- Remove file.
- View raw metadata.

Confidence UI:

- 100: green check
- 70-99: amber review
- <70: red/manual

Sample baseline expectation:

| File | Type | Confidence |
|---|---:|---:|
| INVOICE | INVOICE | 100 |
| CRDR | CRDR | 100 |
| AP | AP | 100 |
| AGENT Statement | AGENT_STATEMENT | 100 |
| LOCAL CAD | LOCAL_STATEMENT | 100 |
| LOCAL USD | LOCAL_STATEMENT | 100 |

## Tab 2: ERP Reconciliation

Purpose: prove numbers match.

Cards:

- INVOICE diff
- CRDR diff
- AP diff

Table columns:

- Type
- Source Rows
- Parsed
- Skipped
- Rejected
- Source Computed Total
- Parsed Total
- Diff
- Match

Display rules:

- `diff === 0`: green.
- `rejectedRowCount > 0`: red.
- `skippedRowCount > 0`: neutral/gray with reason breakdown.

Baseline:

- INVOICE diff: 0
- CRDR diff: 0
- AP diff: 0

## Tab 3: Statements

Purpose: show Agent and Local statement validation without confusing it with ERP totals.

### Agent Section

Metrics:

- Statements
- Transaction refs
- Matched CRDR refs
- Unmatched CRDR refs
- Identity mismatches
- As-of date mismatches
- Settled in ERP after statement
- Changed in ERP after statement

Important display rule:

`AS_OF_DATE_MISMATCH` is informational, not an error.

Suggested UI copy:

EN:

> Statement balances are compared with the current ERP balance as of the import date. Differences may indicate settlement or adjustment after the statement date.

KO:

> Statement 금액은 발행일 기준이고 ERP 금액은 업로드 기준일 현재 금액입니다. 차이는 발행 후 정산 또는 조정으로 발생할 수 있습니다.

### Local Section

Metrics:

- Statements
- Transaction refs
- Reconciliation errors
- ERP refs found
- Exact signed-balance matches
- Found refs with balance difference
- Refs outside uploaded ERP date range
- Same ref with different currency
- Rows without reference number
- Not in uploaded ERP extract

Important display rule:

Only `NOT_IN_UPLOADED_ERP_EXTRACT` belongs in the manual review queue.

## Tab 4: Review Queue

Purpose: isolate human action items.

Sections:

1. Critical blockers
2. Local review candidates
3. Duplicate candidates
4. Same-ref different-currency informational rows
5. Rows without reference number

### Local Review Candidates

Use `phase1-local-review-candidates.csv` shape:

- Party
- Source File
- Source Row
- Invoice Date
- Our Ref No
- Invoice No
- Currency
- Statement Balance
- Difference Type

Actions:

- Mark reviewed
- Add note
- Export CSV

Phase 2 v1 can store reviewed state in `localStorage`.

## Tab 5: Raw JSON

Purpose: support debugging and accountant/developer review.

Features:

- collapsible JSON viewer
- copy JSON
- export JSON

Do not make this the default tab.

## Confirmation Modal

When user clicks `Confirm Import`, show:

```text
Confirm Import

Files classified: 6/6
ERP reconciliation: Passed
Critical errors: 0
Review candidates: 7

This will load the parsed data into the workspace.

[Cancel] [Confirm Import]
```

After confirm:

- Save parsed JSON to browser state.
- Save session metadata to localStorage.
- Navigate to Dashboard.

## Data Mapping

### Readiness

```js
const blocked =
  validationReport.critical.length > 0 ||
  classificationReport.some(file => file.requiresUserSelection) ||
  Object.values(reconciliationReport).some(report => !report.match);

const needsReview =
  !blocked &&
  (
    validationReport.warnings.length > 0 ||
    statementMatchReport.agent.asOfDateMismatchCount > 0 ||
    statementMatchReport.local.notInUploadedErpExtractCount > 0
  );
```

### KPI Preview Cards

Use only preview-safe metrics:

- Files classified
- ERP diff status
- Critical count
- Warning count
- Statement count
- Review candidate count

Do not show full Aging KPI cards until after confirmation.

## Local Storage Keys

```js
agingApp.language
agingApp.lastImportSession
agingApp.reviewState
```

Do not persist raw uploaded files in localStorage.

## Accessibility

- Keyboard accessible tabs.
- Drop zone also has browse button.
- Color is never the only signal.
- Status labels must include text.
- Tables should preserve sortable headers.

## Visual Style

Tone:

- operational
- clear
- dense enough for accounting review
- not decorative

Recommended layout:

- fixed header
- constrained content width
- compact cards
- tables with sticky headers
- subtle status colors

Avoid:

- oversized hero section
- decorative gradients
- card-inside-card nesting
- vague labels like "Issues" without severity.

## Phase 2 v1 Acceptance Criteria

- User can upload multiple files.
- UI shows classification results.
- UI shows ERP reconciliation.
- UI shows Agent and Local statement validation.
- UI shows 7 Local review candidates from current baseline.
- User can export JSON.
- User can export Local review CSV.
- User can confirm import only when not blocked.
- KO/EN toggle persists in localStorage.

## Suggested Implementation Stack

Use:

- Vite
- React
- TypeScript
- existing `parsing-engine` as local module

First implementation route:

- `/` Upload + Parsing Preview
- `/dashboard` placeholder until confirmed import

Phase 2 v2 can add full Dashboard after this screen is stable.
