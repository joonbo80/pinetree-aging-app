# Phase 1 Policy Notes

## Direction

`direction` uses three values:

- `receivable`
- `payable`
- `settled`

If `abs(rawBalance) < 0.005`, every source type is classified as:

```text
direction = "settled"
isZeroBalance = true
```

This applies to `INVOICE`, `CRDR`, and `AP`.

## Department Mapping

`WRE` appears in the ERP invoice file for inventory/warehouse-style invoice rows (`INVEN...` references). Phase 1 maps it to `GE` because the canonical department set is:

```text
OI, OO, AI, AO, GE
```

If Phase 2 adds a dedicated Warehouse view, `WRE` can be split out then without changing source parsing.

## Exact Duplicates

`W1` means exact duplicate rows by:

```text
sourceIdentityKey + sourceContentHash
```

Phase 1 does **not** automatically exclude these rows. They remain in parsed totals so reconciliation stays faithful to the uploaded source file. The audit report flags them for user review and shows the potential duplicate balance impact.
