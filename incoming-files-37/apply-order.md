# Apply order

This is a document + invariant package. No application code is
touched.

**This folder is the C1 fix package.** Procedure below assumes you
are looking at the folder contents directly. If the package
arrived inside a zip, extract it first; the application steps are
identical either way.

## What changes

```
docs/walkthroughs/v2.2-step13-walkthrough.md   (rev3 -> rev4)
tools/test-walkthrough-rev4.mjs                (new, 7 invariant groups, 17 checks)
```

## Apply steps

1. If the rev3 walkthrough file exists at a non-canonical location
   (e.g. Downloads, project root, docs without walkthroughs/), move
   or remove that copy. The canonical path going forward is exactly:

   ```
   C:\Users\samue\OneDrive\Documents\New project\docs\walkthroughs\v2.2-step13-walkthrough.md
   ```

   If the directory does not exist:

   ```powershell
   New-Item -ItemType Directory -Path "C:\Users\samue\OneDrive\Documents\New project\docs\walkthroughs" -Force
   ```

2. Copy the rev4 walkthrough into the canonical path:

   ```
   v2.3-c1-fix-package\docs\walkthroughs\v2.2-step13-walkthrough.md
      -> C:\Users\samue\OneDrive\Documents\New project\docs\walkthroughs\v2.2-step13-walkthrough.md
   ```

3. Copy the new invariant test:

   ```
   v2.3-c1-fix-package\tools\test-walkthrough-rev4.mjs
      -> C:\Users\samue\OneDrive\Documents\New project\tools\test-walkthrough-rev4.mjs
   ```

4. Run the new invariant first:

   ```powershell
   cd "C:\Users\samue\OneDrive\Documents\New project"
   node .\tools\test-walkthrough-rev4.mjs
   ```

   Expected: `PASS: 17    FAIL: 0` (7 invariant groups, 17 sub-checks).

5. Re-run existing v2.2 invariants to confirm no regression
   (none expected, since this package is document-only):

   ```powershell
   node .\tools\test-app-tsx-wireup.mjs
   node .\tools\test-logo-integration.mjs
   node .\tools\test-party-detail-page-step11.mjs
   ```

   Expected:
   ```
   PASS: 14    FAIL: 0
   PASS: 32    FAIL: 0
   PASS: 13    FAIL: 0
   ```

6. No build needed (document and invariant only).

7. No dev server restart needed.

## Verification of swap-test (proof of invariant authenticity)

The new invariant test was self-verified against the rev3
(broken) walkthrough state before this package was finalized:

```
rev3 (broken state):  PASS:  2    FAIL: 15
rev4 (fixed state):   PASS: 17    FAIL:  0
```

The 2 PASSes on rev3 are vacuous (negative invariants that pass
because the rev3 document lacks the wording the negative is
guarding against). The 15 FAILs on rev3 confirm the invariants
catch the real preflight gaps.

This satisfies the swap-test rule from v2.2: invariants must
demonstrably fail on the broken state to count as authentic
(non-tautological).

## Rollback

If the rev4 update causes any problem with the user's local
walkthrough flow, revert:

1. Restore the rev3 walkthrough file from any prior copy (the v2.2
   release backup zip `v2.2-backup-2026-05-11.zip` contains it
   under its previous path).
2. Delete `tools/test-walkthrough-rev4.mjs`.

The existing v2.2 invariant suites are unaffected by either step.
