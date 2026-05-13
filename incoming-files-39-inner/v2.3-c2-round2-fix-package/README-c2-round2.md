# v2.3 C2 Round 2 Fix Package -- UI Shell + Tabs + No Due Date Callout

Date: 2026-05-12
Parent spec: v2.3 C2 Statement Collection Workbench micro-spec rev3 (FROZEN)
v2.3 position: order_2 / Round 2 of 7 (Implementation Round 2)

This package builds the UI shell on top of the Round 1 selector. After
applying Round 2, the workbench has a real /aging route, a No Due Date
callout above the tabs, and a Current / Overdue / Cleared tabs strip
that displays selector-derived counts and totals.

The party rollup TABLE itself (transaction rows under each party,
expand-on-click, badges) arrives in Round 3. Round 2 is intentionally
a shell: enough to navigate to the workbench and see the count chain
live, without UI risk that would block the visual review.

**This folder is the C2 Round 2 fix package.** Apply per `apply-order.md`.

## Package contents

```
v2.3-c2-round2-fix-package/
  README-c2-round2.md                                (this file)
  apply-order.md                                     (8-step apply procedure)
  aging-app/
    src/
      pages/
        AgingReportPage.tsx                          (new, ~134 lines)
      components/aging/
        NoDueDateCallout.tsx                         (new, ~54 lines)
        AgingTabs.tsx                                (new, ~115 lines)
      styles/
        v2.3-aging-report.css                        (new, ~180 lines)
  tools/
    test-aging-report-ui.mjs                         (new, 10 inv groups / 24 sub-checks)
  patches/
    app-tsx.patch                                    (3 str_replace patches)
    dashboard-tsx.patch                              (3 str_replace patches)
    index-html.patch                                 (1 str_replace patch)
```

## Round 2 deliverables

### AgingReportPage.tsx

The page-level component. Imports the Round 1 selector and renders:

- Header (page title + As-of date + "Back to Dashboard" button)
- NoDueDateCallout (when openCount > 0)
- Summary strip (Current 21 / Overdue 463 / Cleared 628 in baseline)
- AgingTabs (three-tab shell with placeholders for the rollup table)

The page handles the empty-data case (user lands on /aging without
committing an import) by rendering an empty state with a "Back to
Upload" button.

### NoDueDateCallout.tsx

The pinned amber callout above the tabs. Uses the selector's
`openCount` (118 in baseline), NOT the gross dueDate-missing count
(303). Spec Decision 4 P1-1 pinned this in invariant
inv-aging-data-2 in Round 1; this round's UI follows the same rule.

### AgingTabs.tsx

The tabs strip + per-tab panel. Tab order is exactly Current /
Overdue / Cleared (spec Decision 6). Default tab is Overdue
(typical collector starting point). Each tab shows:

- USD / CAD totals
- Transaction count and party row count
- Placeholder text noting the rollup table comes in Round 3

The tab counts on the tab buttons come directly from the selector's
`transactionCount` per tab.

### v2.3-aging-report.css

Style tokens follow v2.2 conventions (slate neutrals, amber for
attention, blue for active state). Self-contained: no shared
selectors with existing v2.2 sheets, so adding the link does not
disturb existing pages.

### App.tsx + Dashboard.tsx patches

- App.tsx: 1 new import, 1 new <Route path="/aging">, 1 new prop on
  the existing Dashboard route (`onOpenAging`).
- Dashboard.tsx: 1 new optional prop in the interface, 1 destructure
  entry, 1 button block guarded by the optional prop.

Each patch is small and the patch files contain the exact str_replace
blocks plus context so the user can apply them without ambiguity.

## Invariant design

24 sub-checks across 10 invariant groups + 3 build-hygiene checks:

```
inv-aging-ui-1:  AgingReportPage component file exists           (2 checks)
inv-aging-ui-2:  AgingReportPage imports Round 1 selector         (1 check)
inv-aging-ui-3:  NoDueDateCallout renders above AgingTabs in JSX  (3 checks)
inv-aging-ui-4:  NoDueDateCallout uses OPEN count, not gross      (3 checks)
inv-aging-ui-5:  AgingTabs renders Current / Overdue / Cleared    (2 checks)
inv-aging-ui-6:  /aging route registered in App.tsx               (3 checks)
inv-aging-ui-7:  Dashboard has Open Collection Workbench entry    (2 checks)
inv-aging-ui-8:  App.tsx forwards onOpenAging to Dashboard        (1 check)
inv-aging-ui-9:  CSS file present + key classes defined           (3 checks)
inv-aging-ui-10: CSS load path registered (html or import)        (1 check)
inv-aging-ui-build-hygiene: TypeScript strict guards              (3 checks)
                                                          Total: 24 sub-checks
```

## Swap-test proof of invariant authenticity

```
BROKEN state (Round 2 changes absent):  PASS:  1    FAIL: 23
FIXED  state (Round 2 changes applied): PASS: 24    FAIL:  0
```

The single PASS on broken state is a negative invariant (no
unnecessary React import) that vacuously passes when the file does
not exist. All 23 substantive invariants fail on broken state and
pass on fixed state.

## What this does NOT change in Round 2

- The Round 1 selector is unchanged.
- No existing invariants regress; Round 1 invariants still pass at
  38/0.
- Existing pages (Upload, Dashboard, Review Queue, Party Detail) are
  unchanged in behavior. Dashboard adds one new button.
- No persistent state, no editable input, no API calls.

## What Round 3 will add

- Party rollup table inside each tab (sorted by priority band).
- Expand-on-click to show transaction rows under each party.
- "Open Party Detail" button per rollup row (navigates to existing
  /party/:partyKey).
- inv-aging-rollup invariants (table structure, expand mechanics,
  sort order).

The Round 2 placeholder text in each tab is intentionally explicit
about what is pending, so visual reviewers know the placeholder is
expected and not a bug.

## Methodology notes (Round 2 self-observation)

This round caught one new silent-corruption family pattern:

- #21: "Claude reference filesystem (/tmp/v211) vs user mainline
  divergence." Claude's read-only reference reflects an older v2.1.1
  baseline, while the user's mainline includes v2.2 + C1 + C2 Round 1
  absorbed state. Same file paths, different contents.
- Defense: When new round needs to modify existing files, ask the
  user for the current mainline state (via PowerShell dump or file
  upload) BEFORE writing patches. This round did that and the patches
  reflect actual mainline structure, not stale reference.
- Standing rule: reference paths can be used for STRUCTURAL pattern
  reference (component shape, naming conventions), but never for the
  CONTENT of a file the patch will touch.

Round 2 also reuses the Round 1 lessons:

- Real selector binding (Round 2 page imports selectAgingReport, not
  re-implementing the rules).
- TypeScript strict guards (optional prop with `?:`, useNavigate
  fallback, no unused React import).
- Source-level invariants for build-breaking changes.

## Acceptance criteria

- [ ] All four new files in canonical locations.
- [ ] All three patches applied to App.tsx, Dashboard.tsx, index.html.
- [ ] `node --experimental-strip-types .\tools\test-aging-report-ui.mjs`
      returns PASS: 24 / FAIL: 0.
- [ ] `node --experimental-strip-types .\tools\test-aging-report-view.mjs`
      still returns PASS: 38 / FAIL: 0 (Round 1 regression).
- [ ] `npm.cmd run build` succeeds.
- [ ] All four v2.2 invariant suites still pass at original counts.
- [ ] Dev server: clicking "Open Collection Workbench" navigates to
      /aging and shows callout + summary strip + tabs.

## Next steps after absorption

Round 3 (party rollup table):
- PartyRollupTable.tsx component
- TransactionRow.tsx subcomponent (expand-on-click contents)
- "Open Party Detail" button per row
- inv-aging-rollup invariants

The Round 2 placeholder text in each tab disappears in Round 3,
replaced by the real table.
