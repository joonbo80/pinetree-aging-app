# Phase 2 v2.2 — Step 1-2 Complete

**Status:** Ready for review
**Date:** 2026-05-04
**Predecessor:** v2.1.1 absorbed (party identity invariants in place)
**Spec:** `phase2-v2.2-party-detail-spec.md` (frozen 2026-05-04)
**Steps complete:** 1 (Selector type contract) and 2 (selector implementation) — Step 3 (selector invariant test) also done as part of verification.

---

## Summary

Two steps from the v2.2 frozen spec implementation order are complete.
The selector — `selectPartyDetail(partyKey, result)` — is now the single
source of party-scoped projection. UI components for the Party Detail
page can build directly on top of this selector with no further data
shaping needed.

Pure function. No side effects. Same input → same JSON output verified.

---

## Files added

| Step | Path | Lines | Purpose |
|---|---|---:|---|
| 1 | `aging-app/src/parsing-engine/types.ts` | +75 (appended) | `PartyDetail`, `PartyStatus`, `PartyDepartmentSummary`, `PartyCurrencyTotal`, `PartySummaryCounts` types |
| 2 | `aging-app/src/selectors/partyDetail.ts` | 270 (new) | `selectPartyDetail()` pure function |
| 3 | `tools/test-party-detail-selector.mjs` | 250 (new) | 48-assertion regression suite |

No other files changed. Phase 1 engine, route handlers, baseline
generator, all UI components — all untouched.

---

## Step 1 — Type contract

Five new types appended to `types.ts`:

```ts
export type PartyStatus = 'Clean' | 'Has issues' | 'Statement only';

export interface PartyDepartmentSummary {
  dominant: string | null;          // dept code if >= 60% share, else null
  breakdown: Array<{ department: string | null; count: number }>;
}

export interface PartyCurrencyTotal {
  currency: 'USD' | 'CAD';
  netBalance: number;
  agingNinetyPlusCount: number;
}

export interface PartySummaryCounts {
  totalTransactions: number;
  statementRows: number;
  erpMatched: number;
  notInErpExtract: number;          // strict — review-row count, NOT tx count
  duplicateFlags: number;
  warnings: number;
}

export interface PartyDetail {
  partyKey: string;
  partyName: string;
  partyNameVariants: string[];
  department: PartyDepartmentSummary;
  status: PartyStatus;
  currencyTotals: PartyCurrencyTotal[];   // 0..2 entries; USD before CAD; never summed
  summary: PartySummaryCounts;
  transactions: PreviewTransaction[];
  statementLinks: StatementLink[];
  reviewItems: ReviewItem[];
  duplicateGroups: DuplicateGroupDetail[];
}
```

User's two corrections to the draft spec are encoded directly:

- `notInErpExtract` field comment: "strict — review-row count, NOT tx count"
- No URL state for cross-tab focus — `PartyDetail` carries no focus state; that's UI-only React state per spec D7

TypeScript check: PASS.

---

## Step 2 — Selector implementation

Pure function, ~270 lines. Single export: `selectPartyDetail(partyKey, result)`.

Key design decisions and why each one matters:

### A. Helper function order matches spec resolution order

`resolvePartyName` follows spec §"Party Name Authority" precisely:

```ts
1. pickMajorityName(transactions.partyName)   // most frequent in party tx
2. statementLinks[0].partyName                 // first statement source
3. reviewItems[0].partyName                    // first review item source
4. humanizeKey(partyKey)                       // "win-yan-logistics" → "Win Yan Logistics"
```

The selector exposes `partyNameVariants` so UI can render a footnote
when sources disagree.

### B. Department resolution implements D3 (60% threshold)

```ts
const dominant = share >= 0.6 && top.department !== null ? top.department : null;
```

If share < 60%, `dominant` is null and `breakdown` carries the per-dept
counts so UI can render "Mixed (OI 12, OO 8, AI 5)" or similar.

### C. Currency totals strictly per-currency (D5)

```ts
for (const cur of ['USD', 'CAD'] as const) {  // stable order, never combined
  if (byCcy.has(cur)) result.push({ currency: cur, ... });
}
```

Cannot accidentally sum USD and CAD — they go into different Map keys
and emerge in stable USD-then-CAD order.

### D. NOT_IN_ERP_EXTRACT count comes from REVIEW ITEMS (per user correction)

```ts
notInErpExtract: reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT').length,
```

Not from transactions. Not from statement links with that matchType.
This is the strict 7-row-set count that agrees with Dashboard.

### E. Status badge order: "Statement only" wins

```ts
if (transactions.length === 0 && statementLinks.length > 0) return 'Statement only';
if (reviewItems.length > 0 || duplicateGroups.length > 0) return 'Has issues';
return 'Clean';
```

A statement-only party with issues still shows "Statement only" — that
diagnostic signal is more useful than "Has issues" alone.

### F. Pure function discipline

- No I/O. No `Date.now()`. No external state.
- All inputs frozen at function entry; outputs are fresh objects
  containing references to existing immutable arrays from `result.details`.
- Determinism verified by JSON equality on two consecutive calls.

---

## Verification — 48 invariants PASS

Hand-asserted regression suite covers nine invariant sets:

```
=== A. Output shape on a sample party ===                     14 PASS
=== B. Filter correctness (no leakage) ===                     4 PASS
=== C. Global reconciliation ===                               6 PASS
=== D. Sample heavy party (skymaster-express) ===              4 PASS
=== E. Statement-only party (a1-intermodal) ===                4 PASS
=== F. Unknown party graceful empty ===                        8 PASS
=== G. Schema 1.0 (no details) graceful empty ===              2 PASS
=== H. Currency rules (USD/CAD never summed) ===               4 PASS
=== I. partyName never collapses to partyKey ===               1 PASS
=== J. Determinism ===                                         1 PASS

PASS: 48    FAIL: 0
```

### Headline results

| Reconciliation | Per-party sum | Global | Match |
|---|---:|---:|:---:|
| Transactions | 1,230 | 1,230 | ✅ |
| Statement links | 439 | 439 | ✅ |
| Review items (with partyKey) | 234 | 234 | ✅ |
| **NOT_IN_ERP_EXTRACT** | **7** | **7 (Dashboard)** | **✅** |
| WARNINGS | 97 | 97 | ✅ |

### Sample party — SKYMASTER EXPRESS

| Field | Value |
|---|---|
| Transactions | 86 |
| Statement links | 20 |
| Review items | 1 |
| Display name | "SKYMASTER EXPRESS" (not "skymaster-express") |
| Currency totals | USD + CAD (separate, never summed) |

### Statement-only party — a1-intermodal

Discovered during global reconciliation. Has statement links, zero
transactions. Selector correctly:

- `status === 'Statement only'`
- `currencyTotals.length === 0` (no tx, so no balance to total)
- `partyName` resolved from statement source (not the kebab key)

### Unknown party

`selectPartyDetail('this-party-does-not-exist', result)` returns:

```js
{
  partyKey: 'this-party-does-not-exist',
  partyName: 'This Party Does Not Exist',     // humanized fallback
  status: 'Clean',
  transactions: [], statementLinks: [], reviewItems: [], duplicateGroups: [],
  summary: { totalTransactions: 0, ... }     // all zeros
}
```

Never throws. UI uses the empty arrays + identifying partyKey to render
the empty state.

### Schema 1.0 fallback

`selectPartyDetail('skymaster-express', { ...result, details: undefined })`
returns the same empty shape. `selectPartyDetail('x', null)` also returns
empty shape. No NPE.

---

## What this enables

After this step, every UI component on the Party Detail page can be
built as a pure function of `PartyDetail` plus local UI state:

```tsx
function PartyDetailPage({ partyKey, result }: Props) {
  const detail = selectPartyDetail(partyKey, result);
  // detail is always well-formed, never throws
  return <>
    <PartyHeader detail={detail} />
    <PartySummaryCards detail={detail} />
    <PartyTabs detail={detail} />
  </>;
}
```

No data shaping in components. No conditional fetching. No
half-loaded states. Just render what the selector says.

This is the same architectural pattern that made v2.1 Review Queue
land in 1 round: pure data layer first, components second.

---

## Acceptance criteria status (from spec)

| # | Criterion | Status |
|---|---|---|
| 1 | `/party/:partyKey` opens from Review Queue | Pending Step 11 (link wiring) |
| 2 | Header shows human-readable `partyName` | Selector provides; pending Step 4 (header component) |
| 3 | Summary cards reconcile to selector counts | **Selector verified**; pending Step 4 |
| 4 | Transactions tab count matches selector | **Selector verified**; pending Step 6 |
| 5 | Statements tab shows linked + unlinked | **Selector preserves both**; pending Step 7 |
| 6 | Reviews tab dedupes nothing | **Selector pre-deduped is impossible — empty by design**; pending Step 8 |
| 7 | Duplicates tab shows groups touching party | **Selector verified**; pending Step 9 |
| 8 | Row expansion shows source file + row | Reuses v2.1 trace panel; pending Step 10 |
| 9 | CSV per tab with UTF-8 BOM | Pending Step 11 |
| 10 | Unknown party never throws | **VERIFIED at selector level** |
| 11 | Schema 1.0 details-unavailable notice | **Selector handles**; UI notice pending Step 4 |
| 12 | partyName never collapses to partyKey | **VERIFIED at selector level** (210/210 parties) |

Three of the twelve criteria are already provably enforced at the
selector layer. The other nine all become "render what the selector
gives you" in subsequent steps.

---

## Next steps (per frozen spec implementation order)

```
✅ Step 1 — Selector types
✅ Step 2 — Selector implementation
✅ Step 3 — Selector invariant test (combined with verification above)
[ ] Step 4 — PartyDetailPage header + summary cards
[ ] Step 5 — Tab scaffolding
[ ] Step 6 — Transactions tab
[ ] Step 7 — Statements tab
[ ] Step 8 — Reviews tab
[ ] Step 9 — Duplicates tab
[ ] Step 10 — Reuse trace panel from v2.1
[ ] Step 11 — Per-tab CSV export
[ ] Step 12 — Wire Dashboard Top Parties links
[ ] Step 13 — TypeScript + selector + browser checks
```

Steps 4-13 are all UI work on top of the now-frozen selector contract.

---

## Reviewer focus areas

If reviewer wants to spot-check this round:

1. **Read `selectPartyDetail()`** — 270 lines, one pure function. Check
   that the spec resolution rules (D2 partyName authority, D3 60%
   department, D5 currency-strict) are correct.
2. **Inspect the test count** — 48 PASS, 0 FAIL on the frozen baseline.
   Particularly the global reconciliation (sum of per-party = global)
   should not be possible to fake.
3. **Run the test yourself** —
   `npx tsx tools/test-party-detail-selector.mjs` —
   it runs in <1 second on any machine with the v2.1.1 baseline.

---

## Methodology note

Spec freeze → selector → test → UI is a stronger order than spec →
UI → glue. By front-loading the data layer with explicit invariants:

- 48 invariants now pin the data contract for any future component
- Components can be checked against the selector without baseline data
- A future change to projection rules has a regression net under it

This is the same pattern that took v2.0 Step 1-3 from "3 review rounds"
to "v2.1 first-round absorb". Locking the data shape pays back across
every subsequent UI step.
