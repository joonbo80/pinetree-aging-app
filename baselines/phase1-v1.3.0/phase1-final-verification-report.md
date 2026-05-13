# AGING APP Phase 1 Final Verification Report

Generated: 2026-05-01T18:57:02.804Z
Input: erp-all-parse-result.json
As of date: 2026-05-01
Spec version: 1.3.0
Schema version: 1.0
Parser version: 1.3.0

## Executive Decision

Phase 1 parsing engine is ready to freeze for UI development, with 7 Local Statement rows reserved for business review.

## Classification

| File | Detected Type | Confidence | Rules |
|---|---:|---:|---|
| 1.INVOICE_JAN-APR 2026.xls | INVOICE | 100% | sheet_name, col1_pattern, column_count |
| 2.CRDR_JAN-APR 2026.xls | CRDR | 100% | sheet_name, col1_pattern, column_count |
| 3.AP_JAN-APR 2026.xls | AP | 100% | sheet_name, ap_heuristic, column_count |
| AGENT STATEMENT MAR 2026 -EXCEL FORM.xls | AGENT_STATEMENT | 100% | sheet_name, agent_heuristic, column_count |
| LOCAL STATEMENT MAR2026 CAD.xls | LOCAL_STATEMENT | 100% | sheet_name, local_heuristic, column_count |
| LOCAL STATEMENT MAR2026 USD.xls | LOCAL_STATEMENT | 100% | sheet_name, local_heuristic, column_count |

## ERP Reconciliation

| Type | Source Rows | Parsed | Skipped | Rejected | Total | Diff | Match |
|---|---:|---:|---:|---:|---:|---:|---:|
| INVOICE | 442 | 384 | 58 | 0 | 243001.65 | 0 | true |
| CRDR | 346 | 346 | 0 | 0 | 215544.96 | 0 | true |
| AP | 500 | 500 | 0 | 0 | 274369.69 | 0 | true |

## ERP Totals

| Direction | Currency | Count | Signed Balance | Absolute Balance |
|---|---|---:|---:|---:|
| receivable | CAD | 186 | 307104.74 | 307104.74 |
| settled | CAD | 461 | 0 | 0 |
| receivable | USD | 166 | 187985.58 | 187985.58 |
| settled | USD | 167 | 0 | 0 |
| payable | USD | 37 | -35415.65 | 35415.65 |
| payable | CAD | 213 | -275497.75 | 275497.75 |

## Anomaly Summary

| Category | Rule | Count | Interpretation |
|---|---|---:|---|
| Warning | W1 | 80 | Exact duplicate candidates; kept in parsed totals for review, not auto-excluded. |
| Warning | W2 | 3 | Companies with both USD and CAD; counted per company. |
| Warning | W6 | 14 | AP negative balance; flagged but parsed. |
| Info | I1 | 161 | Aging greater than 90 days. |
| Info | I2 | 463 | Due date before as-of date with non-zero balance. |

## Agent Statements

| Metric | Value |
|---|---:|
| Statements | 33 |
| Transaction refs | 85 |
| Matched CRDR refs | 85 |
| Unmatched CRDR refs | 0 |
| Identity mismatches | 0 |
| As-of date mismatches | 16 |
| Settled in ERP after statement | 15 |
| Changed in ERP after statement | 1 |

Agent as-of mismatches are not parsing errors. They compare statement-date balances against ERP current balances.

## Local Statements

| Metric | Value |
|---|---:|
| Statements | 249 |
| Transaction refs | 354 |
| Reconciliation errors | 0 |
| ERP refs found | 259 |
| Exact signed-balance matches | 162 |
| Found refs with balance difference | 97 |
| Refs outside uploaded ERP date range | 67 |
| Same ref with different currency | 20 |
| Rows without reference number | 10 |
| Not in uploaded ERP extract | 7 |

Uploaded ERP transaction date range: 2026-01-01 to 2026-04-30

## Local Review Candidates

These 7 rows are the only Local Statement rows that remain as business review candidates after separating historical rows, same-ref different-currency rows, and rows without a reference number.

| Party | Source Row | Date | Ref | Invoice | Currency | Balance |
|---|---:|---|---|---|---|---:|
| CEDRUS GLOBAL TRADING | 1676 | 2026-01-03 | PEAE008896 | ITC355043 | CAD | -691.56 |
| CEDRUS GLOBAL TRADING | 1678 | 2026-01-03 | PEAE008896 | ITC355044 | CAD | -691.56 |
| FEDEX FREIGHT CANADA | 2459 | 2026-02-25 | PEAE003106 | 2-716-13843 | CAD | -276.85 |
| OLBERT METAL | 6023 | 2026-01-27 | PEOI009159 | PEIN018587 | CAD | 35 |
| S&J TRANSPORT | 7050 | 2026-01-05 | PEOI009180 | 24465 | CAD | -100 |
| WIN YAN LOGISTICS | 8894 | 2026-01-31 | PEOI009210 | 1760 | CAD | -725 |
| OLBERT METAL | 1386 | 2026-01-27 | PEOI009158 |  | USD | 35 |

## Phase 2 Display Rules

- Show Agent `AS_OF_DATE_MISMATCH` as informational, not as an error.
- Show Local `OUTSIDE_UPLOADED_ERP_DATE_RANGE` as historical/outside extract.
- Show Local `SAME_REF_DIFFERENT_CURRENCY` separately and never merge USD/CAD.
- Put Local `NOT_IN_UPLOADED_ERP_EXTRACT` rows into a review queue.
- Keep duplicate candidates visible but do not auto-exclude them without user approval.

## Freeze Recommendation

Freeze Phase 1 parser behavior and use this report as the baseline snapshot for Phase 2 UI work.
