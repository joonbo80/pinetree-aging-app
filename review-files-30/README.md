# Reviewer Package - v2.4 Pilot Findings + Spec rev4 (rollback)

Date: 2026-05-05
For: External Codex reviewer
From: Claude (working with samue)
Subject: Rollback of PAYMENT_REGISTER hypothesis. May CRDR confirmed same source type as baseline. AP multi-line finding retained.

---

## What this rev4 package is

This package supersedes rev3. It is a ROLLBACK of the
CRDR-is-two-types hypothesis introduced in rev2 and confirmed in rev3.

The hypothesis was based on a wrongly-uploaded file. The user
identified the upload mistake and re-uploaded the actual May CRDR
file. Re-analysis shows May CRDR is the SAME source type as baseline
CRDR (19 columns, PECDR sequence continuous, identical schema).

PAYMENT_REGISTER source type is REMOVED from spec.
PAYMENT_REGISTER_LINE match key is REMOVED.
v2.0-2.3 baseline migration step is REMOVED.

The AP multi-line finding (21.2% multi-cost shipments) is RETAINED.
It was independently confirmed in the AP file and was not affected
by the CRDR upload mistake.

---

## What's in this package

| File | Purpose |
|------|---------|
| `README.md` (this file) | Cover letter -- read this first |
| `v2.4-pilot-findings-report.md` | Findings report rev4 (rollback) |
| `v2.4-spec-draft.md` | Spec rev4 (rolled back to single CRDR) |
| `pilot-findings.json` | Machine-readable findings (regenerated from correct May CRDR file) |

---

## What changed in rev4 vs rev3

7 rollback items (per reviewer note):

1. PAYMENT_REGISTER source type removed.
2. PAYMENT_REGISTER_LINE match key removed.
3. CRDR_MEMO vs PAYMENT_REGISTER split section removed.
4. Source Type Taxonomy simplified to 6 types (was 7 in rev3).
5. Step v2.4-15 (baseline migration) removed.
6. Step count returned to 13. Calendar 6-10 weeks (rev1 estimate).
7. Methodology section adds two new rules:
   - Verify file source before introducing new source type
   - Reduce silent-corruption windows (rollback immediately on rejection)

---

## Why this rollback matters NOW

Reviewer's argument for immediate rollback (paraphrased to ASCII):

> "If rev3 stays in the package while we wait for statement data,
> the next reviewer or developer may treat PAYMENT_REGISTER as a
> real requirement."

A wrong hypothesis sitting in a draft spec is a silent-corruption
window. The longer it sits, the more likely a downstream reader
treats it as confirmed. rev4 closes the window immediately, even
though we're still waiting on statement data.

---

## Numbers verified against pilot-findings.json

Same numbers as rev2/rev3 except where rev4 explicitly differs:

UNCHANGED:
- AP multi-cost ratio: 21.2% (7 of 33 distinct ourRefNos)
- INVOICE-AP shared ourRefNos: 11
- INVOICE distinct ourRefNos: 14
- AP distinct ourRefNos: 33
- All ERP internalId / businessId / date overlap: 0 (DELTA confirmed)

NEW IN rev4 (real May CRDR data):
- CRDR pilot rows: 17 (was 7 in the wrongly-uploaded file)
- CRDR pilot columns: 19 (was 15 in the wrongly-uploaded file)
- CRDR business ID: PECDR016798-016815 (continuous from baseline 016797)
- CRDR internalId: 14117-14134 (continuous from baseline 14116)
- CRDR-AP shared ourRefNos: 9
- INVOICE-CRDR shared ourRefNos: 2

---

## What I need from you (reviewer)

1. **Confirm the rollback is complete** -- spec rev4 should have NO
   PAYMENT_REGISTER references except in the rollback note.
2. **Confirm the AP multi-line finding is preserved** -- rev4 must
   not lose the 21.2% finding when removing PAYMENT_REGISTER.
3. **Confirm the methodology additions are useful** -- the two new
   rules (verify-before-new-source-type, immediate-rollback) are
   added to the spec methodology section.
4. **Approve the corrected spec for next-step work** -- once approved,
   v2.2 close work and statement pilot can continue while v2.4 stays
   in rev4 stable state.

---

## What I need from samue (user)

Single remaining blocker for v2.4 spec freeze:

1. **Provide 1-2 weekly statement files** -- LOCAL_USD, LOCAL_CAD,
   AGENT for any week. These resolve the statement re-issue vs delta
   question. Once resolved, v2.4 can freeze.

The May "CRDR" file question is now resolved: it's the same source
type as baseline.

---

## Sequencing reminder

```
NOW         v2.2 Step 13 + logo                          (Claude)
NOW         Reviewer review of rev4 rollback             (you)
LATER       User provides statement data                 (samue)
THEN        v2.4 spec freeze meeting                     (all 3)
THEN        v2.3 analysis depth (4-6 weeks)
THEN        v2.4 implementation (6-10 weeks per rev4)
THEN        v2.5 operational stubs (2-3 weeks)
THEN        Phase 3 design + implementation (3-6 months)
```

Total to Phase 3 ready: 4-7 months.

---

## Methodology meta-observation

The rev2->rev4 rollback teaches a lesson that is worth standing-rule
status:

**When a finding seems to suggest a new domain entity (new source
type, new match key, new schema variant), verify with the user that
the uploaded file is the intended source before proceeding to spec
changes.**

This belongs to the same family of rules as:
- v2.1.1 partyName: code intent vs runtime reality
- Step 6 CSS load chain: build intent vs deployed reality
- Step 11 download stability: revoke intent vs browser reality
- rev2 prose vs JSON: prose intent vs source-of-truth reality
- rev3 README path: filesystem intent vs packaging reality
- rev4 PAYMENT_REGISTER: pilot intent vs real source data

In each case, documentation makes a claim about reality, and the bug
is caught only by verifying the claim against reality (not against
intent). The verification step in rev4's case is one ASCII line: "is
this the file you meant to upload?"

I should have asked that question before introducing PAYMENT_REGISTER.
The cost of asking is one user message; the cost of not asking was
two full revs (rev2 + rev3 carrying the wrong hypothesis) and a third
rev (this one) to roll back.

This rule is now in the v2.4 spec methodology section under "Verify
the file before introducing a new source type."

---

## File checksums

```
pilot-findings.json:                regenerated from correct May CRDR
v2.4-pilot-findings-report.md:      rev4, all numbers cite JSON paths
v2.4-spec-draft.md:                 rev4, PAYMENT_REGISTER removed
```

All findings are reproducible by re-parsing the 6 source XLS files
in `/mnt/user-data/uploads/`.
