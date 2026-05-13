# Phase 2 v2.0 Step 1-3 — Revision 2 (Fixes for Round 1 Review)

**Status:** Ready for re-review
**Date:** 2026-05-02
**Predecessor:** v2.0 step 1-3 round 1 (rejected)
**Spec:** `phase2-v2.0-spec.md` (frozen 2026-05-02)

---

## Reviewer findings → fixes

| # | Severity | Finding | Fix verified |
|---|---|---|---|
| 1 | **P0** | AGENT statement links 0/85 matched (used `ourRefNo`/`invoiceNo`, but AGENT uses `crdrNo` + `crdrSourceRow`) | ✅ AGENT FK now 85/85 — `agentMatchToLink` uses `crdrSourceRow` first, `crdrNo`+currency fallback |
| 2 | **P0** | matchType mapper used wrong raw values (`'ref_found'` vs actual `'found'`; AGENT has no `referenceStatus` at all) | ✅ Split into `localMatchType` and `agentMatchType`. Tested against full distribution from real raw |
| 3 | **P1** | `refIdx` overwrote across USD/CAD and INVOICE/CRDR | ✅ New `buildTxIndex` is scoped: `(sourceType, currency, identifier)` — collisions impossible |
| 4 | **P1** | `refNo` overloaded `ourRefNo`; `vendorName` was actually `vendorInvoiceNo` | ✅ Six distinct fields: `ourRefNo`, `invoiceNo`, `crdrNo`, `blNo`, `vendorInvoiceNo`, `vendorName`. `StatementLink` similarly carries `ourRefNo` + `invoiceNo` + `crdrNo` |
| 5 | **P1** | `id: String(tx.id)` was raw UUID — non-deterministic across reparses | ✅ `id` is now deterministic: `<sourceType>:<sourceFile>#<sourceRow>:<contentHashShort>`. Raw UUID kept as `rawId` for round-trip debug. Determinism check in harness PASSES |
| 6 | **P1** | `buildLocalReviewCandidates` condition mismatch (`differenceType === 'NOT_IN_UPLOADED_ERP_EXTRACT'`) | **Investigated, no change needed.** The existing summary value of 7 is computed from this exact condition and IS correct: `differenceType: 'NOT_IN_UPLOADED_ERP_EXTRACT'` returns 7 rows in the real data. The 95-row figure for v2 details comes from a different field (`referenceStatus: 'not_in_uploaded_erp_extract'`). Both numbers are intentional and correct — see "Numbers reconciled" below |
| 7 | **P2** | Windows `await import(resolve(...))` failed on absolute paths | ✅ Test harness now uses `pathToFileURL(resolve(...)).href` |

---

## Verification numbers

```
Input: 1230 transactions, 282 statements

Details counts:
  transactions:    1230
  reviewItems:     322
  duplicateGroups:  40   ← matches summary groupCount
  statementLinks:  439

Cross-checks:
  duplicate groups:     40 = 40                   PASS
  duplicate tx count:   80 = 80                   PASS
  AGENT FK:             85/85 matched             PASS  ← reviewer P0 #1 resolved
  LOCAL FK rate:        259/259 = 100.0%          PASS
  reviewItem FK:        all resolve               PASS
  duplicateGroup FK:    all resolve               PASS
  statementLink FK:     all resolve               PASS
  determinism:          same input → same ids     PASS
  id format:            1230/1230 match pattern   PASS

OVERALL: ALL CHECKS PASS
```

### matchType distribution (sanity check)

| Source | matchType | Count |
|---|---|---:|
| LOCAL | EXACT_SIGNED | **162** |
| LOCAL | BALANCE_DIFFERENCE | 97 |
| LOCAL | NOT_IN_ERP_EXTRACT | 95 |
| AGENT | EXACT_SIGNED | 69 |
| AGENT | SETTLED_AFTER_STATEMENT | 15 |
| AGENT | CHANGED_AFTER_STATEMENT | 1 |

**Cross-validates with v1.0 audit:** "162 exact local matches" was a
named figure from the original Phase 1 audit. v2 projection reproduces
it exactly.

---

## Numbers reconciled (the "7 vs 95" question)

This caused confusion in round 1. The two values mean different things:

| Number | Source | Meaning |
|---:|---|---|
| **7** | `reviewCandidates.local` (summary) | Local statement matches with `differenceType: 'NOT_IN_UPLOADED_ERP_EXTRACT'` AND no other classifying difference. This is the small set of "purely missing" rows |
| **95** | `details.statementLinks` filtered by `matchType === 'NOT_IN_ERP_EXTRACT'` | All matches with `referenceStatus: 'not_in_uploaded_erp_extract'`, regardless of other categorization |

Verified against real raw values:

```
referenceStatus 'not_in_uploaded_erp_extract':  95 rows
differenceType 'NOT_IN_UPLOADED_ERP_EXTRACT':    7 rows
intersection of both conditions:                 7 rows  ← summary's 7
```

**UX contract for v2.1:** The Dashboard "Not in ERP extract: 7" card
opens a Review Queue showing the 7 strict-not-found rows. A separate
filter or expansion can reveal the broader 95 if needed. Spec §1.4
covers this — 7 and 95 are both correct, surface different UX needs.

---

## Files changed in revision 2

| Path | Change |
|---|---|
| `aging-app/src/parsing-engine/types.ts` | `PreviewTransaction` reference fields split; `rawId` added; `StatementLink` carries `ourRefNo`/`invoiceNo`/`crdrNo` distinctly |
| `aging-api/src/services/previewTransform.ts` | `deterministicId()`, `buildTxIndex()` scoped index, separate `localMatchToLink`/`agentMatchToLink`, separate `localMatchType`/`agentMatchType`, dead `toAgingBucket` removed |
| `tools/test-preview-transform.mjs` | Windows-safe `pathToFileURL` + AGENT FK preservation check + LOCAL FK rate check + determinism check + id format check |

`partyKey.ts` and `partyKey.test.ts` — no changes needed (passed round 1
review).

---

## Sample matched links

### LOCAL (correctly matched to INVOICE row 272)

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
  "matchedTransactionId": "INVOICE:1.INVOICE_JAN-APR 2026.xls#272:f24a656a17a4",
  "matchType": "BALANCE_DIFFERENCE"
}
```

### AGENT (correctly matched to CRDR row 201)

```json
{
  "source": "AGENT",
  "sourceFile": "AGENT STATEMENT MAR 2026 -EXCEL FORM.xls",
  "sourceRow": 16,
  "partyKey": "all-care-logix",
  "invoiceNo": null,
  "ourRefNo": "PEAE008961",
  "crdrNo": "PECDR016585",
  "currency": "USD",
  "statementBalance": 746.44,
  "matchedTransactionId": "CRDR:2.CRDR_JAN-APR 2026.xls#201:a315df520f81",
  "matchType": "SETTLED_AFTER_STATEMENT"
}
```

Note `matchType: SETTLED_AFTER_STATEMENT` — exactly the case the
reviewer flagged as misclassified in round 1. Now correct.

---

## Sample PreviewTransaction (showing new field separation)

```json
{
  "id": "INVOICE:1.INVOICE_JAN-APR 2026.xls#1:bfa01a176f4f",
  "rawId": "ca507e64-fe5c-4cf2-b989-7be6b92e1cee",
  "sourceType": "INVOICE",
  "partyKey": "wig-beauty-outlet",
  "partyName": "WIG BEAUTY OUTLET",
  "department": "GE",
  "currency": "CAD",
  "rawBalance": 87.83,
  "signedBalance": 87.83,
  "absoluteBalance": 87.83,
  "direction": "receivable",
  "isZeroBalance": false,
  "invoiceDate": "2026-04-30",
  "dueDate": null,
  "postDate": "2026-04-30",
  "agingBasisDate": "2026-04-30",
  "agingDays": 1,
  "agingBucket": "0-30",
  "ourRefNo": "TRU-00376",
  "invoiceNo": "PEIN019475",
  "crdrNo": null,
  "blNo": "328144",
  "vendorInvoiceNo": null,
  "vendorName": null,
  "trace": {
    "sourceFile": "1.INVOICE_JAN-APR 2026.xls",
    "sourceSheet": "Invoice List - Close Open",
    "sourceRow": 1
  },
  "flags": []
}
```

The reference fields are now properly distinct. `id` is deterministic;
`rawId` preserved for debugging.

---

## Payload size

| Round | Size | vs spec §1.8 estimate |
|---|---:|---:|
| Round 1 | 979 KB | 102% |
| Round 2 | **1140 KB** | 119% |

Slight increase is expected — added fields per row (rawId, blNo,
vendorInvoiceNo, ourRefNo separation). Still well below any concern
threshold. After gzip ~160 KB on the wire.

---

## Reviewer's headline concern, restated

> "특히 AGENT 85건 100% 매칭이라는 Phase 1의 강점이 v2 projection에서 사라질 수 있습니다."

**Fixed and verified.** AGENT 85/85 → 85/85 PASS. The Phase 1 audit
guarantee survives the v2 projection.

---

## What NOT changed (intentional)

- Phase 1 engine — untouched
- Existing summary fields (`directionTotals`, `validationReport`, etc.) — same shape
- API endpoints — same routes, same status codes
- UI components — none added/changed in steps 1-3
- `buildLocalReviewCandidates` — its 7-row output is correct as-is, see §6 above
- `partyKey.ts` — no changes (passed round 1)

---

## Next: ready for Step 4-8

If this rev2 passes review:

```
[ ] Step 4 — generate-baseline-fixture.mjs writes v2 baseline JSON
            to both aging-app and aging-api baselines folders, with
            spec §4.3 validator gating
[ ] Step 5 — apiClient schema version dispatch
[ ] Step 6 — Router placeholder routes
[ ] Step 7 — Dashboard click handlers
[ ] Step 8 — docs/api-contract.md update
```

Then v2.1 begins (actual Review Queue UI).
