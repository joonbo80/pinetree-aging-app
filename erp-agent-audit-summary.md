# ERP Parsing Audit Summary

Generated: 2026-05-01T18:42:25.704Z
As of date: 2026-05-01

## Classification

| File | Type | Confidence | Rules |
|---|---:|---:|---|
| 1.INVOICE_JAN-APR 2026.xls | INVOICE | 100% | sheet_name, col1_pattern, column_count |
| 2.CRDR_JAN-APR 2026.xls | CRDR | 100% | sheet_name, col1_pattern, column_count |
| 3.AP_JAN-APR 2026.xls | AP | 100% | sheet_name, ap_heuristic, column_count |
| AGENT STATEMENT MAR 2026 -EXCEL FORM.xls | AGENT_STATEMENT | 70% | sheet_name, column_count |

## Reconciliation

| Type | Source Rows | Parsed | Skipped | Rejected | Total | Diff |
|---|---:|---:|---:|---:|---:|---:|
| INVOICE | 442 | 384 | 58 | 0 | 243001.65 | 0 |
| CRDR | 346 | 346 | 0 | 0 | 215544.96 | 0 |
| AP | 500 | 500 | 0 | 0 | 274369.69 | 0 |

## Direction Totals

| Direction | Currency | Count | Signed Balance | Absolute Balance |
|---|---|---:|---:|---:|
| receivable | CAD | 186 | 307104.74 | 307104.74 |
| payable | CAD | 213 | -275497.75 | 275497.75 |
| receivable | USD | 166 | 187985.58 | 187985.58 |
| payable | USD | 37 | -35415.65 | 35415.65 |
| settled | CAD | 461 | 0 | 0 |
| settled | USD | 167 | 0 | 0 |

## Zero Balance

Zero-balance parsed transactions: 628 (51.06%)

| Type | Currency | Count |
|---|---|---:|
| INVOICE | CAD | 226 |
| INVOICE | USD | 16 |
| CRDR | USD | 95 |
| CRDR | CAD | 40 |
| AP | USD | 56 |
| AP | CAD | 195 |

## Warning Counts

| Rule | Count |
|---|---:|
| W2 | 3 |
| W6 | 14 |
| W1 | 80 |

## Duplicate Review Policy

Phase 1 keeps exact duplicates in parsed totals and flags them for user review only. No automatic exclusion is applied.

Exact duplicate groups: 40
Exact duplicate transactions: 80
Potential duplicate signed balance impact: -70966.04

| Identity Key | Currency | Count | Potential Signed Impact | Rows |
|---|---|---:|---:|---|
| AP|29422 | CAD | 2 | -33968.76 | AP:395 AP:486 |
| AP|29467 | CAD | 2 | -13319.04 | AP:335 AP:433 |
| AP|29429 | CAD | 2 | -3815 | AP:387 AP:480 |
| AP|29445 | CAD | 2 | -2689.7 | AP:372 AP:465 |
| AP|29448 | CAD | 2 | -1530.55 | AP:367 AP:459 |
| AP|29468 | CAD | 2 | -1300 | AP:325 AP:432 |
| AP|29410 | CAD | 2 | -1229.66 | AP:389 AP:493 |
| AP|29892 | CAD | 2 | -1127.99 | AP:404 AP:499 |
| AP|29491 | CAD | 2 | -985 | AP:320 AP:410 |
| AP|29455 | CAD | 2 | -877.83 | AP:355 AP:448 |

## Skipped Rows

| Source Type | Reason | Count |
|---|---|---:|
| INVOICE | empty_customer_zero_balance | 58 |

## Info Counts

| Rule | Count |
|---|---:|
| I2 | 463 |
| I1 | 161 |

## Statements

Statement count: 33
Agent statements: 33
Agent statement transactions: 85
Agent matched CRDR refs: 85
Agent unmatched CRDR refs: 0
Agent identity mismatches: 0
Agent current balance differences: 16
Agent as-of date mismatches: 16
Agent settled in ERP after statement: 15
Agent changed in ERP after statement: 1

Local statements: 0
Local statement transactions: 0
Local reconciliation errors: 0
Local ERP refs found: 0
Local ERP refs missing/historical: 0
Local exact signed-balance matches: 0

| Local Currency | Statement Count |
|---|---:|

| Currency | Statement Count |
|---|---:|
| USD | 29 |
| CAD | 4 |

## Cross Reference

Total refs: 425
Ref/currency groups: 602
Multi-source ref/currency groups: 171
Refs with both USD and CAD: 177

| Ref | Currency | Count | Source Types | Signed Balance | Rows |
|---|---|---:|---|---:|---|
| PEOI009336 | CAD | 14 | INVOICE/AP | -1517 | INVOICE:198 INVOICE:199 INVOICE:212 INVOICE:213 AP:226 AP:238 AP:346 AP:359 AP:375 AP:376 AP:434 AP:452 AP:462 AP:463 |
| PEAE008968 | CAD | 11 | CRDR/AP | -1629.78 | CRDR:164 AP:329 AP:334 AP:337 AP:339 AP:343 AP:422 AP:424 AP:425 AP:431 AP:447 |
| PEAI008796 | CAD | 10 | INVOICE/AP | -680 | INVOICE:200 AP:188 AP:342 AP:352 AP:357 AP:386 AP:439 AP:440 AP:455 AP:473 |
| PEAE008991 | CAD | 10 | CRDR/AP | -2024.55 | CRDR:89 CRDR:90 CRDR:91 CRDR:110 AP:121 AP:123 AP:125 AP:126 AP:127 AP:192 |
| PEAI008814 | CAD | 9 | INVOICE/AP | 2380.98 | INVOICE:82 INVOICE:84 INVOICE:85 INVOICE:114 AP:90 AP:94 AP:118 AP:130 AP:190 |
| PEAI008795 | CAD | 9 | INVOICE/AP | -1755.66 | INVOICE:204 AP:354 AP:355 AP:369 AP:381 AP:448 AP:449 AP:470 AP:475 |
| PEAI008787 | CAD | 9 | INVOICE/AP | 3319 | INVOICE:243 INVOICE:244 INVOICE:290 AP:401 AP:404 AP:405 AP:494 AP:497 AP:499 |
| PEAE008972 | CAD | 9 | CRDR/AP | -54.38 | CRDR:143 CRDR:144 CRDR:146 AP:242 AP:272 AP:274 AP:276 AP:277 AP:278 |
| PEOI009386 | CAD | 8 | INVOICE/AP | 16818.31 | INVOICE:61 INVOICE:62 INVOICE:72 INVOICE:73 AP:69 AP:81 AP:88 AP:104 |
| PEOI009353 | CAD | 8 | INVOICE/AP | -265.4 | INVOICE:207 INVOICE:223 AP:321 AP:356 AP:398 AP:414 AP:454 AP:487 |
| PEOI009418 | CAD | 7 | INVOICE/CRDR/AP | -1655.99 | INVOICE:55 INVOICE:86 CRDR:51 AP:74 AP:102 AP:333 AP:418 |
| PEOI009439 | CAD | 7 | INVOICE/AP | 11934.87 | INVOICE:68 INVOICE:69 INVOICE:70 INVOICE:71 AP:61 AP:75 AP:76 |
| PEOI009374 | CAD | 7 | INVOICE/AP | 20204.46 | INVOICE:115 INVOICE:116 INVOICE:118 INVOICE:119 AP:112 AP:168 AP:172 |
| PEAI008803 | CAD | 7 | INVOICE/AP | -3607.15 | INVOICE:128 AP:134 AP:200 AP:201 AP:208 AP:210 AP:268 |
| PEOI009354 | CAD | 7 | INVOICE/AP | -562.8 | INVOICE:164 INVOICE:165 INVOICE:166 INVOICE:167 AP:255 AP:269 AP:270 |
| PEOI009341 | CAD | 7 | INVOICE/AP | -1587.11 | INVOICE:233 AP:280 AP:289 AP:314 AP:327 AP:412 AP:429 |
| PEAE008982 | CAD | 7 | CRDR/AP | -469.77 | CRDR:106 CRDR:107 AP:166 AP:169 AP:173 AP:182 AP:196 |
| PEAE008966 | CAD | 7 | CRDR/AP | -647.53 | CRDR:176 AP:371 AP:374 AP:385 AP:468 AP:469 AP:479 |
| PEAE008964 | CAD | 7 | CRDR/AP | -794.32 | CRDR:184 AP:388 AP:389 AP:392 AP:491 AP:492 AP:493 |
| PEAI008822 | CAD | 6 | INVOICE/AP | 8936.36 | INVOICE:18 INVOICE:37 INVOICE:38 AP:15 AP:16 AP:20 |
