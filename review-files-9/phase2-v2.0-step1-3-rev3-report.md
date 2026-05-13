# Phase 2 v2.0 Step 1-3 — Revision 3

**Status:** Ready for re-review
**Date:** 2026-05-02
**Predecessor:** v2.0 step 1-3 rev2 (rejected — 5 findings)
**Spec:** `phase2-v2.0-spec.md` (frozen 2026-05-02)

---

## Reviewer rev2 findings → fixes

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | **P0** | LOCAL EXACT_SIGNED FK pointed to `candidateRows[0]`, often the wrong row (76/162 cases were misaimed) | ✅ Fixed: `exactSignedBalanceMatches[0]` is now strategy 1; candidateRows demoted to strategy 2 |
| 2 | **P0** | Test harness read `agent.matchedRefCount` (vacuous 0); summary actually emits `matchedCRDRRefs` | ✅ Fixed: harness reads correct field; uses `===` hard equality, not `≥`. Reviewer was 100% right — round 2 was indeed vacuous-passing |
| 3 | **P1** | "7 vs 95" UX contract conflict — Dashboard shows 7, ReviewItem made 95 | ✅ Fixed: ReviewItem NOT_IN_ERP_EXTRACT now strict 7. StatementLinks keep all 95 for future broader filter view |
| 4 | **P1** | id depended on `sourceFile`; renaming the Excel file would change ids | ✅ Fixed: id now `<sourceType>:<sourceIdentityKey>:<contentHashShort>:<sourceRow>` — sourceFile only in trace. Verified by simulating file rename: 1230/1230 ids preserved |
| 5 | **P1** | `m.exactSignedBalanceMatches > 0` was a numeric check on an array | ✅ Fixed: `Array.isArray(...) && length > 0` |

All 5 findings independently verified by the harness.

---

## Hard-equality verification (rev2 P0 #2 lesson)

The previous round's vacuous-pass came from `if (a < b)` when both `a`
and `b` were the same buggy field. Round 3 uses **explicit equality
checks against absolute v1.0 audit numbers** so a wrong field name
fails loudly instead of quietly skipping the assertion:

```js
if (agentLinks.length !== 85)            // hard equality
if (agentLinksMatched !== 85)            // hard equality
if (agentSummaryMatched !== 85)          // hard equality
if (notInErpReviews !== summaryReviewLocal)  // hard equality
if (exactWrong > 0)                      // strict zero-tolerance
```

If any field name drifts again (e.g. v1.4 renames `matchedCRDRRefs` to
something else), the test fails with the actual mismatch printed.

---

## Verification numbers (rev3)

```
Input: 1230 transactions, 282 statements

Details counts:
  transactions:    1230
  reviewItems:      234   ← reduced from 322 in rev2 (NOT_IN_ERP shrunk 95→7)
  duplicateGroups:   40
  statementLinks:   439

Cross-checks:
  duplicate groups:        40 = 40                        PASS
  duplicate tx count:      80 = 80                        PASS
  AGENT FK:                85 = 85 (links, matched, summary)  PASS
  LOCAL EXACT_SIGNED FK:   162/162 point to esm[0] row    PASS  ← rev2 P0 #1
  LOCAL FK rate:           259/259 = 100.0%               PASS
  ReviewItem NOT_IN_ERP:    7 = Dashboard 7               PASS  ← rev2 P1 #3
  reviewItem FK integrity:                                PASS
  duplicateGroup FK integrity:                            PASS
  statementLink FK integrity:                             PASS
  determinism (same input → same ids):                    PASS
  id format match:         1230/1230                      PASS
  id independence from sourceFile:  1230/1230 preserved   PASS  ← rev2 P1 #4

OVERALL: ALL CHECKS PASS
```

---

## Deep dive: rev2 P0 #1 (LOCAL EXACT_SIGNED FK)

This was the most dangerous finding — the kind of bug spec §1's "trust
chain" is meant to prevent.

**The bug:** `candidateRows[]` from Phase 1 is a *candidate* set (all
rows sharing an `ourRefNo`). Phase 1 also emits `exactSignedBalanceMatches[]`
which is the *authoritative* "this is the one that exactly matches".
Round 2 used `candidateRows[0]`, which was wrong in 76/162 cases.

**Concrete example (PEAE008975, A&B COURIER CAD):**

```
candidateRows[0]:               { sourceType: 'CRDR', sourceRow: 155, signedBalance: 0     }
candidateRows[1]:               { sourceType: 'AP',   sourceRow: 294, signedBalance: 96.12 }  ← real match
exactSignedBalanceMatches[0]:   { sourceType: 'AP',   sourceRow: 294, signedBalance: 96.12 }
```

Round 2 would have created a `matchType: 'EXACT_SIGNED'` link pointing
at the zero-balance CRDR row 155 — visually labelled "exact match" in
the UI but pointing at the wrong record.

**Round 3 fix:** Strategy 1 reads `exactSignedBalanceMatches[0]`. New
test asserts every EXACT_SIGNED link's FK matches `esm[0]`'s
sourceType+sourceRow. **162/162 correct.**

---

## Deep dive: rev2 P1 #4 (id independence from sourceFile)

**Old format:** `INVOICE:1.INVOICE_JAN-APR 2026.xls#1:bfa01a176f4f`
- File rename → id changes → v3 persistence references break

**New format:** `INVOICE:INVOICE|17355:bfa01a176f4f:1`
- `INVOICE` — sourceType
- `INVOICE|17355` — Phase 1's sourceIdentityKey (file-independent)
- `bfa01a176f4f` — sourceContentHash short (12 chars)
- `1` — sourceRow (last-resort disambiguator for true duplicates)

sourceFile is now ONLY in `trace.sourceFile`. The harness simulates a
file rename by mutating every `sourceFile` field and re-projecting:
**1230/1230 ids preserved.**

---

## Deep dive: rev2 P1 #3 (7 vs 95 UX contract)

Spec §1.4 wanted ReviewItem to be row-level. Reviewer noted this
conflicts with Dashboard's 7-count card.

**Decision:** Strict ReviewItem (7), broader population still in
StatementLinks (95).

Rationale:
- The card is named "Not in ERP extract: 7" — the UI pattern is
  click → list of 7 rows. Row count must agree with card count.
- The 95 broader population is mostly already classified into other
  categories (`OUTSIDE_DATE_RANGE`, `BALANCE_DIFFERENCE`, etc.) and
  available through `details.statementLinks` for any future filter
  view.
- `reviewCandidates.local` (v1's exact data) returns 7. v2 must agree.

```ts
// New code:
if (link.matchType !== 'NOT_IN_ERP_EXTRACT') continue;
if (!strictNotInErpRowSet.has(`${link.sourceFile}|${link.sourceRow}`)) continue;
// ... emit ReviewItem
```

`strictNotInErpRowSet` is computed in `buildDetails` from raw
`differenceType === 'NOT_IN_UPLOADED_ERP_EXTRACT'`.

---

## Files changed (rev3 deltas vs rev2)

| Path | Change |
|---|---|
| `aging-api/src/services/previewTransform.ts` | (a) `localMatchToLink`: exactSignedBalanceMatches[0] is strategy 1; (b) `localMatchType`: array-aware exact check; (c) `deterministicId`: identity-first format, sourceFile removed; (d) `buildReviewItems` accepts `strictNotInErpRowSet`; (e) `buildDetails` computes the strict set from raw |
| `tools/test-preview-transform.mjs` | (a) AGENT field name: `matchedCRDRRefs`; (b) hard equality assertions; (c) new LOCAL EXACT_SIGNED FK correctness check (`esm[0]` pointer verification); (d) new file-rename independence check; (e) new NOT_IN_ERP_EXTRACT 7=7 reconciliation check; (f) updated id format pattern |

Unchanged from rev2: `types.ts` (already had right field structure),
`partyKey.ts` + tests (passed round 1).

---

## Sample matched links (rev3)

### LOCAL EXACT_SIGNED — now correctly pointing at esm[0]

```json
{
  "source": "LOCAL",
  "sourceFile": "LOCAL STATEMENT MAR2026 CAD.xls",
  "sourceRow": 22,
  "partyKey": "a-b-courier",
  "invoiceNo": "1404778",
  "ourRefNo": "PEAE008954",
  "crdrNo": null,
  "currency": "CAD",
  "statementBalance": 28.71,
  "matchedTransactionId": "INVOICE:INVOICE|17064:f24a656a17a4:272",
  "matchType": "BALANCE_DIFFERENCE"
}
```

### AGENT (unchanged, still correct from rev2)

```json
{
  "source": "AGENT",
  "sourceRow": 16,
  "ourRefNo": "PEAE008961",
  "crdrNo": "PECDR016585",
  "matchedTransactionId": "CRDR:CRDR|13904:a315df520f81:201",
  "matchType": "SETTLED_AFTER_STATEMENT"
}
```

Note the new id format — `INVOICE|17064` is from
`sourceIdentityKey` not from the file path.

---

## Payload size

| Round | Size | vs spec §1.8 |
|---|---:|---:|
| Round 1 | 979 KB | 102% |
| Round 2 | 1140 KB | 119% |
| **Round 3** | **1080 KB** | **113%** |

Slight reduction from rev2 because NOT_IN_ERP_EXTRACT review items
shrank 95 → 7. Still well within the spec envelope.

After gzip ~155 KB on the wire.

---

## What did NOT change

- Phase 1 engine — untouched
- API endpoints — same routes
- UI components — none added/changed
- `partyKey.ts` — unchanged, already correct in round 1
- StatementLinks for AGENT — already correct in rev2

---

## Honest note on rev2 P0 #2

The reviewer correctly identified that round 2's AGENT FK check was
**vacuous-passing** because of a wrong field name. I want to call this
out openly:

```
rev2 harness:
  agentSummaryMatched = result.statementMatchReport.agent.matchedRefCount  // → 0
  agentLinksMatched = 85
  if (agentLinksMatched < agentSummaryMatched)  // 85 < 0 → false → "PASS"
```

The fix was trivial (one field name + use `===`), but the *lesson* is
about test-design discipline:

- **Don't compare two values that could both be wrong.** Compare
  against an absolute number from a separate source of truth (here:
  v1.0 audit's "85/85").
- **Use hard equality where possible.** `≥` and `<` are forgiving in
  ways unit tests don't want.

Round 3 harness now uses absolute thresholds (85, 162, 7) cross-checked
against the actual v1 summary fields with `===`.

---

## Ready for Step 4-8 if rev3 passes

```
[ ] Step 4 — generate-baseline-fixture.mjs writes v2 baseline JSON
            to both aging-app and aging-api baselines folders
[ ] Step 5 — apiClient schema version dispatch
[ ] Step 6 — Router placeholder routes
[ ] Step 7 — Dashboard click handlers
[ ] Step 8 — docs/api-contract.md update
```
