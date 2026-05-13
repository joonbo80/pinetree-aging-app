# Phase 2 v2.2 Step 4 Absorption Notes

Date: 2026-05-04

## Result

Party Detail header and summary cards are absorbed into mainline.

```text
aging-app build: PASS
aging-api build: PASS
party selector test: PASS 48 / FAIL 0
party page step4 test: PASS 105 / FAIL 0
```

## Added

- `aging-app/src/components/party/PartyDetailPage.tsx`
- `tools/test-party-detail-page-step4.mjs`

## Updated

- `aging-app/src/App.tsx`
- `aging-app/src/styles/global.css`

## Review Adjustments Before Absorption

The incoming Step 4 package was broadly sound. Two mainline adjustments
were made before absorption:

1. `result === null` now renders a clear `No data loaded yet` state
   instead of looking like an unknown party.
2. `/party/:partyKey` is now wired to the real `PartyDetailPage` route,
   not left on the placeholder.

## Current UI Scope

Implemented:

- party display header
- partyKey display
- aliases footnote
- department summary
- status badge
- per-currency net balance pills
- six clickable summary cards
- schema 1.0 details-unavailable fallback
- unknown party fallback
- statement-only party path

Still placeholder:

- Transactions tab content
- Statements tab content
- Reviews tab content
- Duplicates tab content
- trace expansion inside party tabs
- per-tab CSV export

## Next

Proceed to v2.2 Step 5:

- tab scaffolding
- active tab shell
- common tab header/footer shape
- prepare Step 6-9 tab content insertion
