# Apply order

This is a code + invariant package for v2.3 C2 Round 1.

**This folder is the C2 Round 1 fix package.** Procedure below assumes
you are looking at the folder contents directly. If the package
arrived inside a zip, extract it first; the application steps are
identical either way.

## What changes

```
aging-app/src/selectors/agingReport.ts          (new, ~470 lines)
tools/test-aging-report-view.mjs                (new, 11 invariant groups,
                                                  24 sub-checks)
```

Both files are NEW. No existing v2.2 file is touched in Round 1.

## Apply steps

1. Copy the selector source into the canonical location:

   ```
   v2.3-c2-round1-fix-package\aging-app\src\selectors\agingReport.ts
      -> C:\Users\samue\OneDrive\Documents\New project\aging-app\src\selectors\agingReport.ts
   ```

2. Copy the invariant test:

   ```
   v2.3-c2-round1-fix-package\tools\test-aging-report-view.mjs
      -> C:\Users\samue\OneDrive\Documents\New project\tools\test-aging-report-view.mjs
   ```

3. Run the new invariant test FIRST:

   ```powershell
   cd "C:\Users\samue\OneDrive\Documents\New project"
   node --experimental-strip-types .\tools\test-aging-report-view.mjs
   ```

   Expected: `PASS: 36    FAIL: 0`.

   Note on Node version: on Node 24.x (your mainline) the
   `--experimental-strip-types` flag is no-op (the feature is stable
   without it), but including the flag is harmless and makes the
   invocation work on Node 22.6+ as well.

   If you see "Unknown file extension .ts" instead, the flag was
   stripped or your Node is older than 22.6. Check `node --version`;
   it should be v22.6.0 or higher.

4. Confirm clean TypeScript build (the new selector must compile):

   ```powershell
   cd aging-app
   npm.cmd run build
   ```

   Expected: clean build, no TypeScript errors. The selector is not yet
   referenced from any component (UI work is Round 2+), so it compiles
   as a standalone module.

5. Re-run existing v2.2 + C1 invariants for regression check:

   ```powershell
   cd "C:\Users\samue\OneDrive\Documents\New project"
   node .\tools\test-app-tsx-wireup.mjs              # 14/0
   node .\tools\test-logo-integration.mjs            # 32/0
   node .\tools\test-party-detail-page-step11.mjs    # 13/0
   node .\tools\test-walkthrough-rev4.mjs            # 17/0
   ```

   Expected: all pass with 0 FAIL. Round 1 introduces no UI changes,
   so existing invariants are unaffected.

6. No dev server restart needed (selector is not wired in yet).

## Verification of swap-test (proof of invariant authenticity)

The invariant test was self-verified against the broken state
(selector source absent) before this package was finalized:

```
BROKEN state (selector absent):  PASS:  6    FAIL: 13
FIXED  state (selector present): PASS: 36    FAIL:  0
```

rev2: invariant test imports the selector .ts directly and asserts
on real output (P1-1 fix). The 6 PASSes on broken state are
baseline-fact invariants independent of the selector (matchType
distribution, NOT_IN_ERP_EXTRACT orphan check); they catch baseline
drift even with a working selector. The 13 FAILs cover source
structure, module import, and (when selector is present) runtime
output assertions.

## What this does NOT change in Round 1

- No UI changes (no new pages, components, routes).
- No App.tsx changes.
- No existing selector or component modified.
- No dev server behavior change.
- No build output change beyond a new compiled selector module
  that is currently unreferenced.

## What Round 2 will add

Round 2 begins the UI layer:

- /aging route in App.tsx
- AgingReportPage shell
- No Due Date callout component
- Tabs (Current / Overdue / Cleared)
- inv-aging-ui invariants

The selector built in Round 1 becomes the data source for Round 2.

## Rollback

If Round 1 causes any issue:

1. Delete `aging-app/src/selectors/agingReport.ts`.
2. Delete `tools/test-aging-report-view.mjs`.

The mainline returns to its pre-Round-1 state. No other file is
modified.
