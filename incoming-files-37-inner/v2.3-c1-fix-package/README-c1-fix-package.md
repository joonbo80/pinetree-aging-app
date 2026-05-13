# v2.3 C1 Fix Package -- Walkthrough rev4

Date: 2026-05-11
Parent micro-spec: v2.3 C1 Walkthrough rev4 sub-task spec rev3 (FROZEN)
v2.3 ordering position: order_1 (first sub-task of v2.3)

This package updates the v2.2 Step 13 walkthrough guide from rev3
to rev4, fixing the three preflight gaps discovered during v2.2
hands-on execution. It is the first sub-task of v2.3.

**This folder is the C1 fix package.** Apply the two artifact files
listed below directly to the workspace per `apply-order.md`. If
distributed as a zip, the recommended filename is
`v2.3-c1-fix-package.zip`, but the canonical unit is the folder
itself -- the application procedure works the same whether the
folder arrived inside a zip or as a plain directory copy.

## Package contents

```
v2.3-c1-fix-package/
  README-c1-fix-package.md                            (this file)
  apply-order.md                                       (5-step apply procedure)
  docs/
    walkthroughs/
      v2.2-step13-walkthrough.md                       (rev3 -> rev4)
  tools/
    test-walkthrough-rev4.mjs                          (7 invariant groups, 17 sub-checks)
```

## What this package fixes

Three preflight gaps discovered during v2.2 Step 13 hands-on
execution. Each is documented in the parent micro-spec Section 2.

### Gap 1 -- Port 5173 occupancy not checked

Without a port check, Vite may fall back to port 5174 when 5173 is
held by a stale process. The API server's CORS allowlist contains
only 5173, so all `/api/parse-upload` calls then fail with CORS
errors. The rev4 preflight adds a LISTENING-only port check using
`netstat -ano | findstr ":5173" | findstr LISTENING` or
`Get-NetTCPConnection -LocalPort 5173 -State Listen`, with safe
single-PID stop guidance.

### Gap 2 -- API server (aging-api) startup not in preflight

The rev3 preflight only starts the UI dev server. Without the API
server, the local baseline may still load via UI fallback (so the
walkthrough appears to work), but the header shows API OFFLINE and
upload/parse API paths are not being verified. The rev4 preflight
adds an explicit API server startup step with three required env
vars (AGING_UPLOAD_TOKEN, AGING_PYTHON, AGING_PHASE1_ROOT) and a
matching UI env var (VITE_AGING_UPLOAD_TOKEN).

### Gap 3 -- Confirm Import button click missing from Scenario 2

The parsing preview is intentionally a two-step flow: LOAD BASELINE
DEMO loads a preview, then Confirm Import commits it. rev3 Scenario
2 only mentions the first click. Users who skip Confirm Import and
navigate directly to /dashboard see a placeholder message that
looks like a bug. The rev4 Scenario 2 makes Confirm Import an
explicit step and adds a pitfall note about the placeholder being
intentional.

While editing Scenario 2, the baseline numbers are also corrected
to match the artifact: "282 statement entities + 439 statement
links" instead of the vague "282 statements".

## Invariant test design

The new `tools/test-walkthrough-rev4.mjs` defines 7 invariant
groups expanded into 17 individual sub-checks:

```
inv-walkthrough-1: rev4 header present                              (1 check)
inv-walkthrough-2: Gap 1 fix -- port 5173 LISTENING check           (3 checks)
inv-walkthrough-3: Gap 2 fix -- API server + env vars + 3001        (5 checks)
inv-walkthrough-4: Gap 3 fix -- Confirm Import + PREVIEW            (2 checks)
inv-walkthrough-5: Scenario 2 numbers updated                       (3 checks)
inv-walkthrough-6: UI server preflight env var                       (1 check)
inv-walkthrough-7: dev token security note                          (2 checks)
                                                            Total: 17 sub-checks
```

The granularity (sub-checks rather than just 7 group-level checks)
helps debugging: if a future copyedit drops one wording, the
specific failing sub-check tells the user exactly what to restore.

## Swap-test proof of invariant authenticity

The invariant test was self-verified against the rev3 (broken)
walkthrough state before this package was finalized. Per the v2.2
standing rule, invariants must demonstrably fail on broken state
to count as authentic (non-tautological):

```
rev3 (broken state):  PASS:  2    FAIL: 15
rev4 (fixed state):   PASS: 17    FAIL:  0
```

The 2 PASSes on rev3 are vacuous: they come from negative
invariants that pass because rev3 lacks the wording the negative
is guarding against (e.g. "no bare findstr :5173" passes vacuously
on rev3 because rev3 has no port check at all). The 15 FAILs on
rev3 are the substantive proof: each FAIL corresponds to a real
preflight gap that rev4 closes.

## Apply procedure

See `apply-order.md`. Summary:

1. Move/replace any non-canonical walkthrough copies; ensure the
   rev4 file lands at:
   `docs/walkthroughs/v2.2-step13-walkthrough.md`
2. Copy the invariant test to `tools/`.
3. Run `node .\tools\test-walkthrough-rev4.mjs` -> expect 17 PASS / 0 FAIL.
4. Re-run the three v2.2 invariant suites for regression check.
5. No build or dev server restart needed.

## Acceptance criteria

- [ ] rev4 walkthrough file at canonical path.
- [ ] test-walkthrough-rev4.mjs at `tools/`.
- [ ] `node .\tools\test-walkthrough-rev4.mjs` returns PASS: 17, FAIL: 0.
- [ ] All three v2.2 invariant suites still PASS / 0 FAIL.
- [ ] Reviewer review of fix package complete (no P0, no P1).

## What this does NOT change

- No application code is touched.
- No build, dev server, or runtime behavior changes.
- v2.2 invariant suites are untouched.
- Scenarios 1, 3, 4, 5 are preserved verbatim from rev3 (Scenario
  2 is the only scenario amended).

## Next steps after absorption

- C2 Aging Report sub-task spec begins.
- v2.4 weekly statement files (if user provides) trigger v2.4 rev6
  spec round in parallel with v2.3 C2/C3/C4 work.
- v2.3 F1 Step 13 hands-on (order_6) will use this rev4 walkthrough
  guide.

## Methodology notes

This package applies the v2.2 standing rules:

- Artifact-grep verification, no memory-based numbers.
- ASCII-only in factual documents.
- Destructive PowerShell commands use safe-first defaults.
- Swap-test proof of invariant authenticity.
- Canonical path for shared documents.
- Reviewer environment passing does not equal user mainline
  passing; verify both.

This is the v2.3 C1 sub-task per the v2.3 Overall Spec rev5
(FROZEN) ordering. Next sub-task: C2 Aging Report.
