# Phase 2 v2.2 — Step 6 Complete

**Status:** Ready for review
**Date:** 2026-05-04
**Predecessor:** v2.2 Step 5 absorbed
**Spec:** `phase2-v2.2-party-detail-spec.md` (frozen 2026-05-04)
**Step:** 6 — Transactions tab content

---

## Summary

The Transactions tab now renders the party's transactions as a real
table with full filter / sort / row expand UX. Replaces the Step 5
placeholder.

This is the first tab to ship real content. Establishes the patterns
(filter bar shape, table layout, trace panel, footer totals) that
Steps 7-9 will follow.

---

## Files changed

| Step | Path | Lines | Change |
|---|---|---:|---|
| 6 | `aging-app/src/components/party/PartyDetailPage.tsx` | +480 (now 944 total) | TransactionsTab component + filter bar + sort logic + reference picker + DirectionBadge + AgingPill + TransactionTracePanel + TraceField helper |
| 6 | `tools/test-party-detail-page-step6.mjs` | new (~280 lines) | 44-assertion regression suite |

No other files touched.

---

## What this step ships

### TransactionsTab component

Spec §"Tabs" → "Transactions" implementation:

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Currency] [Direction] [Search                       ] [Sort]        │
├──────────────────────────────────────────────────────────────────────┤
│ Type   Direction    Currency   Amount      Aging    Date    Ref Src  │
├──────────────────────────────────────────────────────────────────────┤
│ INV    receivable   USD        4,600.00    113d 90+ 2026-01 PEIN…    │
│ ▾ (expanded row: trace panel with all fields, references, flags)     │
│ INV    receivable   USD        4,450.00    113d 90+ 2026-01 PEIN…    │
│ AP     payable      CAD       -33,968.76    16d 0-30 2026-04 V123    │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ 86 of 86 transactions               USD 12,250.00   CAD 8,460.00     │
└──────────────────────────────────────────────────────────────────────┘
```

### Filter bar

4 controls per spec:

- **Currency:** All / USD / CAD
- **Direction:** All / Receivable / Payable / Settled
- **Search:** searches `ourRefNo`, `invoiceNo`, `crdrNo`,
  `vendorInvoiceNo`, `blNo`, `sourceFile`. (Not partyName — it's in
  the header above.)
- **Sort:** Aging desc (default) / Amount desc / Amount asc / Date desc / Date asc / Source row

### Sort modes

| Mode | Logic |
|---|---|
| Aging desc (default) | aging desc, then `Math.abs(amount)` desc as tie-break |
| Amount desc / asc | by `Math.abs(signedBalance)` |
| Date desc / asc | by `invoiceDate` (string compare on ISO YYYY-MM-DD) |
| Source row | by sourceFile then sourceRow asc |

### Reference picker (sourceType-aware)

Avoids the v2.0 P1 #4 mistake of conflating reference fields:

- INVOICE → `invoiceNo` (PEIN…) before falling back to `ourRefNo`
- CRDR → `crdrNo` (PECDR…) before `ourRefNo`
- AP → `vendorInvoiceNo` before `ourRefNo`

### Direction + Aging cells

- **Direction:** colored pill (`receivable` / `payable` / `settled`).
- **Aging:** number of days + bucket label, color-coded by bucket. Settled
  rows render aging as `—` since aging is not actionable for settled.

### Trace panel (inline, on click)

Click any row to expand a trace panel underneath. Fields shown:

```
Source File   |  Source Sheet  |  Source Row
Transaction ID|  Party Name    |  Party Key
Department    |  Aging Basis   |  Raw Balance
Signed        |  Zero Balance  |  Flags

REFERENCES (only present ones)
ourRefNo  |  invoiceNo  |  crdrNo  |  vendorInvoiceNo  |  vendorName  |  blNo
```

`rawRow` is NEVER shown (spec §1.7 honored).

### Footer

`X of Y transactions` count + per-currency totals. **USD and CAD never
summed** (spec D5). Settled rows excluded from totals (Dashboard parity).

### Keyboard accessibility

- Row is `tabIndex={0}`, focusable
- Enter / Space → toggle expand
- Esc on expanded row → collapse
- `aria-expanded` reflects state

---

## Verification — 44/44 PASS

```
=== A. Sort logic ===                                 3 PASS
=== B. Filter correctness ===                         5 PASS
=== C. Reference picker ===                           5 PASS
=== D. Per-currency footer totals ===                 3 PASS
=== E. Reference fields (v2.0 P1 #4 invariant) ===    6 PASS
=== F. Trace panel completeness ===                   7 PASS
=== G. Keyboard accessibility ===                     5 PASS
=== H. Statement-only special copy preserved ===      1 PASS
=== I. Filter bar shape ===                           4 PASS
=== J. Default sort spec ===                          2 PASS
=== K. Default sort on real data ===                  2 PASS

PASS: 44    FAIL: 0
```

### Headline checks

- **Sort:** aging desc with amount-abs tiebreak verified on SKYMASTER (86 tx)
- **Filter:** USD + CAD = total (no leak); 4 search fields covered
- **Reference picker:** spec routes per sourceType verified
- **Trace fields:** all 12 spec-required fields present, rawRow absent
- **v2.0 P1 #4 still holds:** code never references `t.refNo` — uses split fields exclusively

---

## A spec observation worth noting

While testing, the default sort (`aging desc`) produced a top-10 of all
**settled** rows for SKYMASTER (settled CRDR rows aged 102-129 days are
older than non-settled rows that max out at 64 days).

This is **spec-compliant behavior** but worth a UX call:

- A user opening Transactions sees old settled rows first, not the
  actionable receivables/payables.
- The fix is one filter click: Direction → Receivable+Payable. (Spec
  §"Tabs" → Transactions allows this.)

**I am NOT changing the default in this Step.** Spec D14 says spec is
frozen, and the workaround is one click. Worth noting for v2.3 if real
users find it confusing.

If you want to reconsider the default sort, that's a spec edit, not a
Step 6 fix.

---

## Acceptance criteria status

| # | Criterion | Status |
|---|---|---|
| 4 | Transactions tab count matches selector | ✅ DONE |
| 8 | Row expansion shows source file + row | ✅ DONE (Transactions tab) |

Two acceptance criteria advanced this round.

---

## Style additions for `global.css`

```css
/* Transactions tab specifics */
.party-tab-content { padding: 0; }

.party-tab-filter-bar {
  display: flex;
  gap: 12px;
  align-items: end;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--color-surface-alt, #f8fafc);
  border-radius: 6px;
}
.filter-field { display: flex; flex-direction: column; gap: 4px; }
.filter-field-grow { flex: 1; }
.filter-label {
  font-size: 0.7em;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.tx-table { width: 100%; border-collapse: collapse; }
.tx-table th, .tx-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border-soft, #f0f0f0);
  text-align: left;
  font-size: 0.9em;
}
.tx-table th {
  font-size: 0.7em;
  letter-spacing: 0.05em;
  opacity: 0.7;
  font-weight: 600;
  text-transform: uppercase;
}
.tx-col-amount { text-align: right; font-variant-numeric: tabular-nums; }
.tx-col-aging  { white-space: nowrap; }
.tx-col-ref    { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }

.tx-row { cursor: pointer; }
.tx-row:hover { background: var(--color-surface-hover, #fafafa); }
.tx-row-expanded { background: var(--color-surface-alt, #f8fafc); }
.tx-row:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
}

.tx-trace-row td { padding: 0; background: var(--color-surface-alt, #f8fafc); }

/* Pills */
.pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 500;
}
.pill-receivable { background: #dcfce7; color: #166534; }
.pill-payable    { background: #fee2e2; color: #991b1b; }
.pill-settled    { background: #f3f4f6; color: #555; }

/* Aging cells */
.aging-cell {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}
.aging-days { font-weight: 600; font-variant-numeric: tabular-nums; }
.aging-bucket { font-size: 0.7em; }
.aging-90plus .aging-days { color: #dc2626; }
.aging-61-90 .aging-days  { color: #d97706; }
.aging-31-60 .aging-days  { color: #ca8a04; }
.aging-0-30 .aging-days   { color: var(--color-text-muted, #555); }

/* Trace panel */
.trace-panel { padding: 16px; }
.trace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px 24px;
}
.trace-field-label {
  font-size: 0.7em;
  letter-spacing: 0.05em;
  opacity: 0.6;
  text-transform: uppercase;
}
.trace-field-value {
  margin-top: 2px;
  font-size: 0.9em;
}
.trace-refs {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed var(--color-border, #e5e7eb);
}
.trace-section-label {
  font-size: 0.7em;
  font-weight: 600;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-bottom: 8px;
}

/* Tab footer */
.party-tab-footer {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  margin-top: 8px;
}
.party-tab-totals { display: flex; gap: 16px; }

/* Misc */
.mono { font-family: ui-monospace, monospace; }
.muted-small { opacity: 0.6; font-size: 0.85em; }
.amount-pos { color: #166534; }
.amount-neg { color: #dc2626; }
.amount-zero { color: var(--color-text-muted, #555); }
```

---

## Reviewer focus areas

If reviewer wants to spot-check this round:

1. **Reference picker (`pickReference`)** — verifies sourceType-specific
   choice. Would be the most likely place to reintroduce a v2.0-style
   reference-field collapse.

2. **Sort logic (`sortTransactions`)** — pure function, six modes.
   Default is composite (aging desc, amount-abs desc tiebreak).

3. **Footer totals derivation** — must NEVER sum across currencies (D5)
   and must exclude settled (Dashboard parity).

4. **Trace panel (`TransactionTracePanel`)** — spec-required fields all
   present, `rawRow` deliberately absent.

5. **The settled-rows-dominating-default-sort observation** — spec
   compliant, documented above. Reviewer's call whether to reconsider
   spec.

---

## Methodology note — invariant net continues to grow

Combined v2.2 invariants now:

| Step | Assertions |
|------|----:|
| Step 3 (selector) | 48 |
| Step 4 (page) | 105 |
| Step 5 (tabs) | 33 |
| **Step 6 (Transactions)** | **44** |
| **Total** | **230 (all PASS)** |

By Step 13 (browser hands-on), aiming for ~300+ assertions across
selector + page + each tab + browser DOM. Audit-grade discipline.

---

## Next steps

```
✅ Step 1-2 + 3 — Selector + invariants
✅ Step 4 — Header + 6 cards
✅ Step 5 — Tab scaffolding
✅ Step 6 — Transactions tab (this round)
[ ] Step 7 — Statements tab (LOCAL/AGENT rows + ERP match cell)
[ ] Step 8 — Reviews tab (5 categories, category filter)
[ ] Step 9 — Duplicates tab (group rows + member expand)
[ ] Step 10 — Trace panel unification across tabs
[ ] Step 11 — CSV export per tab
[ ] Step 12 — Dashboard Top Parties links
[ ] Step 13 — Browser verification
```

Step 7 (Statements) is the next biggest piece — it has more match-type
states (10) than any other tab.
