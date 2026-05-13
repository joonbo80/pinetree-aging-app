# AGING APP Phase 2 v2.2 Party Detail Spec

Status: Frozen for implementation  
Date: 2026-05-04  
Depends on: v2.1.1 party identity absorption (`PASS: 23 FAIL: 0`)

## North Star

Party Detail is the audit-grade single-party verification surface.

Given a `partyKey`, an accountant must be able to see every claim the
system makes about that counterparty and trace every number back to
source rows.

If Review Queue answers "why is this row here?", Party Detail answers
"what does the system know about this counterparty, and is it
consistent?"

## Scope

Included in v2.2:

- `/party/:partyKey` route.
- Party header with display name, route key, department summary, and status.
- Headline metrics per currency without USD/CAD mixing.
- Six compact summary cards.
- Tabs:
  - Transactions
  - Statements
  - Reviews
  - Duplicates
- Inline trace expansion, reusing the v2.1 audit pattern.
- Per-tab CSV export with UTF-8 BOM.
- Unknown party fallback.
- Schema 1.0 details-unavailable fallback.

Excluded:

- Memo, settlement, dispatch, payment editing.
- Alias merge or party rename workflows.
- SharePoint persistence.
- Teams / Entra SSO.
- Cross-period comparisons.
- Party browse/search index.
- Server pagination or virtualization.

## Data Selectors

For a given `partyKey`, selectors read only `result.details`.

```ts
transactions = details.transactions.filter(t => t.partyKey === partyKey)
statementLinks = details.statementLinks.filter(l => l.partyKey === partyKey)
reviewItems = details.reviewItems.filter(r => r.partyKey === partyKey)
duplicateGroups = details.duplicateGroups.filter(group =>
  group.transactionIds.some(id => transactionsById.get(id)?.partyKey === partyKey)
)
```

These selectors are the single source for Party Detail.

## Party Name Authority

`partyKey` is for routing. It is not display copy.

Header `partyName` is resolved in this order:

1. Most frequent `partyName` among party transactions.
2. First statement link `partyName`.
3. First review item `partyName`.
4. Humanized `partyKey` as last resort only.

If variants exist, v2.2 may show a small aliases footnote. It must not
auto-merge or mutate aliases.

## Header

Header shows:

- Party name.
- Party key in monospace.
- Department:
  - majority department if one department is at least 60% of transactions.
  - otherwise `Mixed` plus compact breakdown.
- Status:
  - `Clean` when zero review items and zero duplicate groups.
  - `Has issues` when any review items or duplicate groups exist.
  - `Statement only` when statement links exist but ERP transactions are zero.

Headline metrics:

- Net balance per currency.
- 90+ count per currency.
- Status summary.

USD and CAD are never summed together.

## Summary Cards

Six cards:

| Card | Source | Click behavior |
| --- | --- | --- |
| Total Transactions | party transaction count | Opens Transactions tab |
| Statement Rows | party statement link count | Opens Statements tab |
| ERP Matched | statement links with `matchedTransactionId !== null` | Opens Statements tab with matched filter |
| Not in ERP Extract | strict party review items where `category === "NOT_IN_ERP_EXTRACT"` | Opens Reviews tab filtered to that category |
| Duplicate Flags | duplicate groups touching this party | Opens Duplicates tab |
| Warnings | party review items where `category === "WARNINGS"` | Opens Reviews tab filtered to warnings |

Cards are navigation controls and must be keyboard accessible.

## Tabs

Default active tab: Transactions.

### Transactions

Rows: party transactions.

Columns:

- Type
- Direction
- Currency
- Amount
- Aging
- Date (`invoiceDate ?? postDate`)
- Reference
- Source

Default sort: aging desc, amount desc.

### Statements

Rows: party statement links.

Columns:

- Source (`LOCAL` / `AGENT`)
- Currency
- Statement balance
- Reference
- Match type
- ERP match
- Source statement row

Default sort: match type priority, then absolute statement balance desc.

The ERP match cell may switch to Transactions tab and focus the matched
row using local React state. No query string is required in v2.2.

### Reviews

Rows: party review items across all categories.

No deduplication. A transaction can appear in multiple categories.

Default filter: all categories.

### Duplicates

Rows: duplicate groups touching this party.

Group rows expand to show member transaction ids and trace rows.

If zero groups, show a neutral empty state. Do not hide the tab.

## Trace Expansion

Every tab uses the same trace panel pattern as v2.1.

Trace panel shows:

- Source file.
- Source sheet or `-`.
- Source row.
- Transaction ID or `-`.
- Party key.
- Party name.
- Reference fields.
- Reason / match / flags.
- Statement raw fields (`referenceStatus`, `differenceType`) when available.

`rawRow` is never shown.

## CSV Export

Exports the active tab's filtered rows.

File name:

```text
aging-party-{partyKey}-{tab}-{YYYYMMDD-HHmm}.csv
```

CSV uses UTF-8 BOM for Excel compatibility.

Columns match the visible tab plus trace columns. Do not use one giant
superset across all tabs in v2.2.

## URL State

v2.2 keeps URL state simple:

- Route owns `partyKey`.
- Active tab is local React state.
- Filters and sort are local React state.
- Focus after cross-tab navigation is local React state.

Bookmarkable tab/filter URLs are deferred to v2.3 if users request them.

## Empty States

Unknown party:

- Show partyKey.
- Message: `No data for this party.`
- Actions:
  - Back to Dashboard.
  - Upload Preview.

Statement-only party:

- Status badge: `Statement only`.
- Transactions tab empty state:
  - `No ERP transactions found. This party only appears in statement files.`
- Other tabs render normally.

## Performance

Current data is small enough for flat client rendering.

If any single party tab exceeds 1,000 rows, log a development warning
and revisit pagination or virtualization later.

## Frozen Decisions

| ID | Decision |
| --- | --- |
| D1 | Default tab is Transactions, not context-aware |
| D2 | Party name authority follows transactions -> statements -> reviews -> humanized key |
| D3 | Department is majority by 60%, otherwise Mixed |
| D4 | Status stays Clean / Has issues / Statement only |
| D5 | Net balance is per currency; USD/CAD never summed |
| D6 | Statement-only parties render normally with badge and empty Transactions tab |
| D7 | Cross-tab focus uses local state, not query string |
| D8 | CSV columns match visible tab plus trace columns |
| D9 | Duplicates tab is group-based, consistent with v2.1 |
| D10 | Unknown party uses neutral empty language |
| D11 | Party links come from Review Queue and Dashboard Top Parties in v2.2 |
| D12 | Trace panel is reused and parameterized |
| D13 | Flat render; revisit if a party tab exceeds 1,000 rows |
| D14 | This spec is frozen before code |

## Acceptance Criteria

1. `/party/:partyKey` opens from Review Queue party links.
2. Header shows human-readable `partyName`, not kebab-case `partyKey`.
3. Summary cards reconcile to selector counts.
4. Transactions tab count matches party transaction selector.
5. Statements tab shows linked and unlinked statement rows.
6. Reviews tab dedupes nothing.
7. Duplicates tab shows groups touching the party.
8. Row expansion on every tab shows source file and source row.
9. CSV export includes trace columns and UTF-8 BOM.
10. Unknown party never throws.
11. Schema 1.0 payload shows details-unavailable notice.
12. No display surface collapses `partyName` to `partyKey` unless it is the last-resort unknown fallback.

## Implementation Order

1. Add selector types.
2. Implement `selectPartyDetail(partyKey, result)`.
3. Add selector invariant test.
4. Build PartyDetailPage header and summary cards.
5. Add tab scaffolding.
6. Implement Transactions tab.
7. Implement Statements tab.
8. Implement Reviews tab.
9. Implement Duplicates tab.
10. Reuse trace panel.
11. Add CSV export per tab.
12. Wire Dashboard Top Parties links.
13. Run TypeScript, selector, baseline, and browser checks.
