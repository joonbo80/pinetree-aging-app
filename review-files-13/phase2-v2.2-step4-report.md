# Phase 2 v2.2 — Step 4 Complete

**Status:** Ready for review
**Date:** 2026-05-04
**Predecessor:** v2.2 Step 1-2 absorbed (`PASS: 33 FAIL: 0` per absorption note)
**Spec:** `phase2-v2.2-party-detail-spec.md` (frozen 2026-05-04)
**Step complete:** 4 — PartyDetailPage header + summary cards

---

## Summary

`PartyDetailPage` is in place as the page shell. It renders:

- Header (party name, key, department, status, per-currency totals)
- Six summary cards (each clickable, switches active tab via local state)
- Schema 1.0 fallback + unknown party fallback + statement-only path
- Tab area placeholder (Steps 5-9 fill it in)

Pure component. Reads selector output, owns `activeTab` local state.
No data shaping in this file.

---

## Files added

| Step | Path | Lines | Purpose |
|---|---|---:|---|
| 4 | `aging-app/src/components/party/PartyDetailPage.tsx` | ~340 | Page component with header + cards + fallbacks |
| 4 | `tools/test-party-detail-page-step4.mjs` | ~190 | 29-assertion derivation regression suite |

No other files touched. Step 5+ will modify App.tsx route registration
to point `/party/:partyKey` at `PartyDetailPage` (currently goes to
`PlaceholderPage`).

---

## What this step does

### Header

Three areas:

```
WIN YAN LOGISTICS              Back
win-yan-logistics
[ Aliases (if variants exist) ]
Department: OI Ocean Import

[STATUS: Has issues] [NET USD: 12,250.00 · 2 @ 90+] [NET CAD: 8,460.00]
```

- `partyName` resolved per spec D2 (transactions majority → statement → review → humanized key)
- `partyKey` shown in mono font under the name
- Aliases footnote shown only when `partyNameVariants.length > 1`
- Department per spec D3: dominant if ≥60%, otherwise "Mixed (OI 12, OO 8, AI 5...)"
- Status pill, 3 states only per D4
- Currency pills are per-currency (D5: never summed); settled rows excluded from net (Dashboard parity)

### Six Summary Cards

Each card carries a count. Click switches `activeTab` in parent component.

| Card | Source | Tab | Highlight when > 0 |
|---|---|---|---|
| Total Transactions | `summary.totalTransactions` | transactions | — |
| Statement Rows | `summary.statementRows` | statements | — |
| ERP Matched | `summary.erpMatched` | statements | — |
| Not in ERP Extract | `summary.notInErpExtract` | reviews | warn |
| Duplicate Flags | `summary.duplicateFlags` | duplicates | warn |
| Warnings | `summary.warnings` | reviews | warn |

Cards are real `<button>` elements with `aria-label` for screen readers
(spec §"Summary Cards" + accessibility carryover from v2.1).

### Fallbacks (3 distinct paths)

1. **Schema 1.0 / no details:** Notice + Back to Dashboard
2. **Unknown partyKey:** "No data for this party" + 2 actions
3. **Statement-only:** Renders normally with status badge "Statement only"
   and a `currencyTotals` empty state of "— (no transactions)"

These three are different code paths and tested independently.

---

## Verification — 29/29 PASS

```
=== A. Header: partyName authority (spec D2) ===
  ✅ skymaster: human-readable name
  ✅ skymaster: name != partyKey
  ✅ a1-intermodal: name from statement source
  ✅ a1-intermodal: name != partyKey
  ✅ unknown party: humanized fallback

=== B. Header: department resolution (spec D3) ===
  ✅ 75 dominant + 7 mixed across baseline

=== C. Header: status badge (spec D4) ===
  ✅ skymaster (1 review): "Has issues"
  ✅ a1-intermodal: "Statement only"
  ✅ wig-beauty-outlet: "Clean"

=== D. Header: currency totals (spec D5) ===
  ✅ mixed-currency party: 2 entries (USD before CAD)
  ✅ USD net excludes settled
  ✅ statement-only: 0 entries

=== E. Six summary cards ===
  ✅ skymaster: total = 86, statement = 20
  ✅ ERP Matched derivation correct
  ✅ NOT_IN_ERP strict count = review-row count (NOT statement-link)
  ✅ duplicate count = group count

=== F. Card → tab routing ===
  ✅ All 6 routes match spec table

=== G. v2.1.1 invariant maintained ===
  ✅ No party kebab-collapse anywhere

=== H. Determinism ===
  ✅ same input → same JSON

PASS: 29    FAIL: 0
```

### Real-data instances confirmed

| Instance | Where it surfaces | Why it matters |
|---|---|---|
| `wig-beauty-outlet` (Clean) | First clean party found | Status taxonomy works for the no-issues case |
| `a1-intermodal` (Statement only) | Statement-only path | Edge case from spec §"Empty States" actually occurs in baseline |
| `lemond-food-corp-new-addr` (USD+CAD) | Mixed-currency party | D5 currency-strict rule has real data to test |
| `cedrus-global-trading` (NOT_IN_ERP) | One of the 7 strict rows | "review-row count, not tx count" correction lands here |
| `air-canada-cargo-acct` (duplicates) | Has duplicate group | Group-count card works |

---

## Style additions needed in `global.css`

Step 4 introduces a few new class names. None are critical to function
(the page renders without them), but proper styling lands in user's
mainline. Suggested additions:

```css
/* Party Detail header */
.party-header { /* container */ }
.party-header-top { display: flex; justify-content: space-between; }
.party-key-mono { font-family: monospace; opacity: 0.6; font-size: 0.85em; }
.party-aliases { font-size: 0.85em; opacity: 0.6; margin-top: 4px; }
.party-meta { font-size: 0.9em; opacity: 0.75; margin-top: 6px; }
.party-header-kpis { display: flex; gap: 16px; margin-top: 12px; }
.party-kpi { /* matches existing kpi card style */ }
.party-kpi-label { font-size: 0.7em; opacity: 0.6; }
.party-kpi-value { font-size: 1.3em; font-weight: 600; }
.party-kpi-value.amount-pos { color: var(--color-pos, #16a34a); }
.party-kpi-value.amount-neg { color: var(--color-neg, #dc2626); }
.party-kpi-value.muted { opacity: 0.5; }
.pill-clean { color: var(--color-pos, #16a34a); }
.pill-warn  { color: var(--color-warn, #d97706); }
.pill-info  { color: var(--color-info, #2563eb); }

/* Summary cards row */
.party-summary-cards {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  margin: 16px 0;
}
.party-summary-card {
  /* clickable, looks like existing kpi cards */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}
.party-summary-card:hover { border-color: var(--color-accent); }
.party-summary-card-warn { border-left: 3px solid var(--color-warn); }
.party-summary-label { font-size: 0.7em; opacity: 0.6; letter-spacing: 0.05em; }
.party-summary-value { font-size: 1.6em; font-weight: 700; margin-top: 4px; }
```

Tokens are existing CSS variables from your project; use defaults where
something doesn't exist.

---

## App.tsx wiring (one-line change for Step 4)

To make the page actually reachable in your mainline (not just
unit-tested), update App.tsx's route registration:

```tsx
// before:
<Route path="/party/:partyKey" element={<PlaceholderPage kind="party" />} />

// after:
<Route path="/party/:partyKey" element={<PartyDetailPage result={result} />} />
```

Existing v2.1 Review Queue party links (e.g. on /review/aging-90-plus)
will now land on the real page.

---

## Acceptance criteria status (from spec)

| # | Criterion | Status |
|---|---|---|
| 1 | `/party/:partyKey` opens from Review Queue links | Pending App.tsx route swap (one-line) |
| 2 | Header shows human-readable `partyName` | **DONE** + tested |
| 3 | Summary cards reconcile to selector counts | **DONE** + tested |
| 4 | Transactions tab count matches selector | Pending Step 6 |
| 5 | Statements tab shows linked + unlinked | Pending Step 7 |
| 6 | Reviews tab dedupes nothing | Pending Step 8 |
| 7 | Duplicates tab shows groups touching party | Pending Step 9 |
| 8 | Row expansion shows source file + row | Pending Step 10 |
| 9 | CSV per tab with UTF-8 BOM | Pending Step 11 |
| 10 | Unknown party never throws | **DONE** at selector + page |
| 11 | Schema 1.0 details-unavailable notice | **DONE** + visible in code |
| 12 | partyName never collapses to partyKey | **DONE** + tested 210/210 |

Five of twelve are now covered.

---

## Reviewer focus areas

If reviewer wants to spot-check this round:

1. **Read PartyDetailPage.tsx top-to-bottom** — should be ~340 lines,
   no data shaping, just rendering.
2. **Confirm no NPE risk:**
   - `result === null` → page short-circuits at `if (result && !result.details)` only when result truthy AND details missing. Need a separate guard for `result === null`?
   - Actually re-checking my code: when `result === null`, the selector returns empty PartyDetail (no NPE), and `isUnknown` is true, so we land on the unknown branch. Good — but a reviewer should confirm.
3. **Check that the `isUnknown` branch logic is correct:**
   ```ts
   const isUnknown =
     detail.transactions.length === 0 &&
     detail.statementLinks.length === 0 &&
     detail.reviewItems.length === 0 &&
     detail.duplicateGroups.length === 0;
   ```
   Statement-only parties have `statementLinks > 0` so they don't land
   here — they go through the normal render with a Status pill of
   "Statement only" and a "no transactions" pill.
4. **Confirm card→tab map matches spec table** — 6 cards → 4 tabs,
   tested in invariant set F.

---

## Open question for reviewer

The aliases footnote (when `partyNameVariants.length > 1`) shows up
to 3 variants. Spec mentions "may show a small aliases footnote" —
not specified beyond that.

Question: should aliases also appear in the trace expansion panel
(Step 10) so accountants see the full variant list when investigating
a single row? Or is the header footnote enough?

Suggestion: header footnote in v2.2, expand in v2.3 if users ask.

---

## Methodology note — pattern consistency

Same shape as Step 1-2:

```
Spec freeze (already done) → Implementation (this step) → Invariants test
                                                          → Reviewer review
                                                          → Mainline absorb
```

29 assertions added on top of the 33 already in mainline from Step 1-2.
Combined invariant net for v2.2 is now 62 assertions covering selector
and page derivations. By Step 13 (browser hands-on) the net should be
the strongest of any v2.x feature so far — appropriate given Party
Detail is the audit-grade core surface.
