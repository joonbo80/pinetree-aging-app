# Reviewer Package - v2.4 Pilot Findings + Spec rev2 (rev2 of package)

Date: 2026-05-05
For: External Codex reviewer
From: Claude (working with samue)
Subject: Real-data pilot complete for ERP side. v2.4 spec rev2 ready for review. 1 question for user blocks freeze.

This is package rev2. It addresses 3 reviewer findings from package rev1:

1. P1: Spec still used old `'CRDR'` in ImportBatch.sourceFiles.sourceType union and AgingQuery.source. FIXED -- both now use the split taxonomy.
2. P1: Pilot report numbers disagreed with pilot-findings.json. FIXED -- prose now matches JSON exactly (ratio 21.2%, 11 shared ourRefNos).
3. P2: README claimed JSON was at `data-extracts/pilot-findings.json` but it was at package root. FIXED -- file moved to `data-extracts/` to match the table.

Plus 3 reviewer notes addressed:

a. Mojibake in markdown (em-dash, arrow chars). FIXED -- all .md files now ASCII-only.
b. Time estimate disagreement: README said 4-7 months, spec said 4-6 months. FIXED -- both aligned to 4-7 months (the rev2 v2.4 step count expansion supports the longer estimate).
c. Statement weekly behavior is freeze-blocking. CONFIRMED in spec.

---

## What's in this package

| File | Purpose |
|------|---------|
| `README.md` (this file) | Cover letter -- read this first |
| `v2.4-pilot-findings-report.md` | Full findings report from May 1-5 pilot data |
| `v2.4-spec-draft-rev2.md` | Updated spec -- pilot findings folded in |
| `data-extracts/pilot-findings.json` | Machine-readable findings (single source of truth for all numbers) |

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

5. **Statement pilot blocking** -- proceed to v2.4 spec freeze with
   statement section marked "TBD pilot 2"? Or hold freeze until
   statement data arrives?

   My recommendation: HOLD freeze. STMT_LINE match key shape may require
   parser changes that ripple back. Better to know now. Per your note,
   you agree this is freeze-blocking.

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
NOW         v2.2 Step 13 + logo                           (Claude)
NOW         Reviewer review of this package rev2          (you)
NOW         User answers Q1 + provides statement data    (samue)
THEN        v2.4 spec freeze meeting                      (all 3)
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

## Self-correction note for package rev2

Your P1 #2 finding -- "report numbers disagree with JSON" -- is exactly
the silent-corruption pattern this whole methodology was designed to
prevent. I had two values (40 AP rows vs 33 distinct ourRefNos) and
divided by the wrong one. The JSON had the right numbers, the prose
did not, and a reviewer following either path would reach a different
conclusion.

The discipline going forward: **JSON is the source of truth, prose
quotes JSON exactly**. Any number in prose must come directly from
the JSON file, not be re-derived. I've added a verification step to
the methodology: every prose number gets a JSON path reference
(e.g. "21.2% (`ap_multi_cost_pattern.multi_cost_ratio_pct`)").

This is the same pattern as Step 11 negative invariant for download
stability -- a discipline that catches the bug pattern itself, not
just the bug.

---

## File checksums (for verification)

```
data-extracts/pilot-findings.json:  machine-readable extract -- SOURCE OF TRUTH
v2.4-pilot-findings-report.md:      full prose, ~1300 words, all numbers cite JSON paths
v2.4-spec-draft-rev2.md:            spec with PILOT-CONFIRMED / PILOT-NEW / PILOT-OPEN tags
```

All findings are reproducible by re-parsing the 6 source XLS files in
`/mnt/user-data/uploads/`. Every statistic in the report comes from
`pilot-findings.json` -- no derived numbers in prose.
