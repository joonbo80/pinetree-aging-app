# Phase 2 v2.1.1 Party Identity Absorption Notes

Date: 2026-05-04

## Result

v2.1.1 party identity invariant is absorbed into the current mainline.

```text
PASS: 23 FAIL: 0
```

## What Changed

`partyKey` remains the normalized routing key.

`partyName` is now preserved as display authority on:

- `PreviewTransaction.partyName`
- `ReviewItem.partyName`
- `StatementLink.partyName`

The UI must not derive human-facing party labels from `partyKey` except
as a last-resort unknown/empty fallback.

## Why

v2.2 Party Detail needs a reliable display name authority. Without
`partyName` on review items and statement links, statement-only parties
or synthetic review rows would collapse to kebab-case party keys.

That would break the accounting trust chain and make Party Detail feel
like an internal debug screen instead of a business review surface.

## Verified Counts

Current schema 1.1 baseline:

```text
transactions: 1230
reviewItems: 234
duplicateGroups: 40
statementLinks: 439
warnings: 97
aging90: 20
notInErpStrict: 7
unknownDepartment: 30
agentLinks: 85
agentMatched: 85
localExact: 162
```

## Invariants Checked

- All review items carry the `partyName` key.
- All statement links carry the `partyName` key.
- Transaction display names are non-empty.
- Transaction-linked review items have non-empty `partyName`.
- Synthetic W2 review items have non-empty `partyName`.
- Strict NOT_IN_ERP review items have non-empty `partyName`.
- Statement links have non-empty `partyName`.
- Transaction-linked review item `partyName` does not collapse to `partyKey`.
- Statement link `partyName` does not collapse to `partyKey`.
- Existing v2.0/v2.1 projection counts remain unchanged.

## Files Updated

- `aging-api/src/services/previewTransform.ts`
- `aging-app/src/parsing-engine/types.ts`
- `aging-app/src/components/review/ReviewQueuePage.tsx`
- `aging-app/src/baselines/phase1-v1.3.0.json`
- `aging-api/src/baselines/phase1-v1.3.0.json`
- `aging-api/dist/baselines/phase1-v1.3.0.json`

## Next

Proceed to v2.2 Party Detail spec freeze.
