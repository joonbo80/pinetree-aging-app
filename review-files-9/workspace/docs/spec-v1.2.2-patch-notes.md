# Parsing Engine Spec v1.2.2 Patch Notes

These notes capture policy clarifications discovered during ERP audit validation.

## Direction

All source types use `settled` when the balance is effectively zero:

```text
abs(rawBalance) < 0.005
  => isZeroBalance = true
  => direction = "settled"
```

This applies to `INVOICE`, `CRDR`, and `AP`.

## Department Mapping

Add `WRE` to the Phase 1 department map:

```js
WRE: "GE" // Warehouse / inventory style rows mapped to General in Phase 1
```

Future UI phases may add a dedicated Warehouse view without changing raw parsing.

## W2 Company Currency Warning

`W2` is counted once per company, not once per transaction:

```text
Same normalized company has both USD and CAD
```

The transactions still retain `W2` in `anomalyRefs` so UI can highlight affected records.

## W1 Exact Duplicate Policy

`W1` is triggered only when both keys match:

```text
sourceIdentityKey + sourceContentHash
```

Phase 1 does not automatically exclude these rows. Exact duplicates remain in parsed totals to preserve source reconciliation. The audit report provides:

- exact duplicate group count
- exact duplicate transaction count
- potential duplicate signed balance impact
- row list and samples for review

## Cross Reference Currency Safety

Cross-reference audit groups are calculated by:

```text
ourRefNo + currency
```

This prevents USD and CAD from being shown as one combined signed balance.
