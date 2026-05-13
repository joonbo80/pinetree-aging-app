# AGING APP Phase 1 JSON Contract v1.3.0

This contract is the frozen Phase 1 output shape for Phase 2 UI work.

## Versions

- `specVersion`: `1.3.0`
- `schemaVersion`: `1.0`
- `parserVersion`: `1.3.0`

## Top-Level Result

```js
{
  specVersion,
  schemaVersion,
  parserVersion,
  uploadSession,
  classificationReport,
  transactions,
  statements,
  reconciliationReport,
  statementMatchReport,
  validationReport,
  skippedRows,
  rejectedRows
}
```

## UI Responsibilities

Use `transactions` for Aging calculations and dashboard KPIs.

Use `statements` for AGENT/LOCAL statement document views and statement comparison.

Use `statementMatchReport` for explanation badges and review queues.

Use `reconciliationReport` and `validationReport` for upload preview and confirmation.

Do not recalculate ERP parsing rules in the UI.

## Upload Session

```js
uploadSession: {
  importBatchId,
  timestamp,
  user,
  asOfDate,
  preview,
  files: [{ name, type, recordCount }]
}
```

`asOfDate` is required and controls reproducible Aging calculations.

## Classification Report

```js
classificationReport: [{
  file,
  detectedType,
  confidence,
  rulesPassed,
  requiresUserSelection
}]
```

Phase 1 baseline expects all six sample files to classify at `100%`.

## Transaction

Transactions come only from ERP source files: `INVOICE`, `CRDR`, and `AP`.

```js
{
  id,
  sourceIdentityKey,
  sourceContentHash,
  sourceFile,
  sourceSheet,
  sourceType,
  sourceRow,
  sourceInternalId,
  importBatchId,
  importAsOfDate,
  rawRow,

  ourRefNo,
  crdrNo,
  invoiceNo,
  vendorInvoiceNo,
  blNo,

  partyName,
  partyNameRaw,
  partyType,

  currency,
  grossAmount,
  paidAmount,
  rawBalance,
  signedBalance,
  absoluteBalance,
  isZeroBalance,
  direction,

  drAmount,
  crAmount,

  transactionDate,
  postDate,
  dueDate,
  agingBaseDate,
  agingBasis,
  agingDays,
  agingBucket,

  department,
  departmentRaw,
  departmentLabel,
  createdBy,

  parseStatus,
  anomalyRefs,
  normalization
}
```

### Calculation Rules

- Never combine USD and CAD.
- `direction` is `receivable`, `payable`, or `settled`.
- If `isZeroBalance === true`, `direction === "settled"`.
- KPI totals should use:
  - receivable total: sum `absoluteBalance` where `direction === "receivable"`.
  - payable total: sum `absoluteBalance` where `direction === "payable"`.
  - net flow: sum `signedBalance`.

## Statement

Statements come from `AGENT_STATEMENT` and `LOCAL_STATEMENT`.

Statements do not replace `transactions` for Aging calculations.

### Agent Statement

```js
{
  sourceType: "AGENT_STATEMENT",
  partyName,
  partyNameRaw,
  statementDate,
  period,
  departments,
  currency,
  direction,
  dueToText,
  transactionRefs,
  transactions,
  totals,
  reconciliation
}
```

Agent statement transaction rows include:

```js
{
  sourceRow,
  date,
  ourRefNo,
  blNo,
  crdrNo,
  dr,
  cr,
  payment,
  balance,
  departmentLabel
}
```

### Local Statement

```js
{
  sourceType: "LOCAL_STATEMENT",
  partyName,
  partyNameRaw,
  customerId,
  reportType,
  statementDate,
  period,
  departments,
  currency,
  direction,
  previousBalance,
  transactionRefs,
  transactions,
  aging,
  totals,
  reconciliation
}
```

Local statement transaction rows include:

```js
{
  sourceRow,
  invoiceDate,
  dueDate,
  etd,
  ourRefNo,
  blNo,
  invoiceNo,
  currency,
  charge,
  payment,
  balance,
  direction
}
```

## Reconciliation Report

```js
reconciliationReport: {
  INVOICE: { sourceRowCount, parsedRowCount, skippedRowCount, rejectedRowCount, sourceComputedTotal, parsedTotal, diff, match, currencies },
  CRDR: { ... },
  AP: { ... }
}
```

Upload preview should block on critical rejected rows, not on informational statement match differences.

## Statement Match Report

### Agent Match

```js
statementMatchReport.agent: {
  statementCount,
  transactionRefCount,
  matchedRefCount,
  unmatchedRefCount,
  identityMismatchCount,
  currentBalanceDiffCount,
  asOfDateMismatchCount,
  settledInErpCount,
  changedInErpCount,
  statements
}
```

Agent `AS_OF_DATE_MISMATCH` means statement-date balance differs from ERP current balance. It is informational, not a parsing error.

### Local Match

```js
statementMatchReport.local: {
  statementCount,
  transactionRefCount,
  refFoundCount,
  refMissingCount,
  outsideUploadedErpDateRangeCount,
  unmatchedWithinUploadedDateRangeCount,
  sameRefDifferentCurrencyCount,
  noReferenceNumberCount,
  notInUploadedErpExtractCount,
  refFoundBalanceDiffCount,
  exactSignedBalanceMatchCount,
  erpDateRange,
  statements
}
```

Local difference types:

- `AS_OF_DATE_MISMATCH`: ref exists but current ERP balance differs.
- `OUTSIDE_UPLOADED_ERP_DATE_RANGE`: statement row is outside uploaded ERP date range.
- `SAME_REF_DIFFERENT_CURRENCY`: same ref exists in another currency; never merge.
- `NO_REFERENCE_NUMBER`: statement row does not carry a usable ref.
- `NOT_IN_UPLOADED_ERP_EXTRACT`: review queue item.

## Validation Report

```js
validationReport: {
  critical,
  warnings,
  info
}
```

Phase 1 policy:

- W1 duplicate candidates stay in parsed totals.
- W2 same-company USD/CAD is counted per company.
- W6 AP negative balance is a warning, not a parse rejection.
- I1 and I2 are aging/date information.

## Baseline Files

Baseline files are stored in `baselines/phase1-v1.3.0`.

Use them as snapshot references before making parser changes.
