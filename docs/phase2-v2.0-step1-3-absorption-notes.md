# Phase 2 v2.0 Step 1-3 Absorption Notes

Date: 2026-05-02

## Scope

Absorbed Step 1-3 Revision 3 into the main workspace:

- `ParsingPreviewResult.details` type contract
- `partyKey` normalizer and test file
- API-side `previewTransform.ts` details projection
- Preview transform verification harness

Phase 1 parser code remains untouched.

## Additional Fixes Applied During Absorption

1. Deterministic transaction IDs now use:

   ```text
   <sourceType>:<sourceIdentityKey>:<sourceContentHash>
   ```

   `:r<sourceRow>` is appended only when that base id collides in the same
   payload. This keeps ordinary transaction ids stable across source file
   renames and row shifts.

2. `byTypeRow` lookup now detects collisions instead of silently overwriting.

   If multiple transactions share the same `sourceType|sourceRow` key, the row
   lookup becomes ambiguous and returns `null`, allowing safer scoped fallback
   matching.

3. `StatementLink` now preserves raw local statement classification fields:

   - `referenceStatus`
   - `differenceType`

   This keeps the broad 95-row historical/not-in-uploaded-ERP population
   distinguishable even though the Review Queue strict category remains 7 rows.

4. UI TypeScript build excludes `*.test.ts` files so Node test files do not get
   bundled into the browser app typecheck.

## Verification

Type checks:

- API TypeScript check: PASS
- UI TypeScript check: PASS

Projection checks against the frozen 6-file baseline:

| Check | Result |
|---|---:|
| Schema version | `1.1` |
| Transactions | 1,230 |
| AGENT links | 85 |
| AGENT matched | 85 |
| Summary `matchedCRDRRefs` | 85 |
| LOCAL `EXACT_SIGNED` links | 162 |
| LOCAL `EXACT_SIGNED` wrong FK count | 0 |
| Strict `NOT_IN_ERP_EXTRACT` review items | 7 |
| Unique transaction ids | 1,230 / 1,230 |
| Source file rename id preservation | 1,230 / 1,230 |
| Normal id row-shift preservation | 1,046 / 1,046 |
| Statement links preserving raw status/diff | PASS |

## Notes

`tsx` test execution is blocked in the Codex sandbox by `spawn EPERM`, so the
verification was run against compiled `aging-api/dist/services/previewTransform.js`
with the same frozen baseline data.

Run the full harness locally with:

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
npm.cmd --prefix aging-api run build
npm.cmd --prefix aging-api exec -- tsx tools/test-preview-transform.mjs
```

