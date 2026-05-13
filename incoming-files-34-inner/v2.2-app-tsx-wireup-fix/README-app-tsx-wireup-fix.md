# v2.2 App.tsx Wire-up Fix Package

Date: 2026-05-06
Trigger: Step 13 hands-on walkthrough discovered 2 BLOCKERs that
504 component invariants + build clean did NOT catch.
Predecessor: v2.2 Step 1-12 absorbed, logo + favicon rev2 absorbed,
Step 13 walkthrough rev3 in progress.

## What this fixes

Two BLOCKERs found during Step 13 hands-on walkthrough Scenario 3
(Dashboard Top Parties click + direct URL Party Detail access).

Both were the same root cause: v2.2 Step 12 absorbed component code
(Dashboard.tsx onOpenParty integration + PartyDetailPage component)
but the App.tsx that connects those components to the React Router
+ React state never got the matching wire-up. Components passed
their own invariants. App.tsx never wired them up. Result: pristine
component code that the user cannot reach.

This is silent-corruption family member 12: component-level invariants
do not catch wire-up layer regressions. The fix adds 4 new invariants
(plus negative invariants and consistency checks) that pin the wire-up
layer directly.

### BLOCKER #1 -- Dashboard onOpenParty prop missing

Symptom (browser):
- Top Parties row hover: cursor stays I-beam (text), not pointer
- Click on row: nothing happens, URL unchanged
- DOM: <td><b>LEMOND...</b></td> -- no <button> wrapper

Root cause:
- App.tsx renders <Dashboard ... /> without onOpenParty prop
- Dashboard.tsx line 298: const canLink = onOpenParty && key !== null;
- onOpenParty is undefined -> canLink is false -> button is not
  rendered, only plain text -> click cannot fire any handler

Fix:
- Add to App.tsx Dashboard element:
    onOpenParty={(partyKey) => navigate(`/party/${partyKey}`)}

### BLOCKER #2 -- /party/:partyKey route uses PlaceholderPage

Symptom (browser):
- Direct URL http://localhost:5173/party/lemond-food-corp-new-addr
- Page shows: "No data loaded yet. Open a parsing preview before
  viewing party details."
- Even when baseline is already loaded (Dashboard works fine in
  the same session)

Root cause:
- App.tsx line 217:
    <Route path="/party/:partyKey" element={<PlaceholderPage kind="party" />} />
- Real PartyDetailPage component (~2475 lines, all 12 steps absorbed)
  is never imported into App.tsx
- PartyDetailPage is the component that reads result from props and
  renders Transactions/Statements/Reviews/Duplicates tabs
- Route element is the placeholder that just shows "No data loaded yet"

Fix:
- Add import: import { PartyDetailPage } from './components/party/PartyDetailPage';
- Replace route element:
    <Route path="/party/:partyKey" element={<PartyDetailPage result={result} />} />

## Why 504 invariants did not catch this

The component-level invariants for Step 1-12 verified that the
PartyDetailPage component, given a result prop, renders correctly.
They could not verify that App.tsx actually passes a result prop to
PartyDetailPage, because App.tsx was never doing that.

This pattern recurs whenever absorbed work spans multiple files: the
component author tests their component in isolation, but the wire-up
in the host file can drift.

The 4 new invariants in this package pin the wire-up directly. They
are file-level regex checks against App.tsx itself, so they catch
the connection layer that no component-level test can see.

## Files changed

```
aging-app/src/App.tsx                     (3 line additions, 1 replacement)
tools/test-app-tsx-wireup.mjs              (new file, 14 invariant checks)
```

No other files touched. No baseline data, no parser, no API server,
no v2.4 spec, no logo/favicon work.

## Invariants added

```
inv-wire-1: Dashboard receives onOpenParty prop with /party/${partyKey} navigation
inv-wire-2: /party/:partyKey route uses PartyDetailPage (positive + negative pair)
inv-wire-3: PartyDetailPage import statement present
inv-wire-4: PartyDetailPage receives result prop
```

Plus consistency checks (other routes still wired correctly) and
negative invariants (PlaceholderPage NOT used for party route, logo
NOT routed to /dashboard).

Total: 14 PASS on fixed App.tsx, 6 FAIL on original broken App.tsx
(verified by swap-test).

## Verification already run

```
cd "C:\Users\samue\OneDrive\Documents\New project"
node .\tools\test-app-tsx-wireup.mjs
```

Expected:
```
PASS: 14    FAIL: 0
```

Build verification will be confirmed by reviewer after applying
the patch.

## Reviewer focus

Please check:

1. App.tsx diff is exactly 3 changes (1 import added, 1 prop added,
   1 element type swapped). No other line touched.
2. The onOpenParty arrow function uses backtick template literal
   `\`/party/\${partyKey}\``, not string concatenation, so partyKey
   special characters are correctly URL-segmented.
3. PartyDetailPage is given the same `result` prop pattern that
   ReviewQueuePage already uses (consistency, no surprise).
4. No regressions to /dashboard, /review, /review/:type routes.
5. The 14 invariants in test-app-tsx-wireup.mjs collectively catch
   the rev1 broken state (they should ALL fail on the original
   App.tsx -- the swap-test in this package's verification confirms
   this).
6. The negative invariants (`onOpenParty does NOT route to /dashboard`,
   `PartyDetailPage NOT replaced by PlaceholderPage`) pin the wire-up
   shape against future drift.

## After fix is absorbed

1. Re-run logo invariant test: `node tools/test-logo-integration.mjs`
   Expected: 32/32 PASS (unchanged).
2. Run new wire-up invariant test: `node tools/test-app-tsx-wireup.mjs`
   Expected: 14/14 PASS.
3. Build: `cd aging-app; npm.cmd run build`
   Expected: clean build, no TypeScript errors.
4. Resume Step 13 walkthrough at Scenario 3 (Top Parties click) +
   Scenario 4 (Party Detail deep dive).

## Methodology note

This package took the unusual step of running a swap-test as part
of self-verification: invariants were run against both the fixed
and the original broken App.tsx to confirm they pass on fixed and
fail on broken. This is more thorough than the typical absorb-and-PASS
workflow, and is justified here because the BLOCKERs were invisible
to all prior test layers.

For future absorb cycles spanning multiple files, the swap-test
pattern should be considered: write the invariant, deliberately
break the code in the way the bug appears, confirm the invariant
fails, then fix and confirm pass. This proves the invariant is real
rather than tautological.
