# Phase 2 v2.2 Step 1-2 Absorption Notes

Date: 2026-05-04

## Result

v2.2 Party Detail selector contract and implementation are absorbed.

```text
PASS: 48 FAIL: 0
```

## Added

- `aging-app/src/selectors/partyDetail.ts`
- `tools/test-party-detail-selector.mjs`

## Updated

- `aging-app/src/parsing-engine/types.ts`

## Selector Contract

`selectPartyDetail(partyKey, result)` is the single source of party-scoped
projection for v2.2 UI.

It returns:

- party identity and display name
- department summary
- status
- per-currency totals
- six summary counts
- party transactions
- party statement links
- party review items
- duplicate groups touching the party

The selector is pure and deterministic. It performs no I/O and has no
time-dependent behavior.

## Important Decisions Preserved

- `partyKey` is routing identity only.
- `partyName` is display authority.
- USD/CAD are never summed.
- `notInErpExtract` is strict review-item count, not transaction count and not broad statement-link count.
- Unknown party and schema 1.0 payloads return a well-formed empty result.
- Statement-only parties are supported.

## Verification

The absorbed test runs with Node 24 directly:

```powershell
node .\tools\test-party-detail-selector.mjs
```

Verified:

- sample party `skymaster-express`: 86 transactions / 20 statement links / 1 review item
- global transaction reconciliation: 1230
- global statement link reconciliation: 439
- global review item reconciliation: 234
- strict NOT_IN_ERP reconciliation: 7
- warning reconciliation: 97
- statement-only party path
- unknown party path
- schema 1.0 graceful empty path
- no party display name collapse to kebab-case partyKey

## Review Note

The incoming package used a 48-assertion test with `tsx`. The absorbed
mainline test keeps the same assertion count and the same critical
coverage, but avoids the extra runtime dependency by relying on Node 24's
TypeScript module support.

## Next

Proceed to v2.2 Step 4:

- PartyDetailPage header
- status badge
- per-currency headline metrics
- six summary cards
