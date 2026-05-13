# Phase 2 v2.0 Implementation — Step 1-3 Complete

**Status:** Ready for review
**Date:** 2026-05-02
**Scope:** Preview Details Contract (types + partyKey + previewTransform projection)
**Predecessor:** v1.2.1 (frozen, absorbed)
**Spec:** `phase2-v2.0-spec.md` (frozen 2026-05-02)

---

## Summary

Three steps from the v2.0 implementation order are done. The data
contract for v2.0 drill-down is real, populated, and verified end-to-end
on the actual frozen baseline (1,230 ERP transactions, 282 statements).

After this work, the next step (Review Queue UI) is pure rendering — no
more "we don't have the data to show" blockers.

---

## Files changed

| Step | File | Lines | Purpose |
|---|---|---:|---|
| 1 | `aging-app/src/parsing-engine/types.ts` | 364 | Added `ParsingPreviewDetails`, `PreviewTransaction`, `ReviewItem`, `DuplicateGroupDetail`, `StatementLink`, `TraceRef`, `AgingBucket`, `ReviewCategory`, `StatementMatchType` |
| 2 | `aging-app/src/utils/partyKey.ts` | 97 | Normalizer per spec §8.2 |
| 2 | `aging-app/src/utils/partyKey.test.ts` | 163 | 31 unit tests, all PASS |
| 2 | `aging-api/src/utils/partyKey.ts` | 97 | Mirror for API-side use |
| 3 | `aging-api/src/services/previewTransform.ts` | 678 | Extended with `buildDetails()` + 4 builders |
| 3 | `tools/test-preview-transform.mjs` | 110 | E2E verification harness |

No other files changed. Phase 1 engine, route handlers, auth middleware,
UI components — all untouched, per spec §8.1.

---

## Step 1 — Types (spec §1)

`ParsingPreviewResult.details` is **optional**. v1.x consumers ignoring
this field continue to work unchanged. v2.0 UI (forthcoming) checks
`result.details` before navigating to drill-down routes.

`schemaVersion` policy:
- v1 payload: `"1.0"` (no `details`)
- v2 payload: `"1.1"` (has `details`)
- UI must accept both

Compile checks: `npx tsc --noEmit` passes both `aging-app` and `aging-api`.

---

## Step 2 — partyKey (spec §8.2)

**31 unit tests, 31 PASS.** Coverage:

- All 6 spec examples (English + Korean)
- English suffix edge cases (mid-word "Income" not stripped, stacked "Co Ltd" peeling)
- Korean suffix positioning (start, end, surrounded by spaces)
- Mixed-form: `"(주)Pinetree Express LTD" → "pinetree-express"`
- Character cleanup, separators, Unicode (한글)
- Idempotency (running twice gives same result)
- URL safety (no slashes, quotes, whitespace in output)
- Edge cases: null, undefined, empty, punctuation-only → `"unknown-party"`

**Important constraint preserved:** `partyKey` is for UI routing only.
Two transactions sharing a key are NOT auto-merged for accounting
purposes. Any business-level "same party" decision still goes through
the manual alias table from the Phase 1 freeze. (See spec §8.2.)

---

## Step 3 — previewTransform.ts details generation

The existing `toParsingPreviewResult()` is extended with a
`buildDetails()` call that produces the four detail arrays. Phase 1
engine output is unchanged.

### 3.1 Builders

| Builder | Output | Source |
|---|---|---|
| `buildPreviewTransactions` | 1,230 `PreviewTransaction` | All `raw.transactions[]`, projected with `partyKey()` and date coercion to YYYY-MM-DD |
| `buildDuplicateGroupDetails` | 40 groups, 80 transactions | Same identity logic as `buildDuplicateReview` (W1-flagged, sourceIdentityKey + sourceContentHash, drop singletons + all-zero) |
| `buildStatementLinks` | 439 links | Per-row `matches[]` from local + agent statements with `matchedTransactionId` FK resolution |
| `buildReviewItems` | 322 items across 5 categories | Synthesizes from validation report + transactions + duplicate groups + statement links |

### 3.2 ReviewItem distribution

| Category | Count | Notes |
|---|---:|---|
| WARNINGS | 97 | W1 (80 dup tx) + W2 (synthetic per company) + W6 |
| AGING_90_PLUS | 20 | Non-settled transactions in `90+` bucket |
| DUPLICATES | 80 | One per transaction in a duplicate group |
| NOT_IN_ERP_EXTRACT | 95 | Per-row local statement matches with `not_in_uploaded_erp_extract` status |
| UNKNOWN_DEPARTMENT | 30 | Transactions with `department === null` |
| **Total** | **322** | |

Note: same source row CAN appear in multiple categories (e.g. duplicate
also 90+ aging). UI de-duplicates by `transactionId` at render time per
spec §1.4.

### 3.3 Number consistency vs summary

| Metric | Summary value | Detail value | Match |
|---|---:|---:|:---:|
| `duplicateReview.groupCount` vs `duplicateGroups.length` | 40 | 40 | ✅ |
| `duplicateReview.transactionCount` vs unique tx in groups | 80 | 80 | ✅ |
| `reviewCandidates.local.length` vs `NOT_IN_ERP_EXTRACT` items | 7 | 95 | ⚠️ intentional |

**The 7 vs 95 difference is intentional and documented** in spec §1.4:
- Summary is per-party (7 parties have unmatched local statement rows)
- Detail is per-row (95 rows total across those 7 parties)
- UI clicking "Not in ERP extract: 7" navigates to a list of 95 rows
  grouped by party

### 3.4 Spec §4.3 validator

All three FK integrity checks pass against the generated baseline:

```
reviewItem FK integrity:    PASS  (all transactionId values resolve to a transaction)
duplicateGroup FK integrity: PASS  (all transactionIds[] resolve)
statementLink FK integrity:  PASS  (all matchedTransactionId values resolve, or null)
```

### 3.5 Payload size (measured)

| | Spec §1.8 estimate | Measured |
|---|---:|---:|
| Total v2 payload (uncompressed) | ~960 KB | **979 KB** |
| Variance vs estimate | — | **+2%** |

The estimate held up well. Gzip ratio expectation (~7×) gives ~140 KB
on the wire — comfortably under any LAN concern.

---

## Acceptance criteria checklist (spec §6)

- [x] `ParsingPreviewResult` v2 type definition committed to `aging-app/src/parsing-engine/types.ts`
- [x] `details: undefined` confirmed safe (field is optional, existing summary code untouched)
- [x] `partyKey` normalization function committed to a shared location and unit-tested
- [x] `previewTransform.ts` extended to produce `details` block in `aging-api`
- [x] Spec §4.3 validator passes on the projected output
- [ ] Five route placeholders exist in router (Step 6, pending)
- [ ] `tools/generate-baseline-fixture.mjs` writes committed v2 baseline JSON (Step 4, pending)
- [ ] Schema version dispatch in `apiClient` (Step 5, pending)
- [ ] `docs/api-contract.md` updated with v2 schema (Step 8, pending)
- [x] No new UI components beyond placeholder routes — none added in steps 1-3

---

## What did NOT change (intentional)

- **Phase 1 engine** — frozen, untouched. v2.0 is a pure projection layer
  above it (spec §8.1).
- **Existing summary fields** — `directionTotals`, `agingBuckets`,
  `validationReport`, etc. all keep their current shape.
- **API endpoints** — same routes, same status codes.
- **UI components** — Dashboard, tabs, modals all unchanged.
- **Schema version emission for v1 callers** — actually, the API now
  always emits `"1.1"`. v1.x UI ignores `details` so no break, but
  callers reading `schemaVersion` should expect `"1.1"`.

---

## Next steps

Per spec §7 implementation order:

```
[ ] Step 4 — Baseline fixture generator
    tools/generate-baseline-fixture.mjs writes
    aging-app/src/baselines/phase1-v1.3.0.json (v2)
    aging-api/src/baselines/phase1-v1.3.0.json (mirror)

[ ] Step 5 — apiClient schema version dispatch
    Read schemaVersion, log warning on unknown

[ ] Step 6 — Router placeholder routes
    /review, /review/:type, /party/:partyKey

[ ] Step 7 — Dashboard click handlers (placeholders)
    Cards become navigable; if details absent, show notice

[ ] Step 8 — Documentation
    docs/api-contract.md schema 1.1 section
```

After Step 4, the bundled baseline carries `details` so UI development
can work without a live API.

After Steps 5-7, Dashboard cards become clickable but routes show
"Not implemented in v2.0" pages — the runway is in place.

After Step 8, v2.0 is ready for external review.

Then v2.1 begins: **actual Review Queue rendering** (5 category list
views, currency filter, default sort, CSV export). Pure UI work, with
all the data already flowing through the contract.

---

## Reviewer focus areas

If you have time to review only a subset:

1. **`partyKey.ts`** — algorithm correctness, especially Korean handling
2. **`previewTransform.ts` lines containing `buildReviewItems` and `buildStatementLinks`** —
   these touch the most domain logic; everything else is mechanical
   projection
3. **The 7 vs 95 NOT_IN_ERP_EXTRACT decision** — confirm this is what
   we want for UX (summary card → row-level drill-down expansion)
4. **`schemaVersion` always-1.1 emission** — confirm this is acceptable
   even when calling code expects 1.0
