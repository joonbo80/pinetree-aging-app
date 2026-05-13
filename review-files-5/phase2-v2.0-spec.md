# Phase 2 v2.0 Specification

**Status:** FROZEN — 2026-05-02
**Date:** 2026-05-02
**Author:** Claude
**Predecessor:** Phase 2 v1.2.1 (frozen, absorbed to main)
**Successor:** Phase 2 v2.0 implementation begins after this freeze

---

## North Star

> The core of this app is not a pretty dashboard.
> The core is **a trust chain from every number back to the source row**.

Every visible KPI, every count, every total in the UI must be clickable
and traceable to the originating Excel rows. If a number cannot be
explained by pointing at rows in `1.INVOICE_JAN-APR 2026.xls` line 47,
the number does not belong on screen.

This spec exists to lock the data contract that makes that traceability
possible without rebuilding it later.

---

## Non-goals (deferred to v2.1+ or later phases)

- New UI components — this spec is **data contract + routing only**
- SSO / authentication — Phase 3
- SharePoint Lists persistence — Phase 3
- Memo / settlement / dispatch / payment workflow — Phase 3
- Multi-user concerns, audit log — Phase 3
- Dashboard visual polish — out of scope

---

## 1. Data contract: `ParsingPreviewResult` v2

### 1.1 Schema version bump

```
schemaVersion: "1.0"  →  "1.1"
```

UI MUST accept `schemaVersion` `"1.0"` and `"1.1"` (latter has `details`
field, former does not). API SHOULD always emit `"1.1"`.

### 1.2 New top-level field: `details`

```ts
interface ParsingPreviewResultV2 {
  // ... all existing fields preserved (specVersion, schemaVersion,
  // parserVersion, uploadSession, classificationReport,
  // reconciliationReport, directionTotals, zeroBalance, validationReport,
  // duplicateReview, skippedRows, statementMatchReport, reviewCandidates,
  // agingBuckets?, departmentSummary?, topParties?)

  details?: ParsingPreviewDetails;
}

interface ParsingPreviewDetails {
  transactions: PreviewTransaction[];
  reviewItems: ReviewItem[];
  duplicateGroups: DuplicateGroupDetail[];
  statementLinks: StatementLink[];
}
```

`details` is **optional** so any v1.x consumer keeps working. UI
gracefully degrades to summary-only mode if `details` is absent (the
drill-down click handlers show "Detail not available in this build").

### 1.3 `PreviewTransaction`

The unit of drill-down. One per ERP row that contributes to a KPI.

```ts
interface PreviewTransaction {
  // Stable identity
  id: string;                           // e.g. "INVOICE:PEIN018587"
  sourceType: 'INVOICE' | 'CRDR' | 'AP';

  // Party
  partyKey: string;                     // normalized key, e.g. "olbert-metal"
  partyName: string;                    // display name as appears in source
  department: string | null;            // 'OI' | 'OO' | 'AI' | 'AO' | 'GE' | null

  // Amount
  currency: 'USD' | 'CAD';
  rawBalance: number;                   // signed as in source
  signedBalance: number;                // after AP-flip
  absoluteBalance: number;
  direction: 'receivable' | 'payable' | 'settled';
  isZeroBalance: boolean;

  // Dates
  invoiceDate: string | null;           // YYYY-MM-DD
  dueDate: string | null;               // display-only
  postDate: string | null;              // for CRDR/AP
  agingBasisDate: string;               // the date used for aging
  agingDays: number;                    // as-of - agingBasisDate
  agingBucket: '0-30' | '31-60' | '61-90' | '90+';

  // Reference
  refNo: string | null;                 // PEIN###/PECDR###/...
  invoiceNo: string | null;             // for INVOICE/Local Statement match
  vendorName: string | null;            // AP only

  // Trace — the bridge back to Excel
  trace: TransactionTrace;

  // Flags this row triggered (W1, W2, W6, I1, I2, etc.)
  flags: string[];
}

interface TransactionTrace {
  sourceFile: string;                   // "1.INVOICE_JAN-APR 2026.xls"
  sourceSheet: string;                  // "Invoice List - Close Open"
  sourceRow: number;                    // 1-based, as seen in Excel
  // rawRow intentionally not included by default. See §1.7.
}
```

### 1.4 `ReviewItem`

One per row that needs human attention. Unifies all five entry points.

```ts
interface ReviewItem {
  id: string;
  category: ReviewCategory;
  severity: 'critical' | 'warning' | 'info';
  reason: string;                       // human-readable, e.g. "duplicate of AP:29422"
  reasonCode: string;                   // machine-readable, e.g. "W1_DUPLICATE"
  transactionId: string | null;         // FK to PreviewTransaction.id when applicable
  partyKey: string | null;
  currency: 'USD' | 'CAD' | null;
  amount: number | null;
  trace: TransactionTrace | null;       // null for synthetic items (e.g. Local statement row not in ERP)
  details: Record<string, unknown>;     // category-specific extras
}

type ReviewCategory =
  | 'WARNINGS'                          // W1/W2/W6
  | 'AGING_90_PLUS'
  | 'DUPLICATES'
  | 'NOT_IN_ERP_EXTRACT'                // Local statement rows with no ERP match
  | 'UNKNOWN_DEPARTMENT';
```

Same row can appear in multiple categories (e.g. a 90+ aging row that's
also a duplicate). UI MUST de-duplicate by `id` when crossing categories.

### 1.5 `DuplicateGroupDetail`

Extended version of the existing `topGroups` summary. Same shape with
references to actual transaction IDs.

```ts
interface DuplicateGroupDetail {
  identityKey: string;                  // e.g. "AP|29422"
  currency: 'USD' | 'CAD';
  count: number;
  potentialSignedImpact: number;
  transactionIds: string[];             // FK to PreviewTransaction.id
}
```

### 1.6 `StatementLink`

Bridges statement rows to ERP transactions. Used by Party Detail (v2.2).

```ts
interface StatementLink {
  source: 'AGENT' | 'LOCAL';
  sourceFile: string;
  sourceRow: number;
  partyKey: string;
  refNo: string | null;
  invoiceNo: string | null;
  currency: 'USD' | 'CAD';
  statementBalance: number;
  matchedTransactionId: string | null;  // FK or null
  matchType: StatementMatchType;
}

type StatementMatchType =
  | 'EXACT_SIGNED'
  | 'BALANCE_DIFFERENCE'
  | 'OUTSIDE_DATE_RANGE'
  | 'CURRENCY_MISMATCH'
  | 'NO_REFERENCE'
  | 'NOT_IN_ERP_EXTRACT'
  | 'AS_OF_DATE_MISMATCH'
  | 'IDENTITY_MISMATCH'
  | 'SETTLED_AFTER_STATEMENT'
  | 'CHANGED_AFTER_STATEMENT';
```

### 1.7 What is intentionally NOT included

| Excluded | Reason |
|---|---|
| `rawRow: any` (full Excel row data) | Bloats payload. If a UI later needs raw values, it can fetch a single row through `GET /api/upload-session/:id/row/:transactionId` (Phase 3) |
| Computed aging breakdown per transaction | Already implied by `agingBasisDate` + `agingDays`; UI can recompute |
| Statement raw blocks | `StatementLink` is the contract; consumers don't need raw statement text |
| Phase 1 internal validation rules log | Already summarized in `validationReport` |

### 1.8 Payload size envelope (measured)

For the standard 6-file baseline:

| Component | Item count | Size (uncompressed) | After gzip est. |
|---|---:|---:|---:|
| Existing summary fields | — | ~10 KB | ~3 KB |
| `transactions[]` | 1,230 | ~730 KB | ~100 KB |
| `reviewItems[]` | ~250 | ~86 KB | ~12 KB |
| `duplicateGroups[]` | 40 | ~10 KB | ~2 KB |
| `statementLinks[]` | ~439 | ~123 KB | ~17 KB |
| **Total v2 payload** | — | **~960 KB** | **~135 KB** |

Numbers measured against actual baseline (INVOICE 384 + CRDR 346 + AP 500
ERP rows = 1,230, plus 354 local + 85 agent statement refs).

Hard ceiling: if any single response exceeds 5 MB uncompressed, the
parser must split into a session-based pagination model (Phase 3).
Below that threshold, single-payload is correct.

### 1.9 Why one-shot is the right call here

The reviewer's reasoning was correct and worth restating:

1. **Internal use, ~1300 rows** — payload is small even uncompressed
2. **Same data needed by 3 features** — Review Queue, Dashboard
   drill-downs, Party Detail all read from the same `transactions[]`.
   Three round trips is worse than one.
3. **Session endpoints are a Phase 3 problem** — they belong with auth +
   persistence, not before
4. **UI iteration speed matters now** — single-payload removes a whole
   class of "did the right session get loaded?" bugs during dev
5. **Baseline mode parity** — bundled fallback is the same shape as live
   API response, so dev/test never diverges from runtime

---

## 2. Review Queue — five entry points

Dashboard cards become buttons. Clicking a number navigates to a list
view filtered by that category.

### 2.1 Routes

```
/dashboard                    Existing landing page (post-Confirm-Import)
/review                       Review queue index (all 5 categories)
/review/warnings
/review/aging-90-plus
/review/duplicates
/review/not-in-erp-extract
/review/unknown-department
/party/:partyKey              Party detail (v2.2 — included in this spec for routing freeze)
```

All routes are inside the existing `BrowserRouter`.
Each `/review/:category` shows a `ReviewItem[]` filtered by category.

### 2.2 Row-unit definition per category

This is where most ambiguity lives. Pinning each:

| Category | Row unit | Source |
|---|---|---|
| `WARNINGS` | One row per `validationReport.warnings[].count` underlying transaction. Each row carries `reasonCode` (`W1_DUPLICATE`, `W2_USD_AND_CAD`, `W6_AP_NEGATIVE`) | derived from rule firing |
| `AGING_90_PLUS` | One row per ERP transaction with `agingBucket === '90+'` AND `direction !== 'settled'` | derived from `transactions[]` |
| `DUPLICATES` | One row per transaction inside a duplicate group. Group header rows shown separately as visual section breaks; the data unit is the transaction. | derived from `duplicateGroups[].transactionIds[]` |
| `NOT_IN_ERP_EXTRACT` | One row per Local statement row with `matchType === 'NOT_IN_ERP_EXTRACT'`. Total: 7 from current baseline. | derived from `statementLinks[]` |
| `UNKNOWN_DEPARTMENT` | One row per ERP transaction whose normalized department is `null` or `'UNKNOWN'`. | derived from `transactions[]` |

### 2.3 Display columns per category

All five share a base set; some extend.

**Base columns (always shown):**
- Party (link to `/party/:partyKey`)
- Source (file · sheet · row)
- Currency
- Amount (signed)
- Reason
- Aging (days, bucket)

**Category-specific extras:**
| Category | Extra columns |
|---|---|
| WARNINGS | Reason code (W1/W2/W6) badge |
| AGING_90_PLUS | Days past due, due date |
| DUPLICATES | Group identity key, group size, group impact |
| NOT_IN_ERP_EXTRACT | Statement file, invoice no |
| UNKNOWN_DEPARTMENT | Raw department string from source |

### 2.4 Sort and filter

**Default sort per category** (most useful first):

| Category | Default sort |
|---|---|
| WARNINGS | Severity desc, then absolute amount desc |
| AGING_90_PLUS | Aging days desc |
| DUPLICATES | Group impact desc |
| NOT_IN_ERP_EXTRACT | Invoice date desc |
| UNKNOWN_DEPARTMENT | Absolute amount desc |

**v2.1 ships:** column sort by click, currency filter (USD/CAD/All).
**Deferred to v2.2:** date range filter, party search, free-text filter, multi-column sort.

### 2.5 Export

CSV export per category, same columns as on screen. Already shipped for
review candidates in v1.0; pattern extends to all five.

---

## 3. Party detail view (v2.2 — routing reservation only)

This spec reserves the route and identity model for v2.2 but does not
specify the full UI yet. v2.2 will have its own spec.

### 3.1 `partyKey` normalization

```
"OLBERT METAL"        → "olbert-metal"
"Olbert Metal Ltd."   → "olbert-metal"
"FedEx Freight Canada" → "fedex-freight-canada"
```

Algorithm:
1. Lowercase
2. Strip common suffixes: `ltd`, `ltd.`, `inc`, `inc.`, `corp`, `corp.`, `co`, `co.`
3. Replace whitespace and punctuation with `-`
4. Collapse multiple `-` to single
5. Trim leading/trailing `-`

Edge case: empty result → `partyKey: 'unknown-party'`. UI must handle.

The Phase 1 engine has manual alias table support (locked in original
freeze). Aliases are applied **before** normalization.

### 3.2 Party detail responsibilities (preview)

- Aggregate `transactions` filtered by `partyKey`
- Group by currency (USD/CAD never combined)
- Show aging buckets per currency
- List all ERP transactions
- List all StatementLinks for this party
- Highlight 90+ rows

Detailed UI spec is v2.2's job. Routing and `partyKey` model are frozen
here so v2.1 drill-down rows can link out correctly.

---

## 4. Baseline JSON fixture

The bundled `phase1-v1.3.0.json` must be extended to include `details`
so UI development and demo flows exercise drill-down without a live API.

### 4.1 Generation strategy

The fixture is generated **once** by running the Phase 1 raw output
through the new `previewTransform.ts` projection. The output is
committed to the repo.

```
generation flow:

  baselines/phase1-v1.3.0/raw-result.json
            (full Phase 1 raw output, already exists)
                              ↓
          previewTransform.ts (new in v2.0)
                              ↓
   summary fields  +  details: { transactions, reviewItems,
                                 duplicateGroups, statementLinks }
                              ↓
  aging-app/src/baselines/phase1-v1.3.0.json   (committed)
  aging-api/src/baselines/phase1-v1.3.0.json   (mirror, committed)
```

Two important properties of this approach:

1. **Phase 1 is not modified.** The same `raw-result.json` that the
   Phase 1 freeze produces is the input. v2.0 is a pure projection
   layer above Phase 1.

2. **Single source of truth for the projection.** The same
   `previewTransform.ts` is used in three places:
   - Tools: generating the committed baseline fixture
   - API runtime: `GET /api/parse-demo` and `POST /api/parse-upload`
   - Tests: any unit test that wants a known transformation

   This means the bundled fallback JSON and the live API response are
   guaranteed to be the same shape — no drift between dev and runtime.

### 4.2 Where the generation lives

```
tools/generate-baseline-fixture.mjs

  Reads:  baselines/phase1-v1.3.0/raw-result.json
  Imports: aging-api/src/services/previewTransform.ts (compiled)
  Writes: aging-app/src/baselines/phase1-v1.3.0.json
          aging-api/src/baselines/phase1-v1.3.0.json
```

Run as a one-shot script. Re-run only when the source data set or
`previewTransform.ts` changes (rare). Both writes are idempotent.

### 4.3 Compatibility check

The generated baseline must satisfy:

```ts
function isValidV2Baseline(json: unknown): boolean {
  if (json.schemaVersion !== '1.1') return false;
  if (!json.details) return false;

  const ids = new Set(json.details.transactions.map(t => t.id));

  // every reviewItem.transactionId resolves
  for (const r of json.details.reviewItems) {
    if (r.transactionId !== null && !ids.has(r.transactionId)) return false;
  }
  // every duplicateGroup.transactionIds resolves
  for (const g of json.details.duplicateGroups) {
    if (!g.transactionIds.every(id => ids.has(id))) return false;
  }
  // every statementLink.matchedTransactionId resolves (or is null)
  for (const s of json.details.statementLinks) {
    if (s.matchedTransactionId !== null && !ids.has(s.matchedTransactionId)) return false;
  }
  return true;
}
```

A small validator script runs as the last step of fixture generation
and refuses to commit an invalid file.

---

## 5. Backwards compatibility

### 5.1 v1.x clients receiving v2 payload

v1.x UI ignores unknown fields. `details` is silently dropped. No break.

### 5.2 v2.0 UI receiving v1.x payload

Click handlers on Dashboard cards check:

```ts
if (!result.details) {
  // show "Drill-down not available — server is v1.x" notice
  return;
}
navigate(`/review/${category}`);
```

Cards remain visible (numbers still meaningful), but become non-clickable.

### 5.3 Schema version dispatch

`apiClient.parseDemo()` reads `schemaVersion` and:
- `"1.0"` → log warning, treat as v1
- `"1.1"` → full v2 features
- anything else → log warning, treat as v1.0 superset

---

## 6. Acceptance criteria for v2.0 spec freeze

This spec is considered frozen when:

- [x] Five frozen decisions documented (§8) — DONE
- [ ] `ParsingPreviewResult` v2 type definition committed to
      `aging-app/src/parsing-engine/types.ts`
- [ ] `details: undefined` confirmed safe in current Dashboard render
      (graceful degradation for v1.x baselines)
- [ ] Five route placeholders exist in router (return "Not implemented yet")
- [ ] `partyKey` normalization function committed to a shared location
      (e.g. `aging-app/src/utils/partyKey.ts`) and unit-tested with the
      examples in §8.2
- [ ] `previewTransform.ts` extended to produce `details` block in
      `aging-api`
- [ ] `tools/generate-baseline-fixture.mjs` written and run; resulting
      v2 baseline JSON committed to both `aging-app` and `aging-api`
- [ ] Baseline validator (§4.3) passes on the committed fixture
- [ ] Schema version dispatch in `apiClient` committed
- [ ] `docs/api-contract.md` updated with v2 schema, payload envelope,
      and v1↔v2 compatibility rules
- [ ] No new UI components beyond placeholder routes

After freeze, v2.1 implementation begins (Review Queue actual rendering
+ Dashboard click handlers).

---

## 7. Implementation order after freeze

Following the reviewer's suggested order:

```
v2.0 spec freeze              (this document — frozen 2026-05-02)
  ↓
v2.0 implementation           (type + projection + routing skeleton)
  │
  │  Step 1 — Types
  │  └ aging-app/src/parsing-engine/types.ts
  │      ├ ParsingPreviewResult.details (optional)
  │      ├ PreviewTransaction
  │      ├ ReviewItem + ReviewCategory
  │      ├ DuplicateGroupDetail
  │      └ StatementLink + StatementMatchType
  │
  │  Step 2 — partyKey normalizer
  │  └ aging-app/src/utils/partyKey.ts (+ unit tests)
  │
  │  Step 3 — previewTransform
  │  └ aging-api/src/services/previewTransform.ts
  │      Extended to project raw Phase 1 output → details block
  │
  │  Step 4 — Baseline fixture
  │  └ tools/generate-baseline-fixture.mjs
  │      Run once, commit output to both baselines folders
  │      Validator (§4.3) gates the commit
  │
  │  Step 5 — apiClient schema dispatch
  │  └ aging-app/src/api/client.ts
  │      Read schemaVersion, log warning on unknown
  │
  │  Step 6 — Router placeholders
  │  └ /review, /review/:type, /party/:partyKey
  │      All return "Not implemented in v2.0" page
  │
  │  Step 7 — Dashboard click handlers (placeholders)
  │  └ Five cards become navigable; if details absent, show notice
  │
  │  Step 8 — Documentation
  │  └ docs/api-contract.md schema 1.1 section
  │
  ↓
v2.1 Review Queue UI (actual rendering)
  ├ /review index
  ├ 5 category list views with base columns
  ├ Currency filter, default sort per §2.4
  ├ CSV export per category
  └ Dashboard cards now show real lists on click
  ↓
v2.2 Party Detail UI (own spec when v2.1 lands)
  └ /party/:partyKey full view
  ↓
v3.x Persistence (memo/settlement/dispatch/payment, SharePoint Lists)
v3.x SSO (deferred from v1.3)
```

Each numbered step in v2.0 implementation is independently committable.
The whole v2.0 freeze package can ship as one PR or split — but the
type definition (Step 1) MUST land before any other step.

---

## 8. Frozen decisions

The five open questions from the draft are resolved as follows.

### 8.1 Details generation lives in the API server, not Phase 1

`previewTransform.ts` (already exists in v1.2.x) is extended to produce
`details`. The Phase 1 parsing engine is **NOT modified**.

**Rationale:** Phase 1 is a frozen, well-tested boundary. v2.0 is a UI
projection concern, not a parser concern. Forcing Phase 1 to emit
details would expand the verification surface unnecessarily and
re-open a stable component.

Concretely:
- Phase 1 keeps emitting its current "raw parse result" (with full
  `transactions[]`, `statements[]`, `rejectedRows[]`)
- `previewTransform.ts` reads that raw result and produces both the
  existing summary fields **and** the new `details` block
- Phase 1 never sees `PreviewTransaction`, `ReviewItem`, etc. — those
  types are owned by the API/UI layer

### 8.2 `partyKey` normalization — Korean and English suffixes

Suffix list (case-insensitive, applied before normalization):

| Origin | Suffixes |
|---|---|
| English | `INC`, `LTD`, `CORP`, `CO`, `LLC` (with optional trailing `.`) |
| Korean | `(주)`, `주식회사`, `(유)`, `유한회사` |

**Important constraint:** `partyKey` is for **UI routing only**.
Two transactions sharing a `partyKey` MUST NOT be auto-merged for
accounting purposes. Any business-level "is this the same party"
decision goes through the manual alias table that already exists in
the Phase 1 freeze.

Normalization algorithm:
1. Strip Korean suffixes (literal match): `(주)`, `주식회사`, `(유)`, `유한회사`
2. Strip English suffixes (case-insensitive, with optional `.`):
   `INC`, `LTD`, `CORP`, `CO`, `LLC`
3. Lowercase
4. Replace whitespace and punctuation with `-`
5. Collapse multiple `-` to single
6. Trim leading/trailing `-`
7. Empty result → `'unknown-party'`

Examples:
```
"OLBERT METAL"             → "olbert-metal"
"Olbert Metal Ltd."        → "olbert-metal"
"FedEx Freight Canada"     → "fedex-freight-canada"
"파인트리익스프레스(주)"   → "파인트리익스프레스"
"주식회사 ABC"             → "abc"
"(유)한국물류"             → "한국물류"
""                         → "unknown-party"
```

### 8.3 `agingBucket` is baked into `PreviewTransaction`

Computed once in `previewTransform.ts`, never recomputed in UI or
exports. Single source of truth.

### 8.4 Dates: ISO `YYYY-MM-DD`, no time, no timezone

All date fields in v2 use `YYYY-MM-DD` strings. No timezone offset.
No time component. Aging is computed in days only.

If a source field carries a time component, it is stripped during
parse. If a source field lacks a date component, it is `null`.

### 8.5 Baseline fixture is committed to repo

The generated v2 baseline JSON is committed to:
```
aging-app/src/baselines/phase1-v1.3.0.json
aging-api/src/baselines/phase1-v1.3.0.json   (mirror)
```

UI development and external cross-review do not require Phase 1 engine
or Python runtime — open the repo, `npm install`, run.

The generator (`tools/generate-baseline-fixture.mjs`) is also committed
but only re-run when source data changes.

---

## 9. Reviewer notes box

(Reviewer to fill in.)

| # | Reviewer comment | Resolution |
|---|---|---|
|   |   |   |
