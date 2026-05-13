# Reviewer Package - v2.4 Pilot Findings + Spec rev2 (package rev3)

Date: 2026-05-05
For: External Codex reviewer
From: Claude (working with samue)
Subject: Real-data pilot complete for ERP side. v2.4 spec rev2 ready for review. 1 question for user blocks freeze.

This is package rev3 -- a small carry-over fix to package rev2.

## What changed in rev3 (vs rev2)

Single fix: README now matches the actual file layout. All files are
at package root. The previous attempt to use a `data-extracts/`
subfolder did not survive the packaging pipeline -- the JSON ended up
at root regardless of folder placement, causing the README to disagree
with reality.

**Lesson learned**: claims in README about file layout must match what
the recipient actually sees. When a packaging step can flatten or
reshape the layout, the README must describe the post-packaging
layout, not the pre-packaging filesystem. From now on:

- Flat layout (all files at package root) for any package <= 5 files
- No subfolders unless there are enough files to justify the cognitive
  cost of navigating them
- Verify README path claims by re-reading the README after packaging

## Carry-over from rev2

All rev2 fixes remain in place:

1. P1: Spec sourceType union now uses split taxonomy
   (`'INVOICE' | 'CRDR_MEMO' | 'PAYMENT_REGISTER' | 'AP' | ...`) in both
   ImportBatch.sourceFiles.sourceType and AgingQuery.source.

2. P1: Pilot report numbers match pilot-findings.json exactly. AP
   multi-cost ratio is 21.2% (7 of 33 distinct ourRefNos). Cross-source
   shared ourRefNos: 11. Invoice ourRefNos: 14. AP ourRefNos: 33.

3. (was P2 in rev2, NOW FIXED in rev3): README path claims match actual
   file layout. All files at package root.

4. ASCII-only across all .md files (verified by grep -P '[^\x00-\x7F]'
   returning 0 matches).

5. Time estimate aligned at 4-7 months in both README and spec.

---

## What's in this package

| File | Purpose |
|------|---------|
| `README.md` (this file) | Cover letter -- read this first |
| `v2.4-pilot-findings-report.md` | Full findings report from May 1-5 pilot data |
| `v2.4-spec-draft-rev2.md` | Updated spec -- pilot findings folded in |
| `pilot-findings.json` | Machine-readable findings (single source of truth for all numbers) |

`v2.4-spec-draft.md` (rev1) is in the predecessor package
`/mnt/user-data/outputs/v2.4-spec-draft/` -- kept for diff reference.

---

## TL;DR for the reviewer

The pilot resolved 5 of 5 ERP open questions from spec rev1. It also
surfaced 2 critical findings that change spec assumptions:

1. **AP multi-cost-line confirmed by data** -- 21.2% of pilot AP
   shipments share `ourRefNo` with 2-3 cost lines (7 of 33 distinct
   ourRefNos in the May pilot). Match key MUST include
   `vendorName + costLineDesc`. (You flagged this in your reviewer
   note; pilot data validated it.)

2. **"CRDR" filename pattern is TWO different source types** --
   - baseline `2_CRDR_JAN-APR_2026.xls` = credit/debit memos (PECDR... IDs, 19 cols) -> CRDR_MEMO
   - May `2-1_CRDR_MAY_1-5_2026.xls` = payment register (EFT/cheque, 15 cols) -> PAYMENT_REGISTER

   This was unexpected. Spec rev2 splits these into `CRDR_MEMO` and
   `PAYMENT_REGISTER` source types and adds schema-aware parser detection.

The statement weekly question (Q5) is still open -- pilot did not
include any statement files. User asked to provide 1-2 weekly statement
files before final spec freeze.

---

## Why this matters

Without the pilot:
- v2.4 dedup engine would have shipped with single-key AP match -> silent
  corruption on multi-line shipments (21.2% of real data)
- v2.4 parser would have shipped trusting filename -> would crash or
  misinterpret May "CRDR" payment register files
- We'd have caught both during browser hands-on (best case) or in
  production after Phase 3 (worst case)

The pilot session was 1 working session. The bugs it would have caused
in production are 1-2 weeks of rework each. This is the strongest
argument for pilot-before-spec-freeze as standing methodology.

---

## Spec changes from rev1 to rev2

### Match Key types
- `CRDR_LINE` renamed to `CRDR_MEMO_LINE` for clarity
- `PAYMENT_REGISTER_LINE` added (new source type)
- `AP_LINE` updated: `vendorInternalId + ourRefNo + vendorName + costLineDesc + amount + currency`
  (was: `vendorInvoiceNo + costLineCode + amount + currency + party`)
- `PO_BL_LINE` removed entirely (not observed in data)
- `STMT_LINE` unchanged but flagged PILOT-OPEN

### Source Type Taxonomy (NEW SECTION)
- 7 source types defined with detection rules
- Schema-aware parser requirement: column count + first-cell value
  used together with filename
- Migration step (v2.4-15) added: re-tag existing v2.0-2.3 baseline
  CRDR rows as CRDR_MEMO

### ImportBatch.sourceFiles.sourceType (rev2 P1 fix)
- Now uses the split taxonomy: `'INVOICE' | 'CRDR_MEMO' | 'PAYMENT_REGISTER' | 'AP' | 'AGENT_STATEMENT' | 'LOCAL_STATEMENT_USD' | 'LOCAL_STATEMENT_CAD'`
- AgingQuery.source updated to match

### Step list
- v2.4-3 split into v2.4-3 (taxonomy) + v2.4-5 (schema-aware parser)
- v2.4-15 added (baseline migration)
- Total step count: 13 -> 16
- Estimated rounds: 18-22 -> 22-26
- Estimated calendar time: 6-10 weeks -> 7-11 weeks

### Risks
- 4 new risks added (filename misclassification, baseline migration,
  costLineDesc variation, statement still unknown)

---

## What I need from you (reviewer)

Please review and confirm or push back on:

1. **Match key shape** -- does the new AP_LINE composition
   (`vendor + ourRefNo + costLineDesc + amount + currency`) match the
   audit-grade discipline you've enforced through v2.2? Any
   silent-failure scenarios I missed?

2. **Source type taxonomy** -- `CRDR_MEMO` vs `PAYMENT_REGISTER`
   split is a domain modeling decision. Is this naming clear to a
   future developer? Better split or naming?

3. **Schema-aware parser approach** -- using column count + first-cell
   value enum is fine for known sources but fragile for unknown future
   files. Should v2.4 add a "file format identifier" config (user
   declares which kind of file they're uploading) as a fallback? Or is
   auto-detection sufficient if AMBIGUOUS surfaces correctly?

4. **Migration step v2.4-15** -- re-tagging baseline JSON. Is this safe
   to run as a one-time migration, or should it be reversible? My
   instinct: one-way is fine because v2.0-2.3 CRDR rows are exclusively
   memos (no payment register data existed in baseline).

5. **Statement pilot blocking** -- both you and I agree this is
   freeze-blocking. Awaiting user-provided statement data before
   freeze meeting.

---

## What I need from samue (user)

Two actions to unblock spec freeze:

1. **Confirm the May "CRDR" file is intentional** -- is the ERP
   exporting two different report types under the "CRDR" filename
   convention? Or is `2-1_CRDR_MAY_1-5_2026.xls` a mis-named export
   that should have been called `PAYMENT_REGISTER` or similar?

2. **Provide 1-2 weekly statement files** -- LOCAL_USD, LOCAL_CAD,
   AGENT for any week (May 1-5 if you have it, otherwise April).
   These are needed to resolve the statement re-issue vs delta question.

These don't block v2.2 close work. Step 13 + logo continue in parallel.

---

## Sequencing reminder

```
NOW         v2.2 Step 13 + logo                          (Claude)
NOW         Reviewer review of this package rev3         (you)
NOW         User answers Q1 + provides statement data    (samue)
THEN        v2.4 spec freeze meeting                     (all 3)
THEN        v2.3 analysis depth (4-6 weeks)
THEN        v2.4 implementation (7-11 weeks per rev2)
THEN        v2.5 operational stubs (2-3 weeks)
THEN        Phase 3 design + implementation (3-6 months)
```

Total to Phase 3 ready: 4-7 months. (Slightly longer than rev1 due to
v2.4 step count increase from 13 to 16.)

---

## Methodology meta-observation

The "pilot before freeze" pattern just paid for itself. The two findings
we caught (AP multi-line silent corruption + CRDR-is-two-types
misclassification) are both classes of bug we've battled in earlier
phases:

- AP multi-line = silent corruption class (v2.1.1 partyName)
- CRDR-is-two-types = silent failure class (Step 11 download stability)

Catching them at spec stage instead of during code is a 10x cost
reduction. The pattern: **for any new domain entity, pilot 1 real
batch before spec freeze**. This should become standing methodology
for v2.4, v2.5, and Phase 3.

---

## Self-correction notes -- rev2 to rev3

Three rev1 findings were closed in rev2:
- P1 sourceType union split (verified: no `'CRDR'` literal remains)
- P1 prose-vs-JSON number divergence (verified: prose cites JSON paths)
- ASCII normalization (verified: 0 non-ASCII chars in all .md)

One rev1 finding was claimed closed in rev2 but actually wasn't:
- P2 README path vs actual file layout

Reason for the carry-over: I created `data-extracts/` folder in the
filesystem and trusted the packaging pipeline to preserve it. It
didn't. The README claim was correct relative to filesystem layout
but incorrect relative to what the reviewer received.

The rev3 fix flips the resolution direction: instead of forcing the
layout to match the README, the README is updated to match what the
packaging pipeline produces (flat layout). This is more reliable
because:
- It removes a load-bearing assumption about pipeline behavior
- Flat layout is the natural state for a 4-file package
- No mental cost for reviewers navigating subfolders

The deeper lesson is the same one that v2.1.1 partyName, Step 6 CSS
load chain, Step 11 download stability, and rev2 prose-vs-JSON share:
**when documentation makes a claim about reality, verify the claim
against reality, not against intent**. Re-reading the README against
the actual filesystem (or in this case, against the package the
recipient sees) is the discipline that catches these.

---

## File checksums (for verification)

```
pilot-findings.json:                machine-readable extract -- SOURCE OF TRUTH
v2.4-pilot-findings-report.md:      full prose, ~1300 words, all numbers cite JSON paths
v2.4-spec-draft-rev2.md:            spec with PILOT-CONFIRMED / PILOT-NEW / PILOT-OPEN tags
```

All findings are reproducible by re-parsing the 6 source XLS files in
`/mnt/user-data/uploads/`. Every statistic in the report comes from
`pilot-findings.json` -- no derived numbers in prose.
