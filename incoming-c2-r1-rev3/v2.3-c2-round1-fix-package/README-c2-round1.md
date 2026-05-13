# v2.3 C2 Round 1 Fix Package -- Selector + Data Invariants (rev3)

Date: 2026-05-12
Parent spec: v2.3 C2 Statement Collection Workbench micro-spec rev3 (FROZEN)
v2.3 position: order_2 / Round 1 of 7 (Implementation Round 1)

This package introduces the agingReport selector and its data-layer
invariants. Round 1 is pure selector logic with no UI. The number
chain (Current 21 / Overdue 463 / No Due Date open 118 / Cleared 628
/ Total 1,230) is pinned by the invariants before any UI is built.

**This folder is the C2 Round 1 fix package.** Apply the two artifact
files listed below directly to the workspace per `apply-order.md`.

## Revision history

- rev1 (2026-05-12): Initial Round 1 draft. Selector + 24 sub-checks.
- rev2 (2026-05-12): Reviewer P1 fixes:
  - P1-1: Tautological invariant fix. The rev1 test re-implemented
    `classifyTab` inside the test file and asserted on its own
    re-implementation, not on the selector output. rev2 imports the
    selector .ts directly (Node 22.6+ TypeScript-strip-types) and
    asserts on real selector output.
  - P1-2: AR/AP netting prevention. Group key extended from
    (partyKey, currency) to (partyKey, currency, direction).
- rev3 (2026-05-12): Reviewer P1 fix:
  - Build-hygiene: `buildTransactionRow` had an unused `asOfDate:
    string` parameter from an earlier design draft. The selector
    runs correctly under Node strip-types (which ignores TypeScript
    strict checks at runtime), but `npm.cmd run build` (full tsc
    compile) fails with TS6133 under tsconfig's
    `noUnusedParameters: true`. Fix: removed the parameter from
    both the function signature and its call site. Added two new
    source-level invariants (build-hygiene-1, build-hygiene-2) to
    pin the signature against future regression.
  - This is a new silent-corruption family pattern: Node strip-types
    runtime PASS does not imply tsc build PASS. Runtime tests need a
    companion structural invariant against parameters/locals that
    would trigger strict-check errors.

## Package contents

```
v2.3-c2-round1-fix-package/
  README-c2-round1.md                                  (this file)
  apply-order.md                                       (5-step apply procedure)
  aging-app/
    src/
      selectors/
        agingReport.ts                                 (new, ~470 lines)
  tools/
    test-aging-report-view.mjs                         (new, 11 groups / 24 sub-checks)
```

## Selector design summary

The selector exposes a single entry point:

```typescript
export function selectAgingReport(
  result: ParsingPreviewResult | null,
  asOfDate?: string,
): AgingReportData
```

It is a pure function. Given a parsing preview result and an
optional asOfDate override, it returns the data backbone of the
Collection Workbench:

```
AgingReportData
  asOfDate: string
  noDueDate: NoDueDateBucket           (open count + USD/CAD totals + rows)
  tabs:
    current: AgingTabData              (parties array + totals)
    overdue: AgingTabData               (parties array + totals + bucket breakdown)
    cleared: AgingTabData               (parties array + totals)
  totalTransactions: number
  coverageSum: number                  (diagnostic; equals totalTransactions)
```

Each tab is a sorted array of `PartyRollup` rows (priority band
desc, then absolute amount desc), with `transactions` populated
for expand-on-click in Round 3.

### Internal helpers (private to module)

```
classifyTab(tx, asOfDate)                -> 'cleared' | 'no-due-date-open' | 'current' | 'overdue'
buildTransactionRow(tx, ..., asOfDate)   -> TransactionRow with all 3 labels
indexStatementLinksByTransactionId(links) -> Map<txId, StatementStatus>
mapMatchTypeToStatus(matchType)          -> StatementStatus | null
evaluateActionReadiness(tx, ...)         -> ActionReadiness
evaluatePriorityBand(tx, ...)            -> PriorityBand
buildTabData(rows, includeBuckets)       -> AgingTabData
buildNoDueDateBucket(rows)               -> NoDueDateBucket
buildAgingBucketBreakdown(rows)          -> AgingBucketBreakdown
```

### Spec rules pinned in code

- Tab classification rule chain (spec 3.5): Cleared > No Due Date >
  Current > Overdue. isZeroBalance evaluated FIRST.
- Statement Status mapping (spec 3.2): 4 values, with
  CHANGED_AFTER_STATEMENT folded into BalanceDifference. NOT_IN_ERP_EXTRACT
  excluded (orphan, routes to Review Queue).
- Action Readiness rule chain (spec 3.3): Cleared > MissingDueDate >
  CheckDuplicate > ReviewStatementDifference > ReadyToFollowUp.
- Priority Band rule chain (spec 3.4): Cleared FIRST > ReviewFirst >
  FollowUp > Monitor. All non-Cleared rules guarded on open balance.
- Currency LOCKED rule (v1.1): party with both USD and CAD appears
  as 2 rollup rows.
- HIGH_AMOUNT_THRESHOLD = 10,000 per currency, no conversion (spec Q-A).
- asOfDate sourced from `result.uploadSession.asOfDate` if not provided.

### Notable pre-implementation finding

While developing Round 1, a silent-corruption family pattern was
caught BEFORE invariants were written: the asOfDate field is at
`result.uploadSession.asOfDate`, not `result.asOfDate`. The initial
draft had the wrong path, which would have made every dueDate-present
transaction route to Current. A Node simulation against the baseline
fixture caught this before invariant authoring. The selector now
reads the correct path.

## Invariant design

The test file at `tools/test-aging-report-view.mjs` runs 11
invariant groups expanded into 24 sub-checks. The granularity
mirrors the C1 walkthrough rev4 invariant pattern, so debugging is
specific: a failure pinpoints exactly which rule drifted.

```
inv-aging-data-1:  selectAgingReport function exported              (1 check)
inv-aging-data-2:  classifyTab rule chain present, isZeroBalance first (1 check)
inv-aging-data-3:  classifyTab returns 4 bucket values              (1 check)
inv-aging-data-4:  StatementStatus has exactly 4 values             (5 checks)
                   (4 includes + 1 exclude NotInERP)
inv-aging-data-5:  HIGH_AMOUNT_THRESHOLD = 10,000 USD + 10,000 CAD  (1 check)
inv-aging-data-6:  evaluatePriorityBand returns Cleared FIRST       (1 check)
inv-aging-data-7:  evaluatePriorityBand checks isZeroBalance once   (1 check)
inv-aging-data-8:  tab coverage 21 / 463 / 118 / 628 / 1230         (5 checks)
inv-aging-data-9:  dueDate missing = open 118 + settled 185         (2 checks)
inv-aging-data-10: NOT_IN_ERP_EXTRACT count + null FK               (2 checks)
inv-aging-data-11: matchType distribution from Section 1.4          (4 checks)
                                                            Total: 24 sub-checks
```

### Why 24 sub-checks for 11 invariant groups

Each invariant group from spec Section 5.1 is expanded into one or
more sub-checks for diagnostic precision. A future copyedit that
drops a single enum value (e.g. removes 'SettledAfterStatement'
from StatementStatus) will fail exactly one sub-check, naming the
missing value, rather than failing an opaque "Statement Status has
4 values" group check.

This matches the C1 pattern (7 invariant groups -> 17 sub-checks).

## Swap-test proof of invariant authenticity (rev3)

```
BROKEN  state (selector source file absent):   PASS:  7    FAIL: 14
REGRESSION state (selector has unused param):  PASS: 36    FAIL:  2  <- new build-hygiene invariants catch the regression
FIXED   state (selector clean, builds clean):  PASS: 38    FAIL:  0
```

The 7 PASSes on broken state are baseline-fact invariants that grep
the fixture directly (matchType distribution, NOT_IN_ERP_EXTRACT
orphan check). They check baseline reality, not selector behavior.

The 14 FAILs on broken state cover source structure, module import,
and runtime output assertions -- the selector must exist and behave
correctly for them to pass.

The REGRESSION row is critical: if a future change adds an unused
parameter (or otherwise breaks tsc strict checks), the build-hygiene
invariants catch it BEFORE the user runs `npm run build`. This is
the silent-corruption family #20 defense.

## Apply procedure

See `apply-order.md`. Summary:

1. Copy selector to `aging-app/src/selectors/agingReport.ts`.
2. Copy invariant test to `tools/test-aging-report-view.mjs`.
3. Run `node .\tools\test-aging-report-view.mjs` -> expect 24 PASS / 0 FAIL.
4. Run `npm.cmd run build` in aging-app -> expect clean TypeScript build.
5. Re-run existing v2.2 + C1 invariants for regression check.

## Acceptance criteria

- [ ] agingReport.ts at canonical path.
- [ ] test-aging-report-view.mjs at `tools/`.
- [ ] `node --experimental-strip-types .\tools\test-aging-report-view.mjs` returns PASS: 38 / FAIL: 0.
- [ ] aging-app build succeeds (no TS errors from new selector).
- [ ] All four existing invariant suites still pass:
      - test-app-tsx-wireup.mjs (14/0)
      - test-logo-integration.mjs (32/0)
      - test-party-detail-page-step11.mjs (13/0)
      - test-walkthrough-rev4.mjs (17/0)
- [ ] Reviewer review of fix package complete (no P0, no P1).

## What this does NOT change

- No UI changes. The selector is currently unreferenced from any
  component. Round 2 begins the UI integration.
- No App.tsx changes.
- No existing selectors or components modified.
- No runtime behavior change visible in the browser.

## Next steps after absorption

Round 2 (UI shell):
- Add /aging route to App.tsx
- AgingReportPage skeleton
- NoDueDateCallout component
- AgingTabs component
- inv-aging-ui invariants (10 sub-checks)

The Round 1 selector becomes the data source for Round 2.

## Methodology notes

This package applies the v2.2 + C1 standing rules:

- Artifact-grep verification (PreviewTransaction fields, asOfDate path,
  matchType distribution).
- ASCII-only.
- Pure-function selector pattern (matches v2.2 partyDetail.ts).
- Currency LOCKED rule preserved.
- Swap-test proof of invariant authenticity.
- Canonical folder package unit (Option B).
- Source-level + runtime invariants layered for two-axis drift
  detection.

New methodology note worth recording for future rounds:

- "Run baseline simulation BEFORE writing invariants" -- this round
  caught the asOfDate path bug at the Node simulation stage, before
  invariant authoring. Saved one bogus-invariant round of cleanup.
  Recommended standing rule: prototype selector logic in a throwaway
  .mjs against the real baseline before locking in invariant
  expectations.

This is the v2.3 C2 Round 1 sub-task per the v2.3 Overall Spec rev5
(FROZEN) ordering. Next round: C2 Round 2 (UI shell + inv-aging-ui).
