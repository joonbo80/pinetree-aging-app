# Apply order

This is a UI shell package for v2.3 C2 Round 2.

**This folder is the C2 Round 2 fix package.** Procedure below assumes
you are looking at the folder contents directly. If the package
arrived inside a zip, extract it first; the application steps are
identical either way.

## What changes

Four new files (drop in, no merge):

```
aging-app/src/pages/AgingReportPage.tsx
aging-app/src/components/aging/NoDueDateCallout.tsx
aging-app/src/components/aging/AgingTabs.tsx
aging-app/src/styles/v2.3-aging-report.css
tools/test-aging-report-ui.mjs
```

Three str_replace patches to existing files (see `patches/` for
exact instructions):

```
aging-app/src/App.tsx                              (3 patches)
aging-app/src/components/dashboard/Dashboard.tsx   (3 patches)
aging-app/index.html                                (1 patch)
```

The patches add /aging routing, the Dashboard entry button, and the
stylesheet link. They do not modify any existing functionality.

## Apply steps

1. Copy the four new component / page / style files into the canonical
   locations:

   ```
   v2.3-c2-round2-fix-package\aging-app\src\pages\AgingReportPage.tsx
     -> C:\Users\samue\OneDrive\Documents\New project\aging-app\src\pages\AgingReportPage.tsx
   ```
   (and similarly for NoDueDateCallout.tsx, AgingTabs.tsx, v2.3-aging-report.css)

2. Copy the new invariant test:

   ```
   v2.3-c2-round2-fix-package\tools\test-aging-report-ui.mjs
     -> C:\Users\samue\OneDrive\Documents\New project\tools\test-aging-report-ui.mjs
   ```

3. Apply the three patches under `patches/`. Open each .patch file and
   follow the inline str_replace blocks:

   - `patches/app-tsx.patch` -- 3 patches to App.tsx
   - `patches/dashboard-tsx.patch` -- 3 patches to Dashboard.tsx
   - `patches/index-html.patch` -- 1 patch to index.html

4. Run the new invariant test:

   ```powershell
   cd "C:\Users\samue\OneDrive\Documents\New project"
   node --experimental-strip-types .\tools\test-aging-report-ui.mjs
   ```

   Expected: `PASS: 24    FAIL: 0`.

5. Run the Round 1 invariant test (regression check):

   ```powershell
   node --experimental-strip-types .\tools\test-aging-report-view.mjs
   ```

   Expected: `PASS: 38    FAIL: 0`. The selector did not change in
   Round 2.

6. Build:

   ```powershell
   cd aging-app
   npm.cmd run build
   ```

   Expected: clean build. The new components compile under tsconfig's
   strict settings (noUnusedParameters, noUnusedLocals).

7. Re-run existing v2.2 + C1 invariants for regression check:

   ```powershell
   cd "C:\Users\samue\OneDrive\Documents\New project"
   node .\tools\test-app-tsx-wireup.mjs              # 14/0
   node .\tools\test-logo-integration.mjs            # 32/0
   node .\tools\test-party-detail-page-step11.mjs    # 13/0
   node .\tools\test-walkthrough-rev4.mjs            # 17/0
   ```

8. Start dev server and visually verify:

   ```powershell
   cd aging-app
   npm.cmd run dev
   ```

   Open http://localhost:5173 in browser:
   - Click "Load Baseline Demo" -> "Confirm Import"
   - Click "Open Collection Workbench" on the Dashboard
   - /aging page shows: No Due Date callout (118 items), Summary
     strip (21 / 463 / 628), three tabs (Current / Overdue / Cleared
     in order)

## Verification of swap-test (proof of invariant authenticity)

The invariant test was self-verified against the broken state
(Round 2 files absent + App.tsx without /aging route) before this
package was finalized:

```
BROKEN state (Round 2 changes absent):  PASS:  1    FAIL: 23
FIXED  state (Round 2 changes applied): PASS: 24    FAIL:  0
```

The 1 PASS on broken state is a vacuous negative invariant
(NoDueDateCallout React import check passes when the file does not
exist). The 23 FAILs cover: page file presence, selector binding,
JSX ordering (callout before tabs), tab order, /aging route, Dashboard
button, CSS file, CSS load path. Each FAIL maps to a specific Round 2
deliverable.

## Rollback

If Round 2 causes any issue:

1. Delete the four new files:
   - `aging-app/src/pages/AgingReportPage.tsx`
   - `aging-app/src/components/aging/NoDueDateCallout.tsx`
   - `aging-app/src/components/aging/AgingTabs.tsx`
   - `aging-app/src/styles/v2.3-aging-report.css`
   - `tools/test-aging-report-ui.mjs`

2. Revert the three patches:
   - App.tsx: remove the AgingReportPage import, the /aging Route, and
     the onOpenAging prop from the Dashboard usage.
   - Dashboard.tsx: remove the onOpenAging prop from the interface and
     destructuring, and remove the Open Collection Workbench button block.
   - index.html: remove the v2.3-aging-report.css <link>.

3. The C2 Round 1 selector is unaffected by rollback.
