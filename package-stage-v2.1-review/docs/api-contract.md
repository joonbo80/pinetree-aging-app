# AGING APP API Contract (Phase 2 v2.0)

Audience: UI and API engineers working on the Pinetree Express AGING APP.

Current values:

| Field | Current |
|---|---|
| `specVersion` | `1.3.0` |
| `schemaVersion` | `1.1` |
| `parserVersion` | `1.3.0` |

## Payloads

### Raw Phase 1 Parse Result

The Phase 1 parser produces the raw accounting result. It includes full
`transactions[]`, `statements[]`, `rejectedRows[]`, validation details, and
trace metadata. This is the source of truth, but it is not the browser contract.

Phase 1 remains frozen. Phase 2 v2.0 does not modify parser behaviour.

### Parsing Preview Result

The API returns `ParsingPreviewResult` to the UI. It is produced by
`aging-api/src/services/previewTransform.ts`.

Schema `1.0` contained summary fields only. Schema `1.1` keeps all summary
fields and adds optional drill-down details:

```ts
interface ParsingPreviewResult {
  specVersion: string;
  schemaVersion: string;
  parserVersion: string;
  uploadSession: { ... };
  classificationReport: ClassificationResult[];
  reconciliationReport: Record<string, ReconciliationEntry>;
  directionTotals: DirectionTotal[];
  agingBuckets?: AgingBucketSummary[];
  departmentSummary?: DepartmentSummary[];
  topParties?: TopPartySummary[];
  zeroBalance: ZeroBalanceBreakdown;
  validationReport: ValidationReport;
  duplicateReview: DuplicateReview;
  skippedRows: SkippedRows[];
  statementMatchReport: StatementMatchReport;
  reviewCandidates: { local: ReviewCandidate[] };

  // Schema 1.1
  details?: ParsingPreviewDetails;
}

interface ParsingPreviewDetails {
  transactions: PreviewTransaction[];
  reviewItems: ReviewItem[];
  duplicateGroups: DuplicateGroupDetail[];
  statementLinks: StatementLink[];
}
```

## Schema 1.1 Rules

- `details` is optional. UI must check for it before navigating to drill-down
  pages.
- `PreviewTransaction.id` is deterministic and is the FK used by review items,
  duplicate groups, and statement links.
- `PreviewTransaction.rawId` is the Phase 1 UUID for one run only. Do not use it
  for persistence.
- `rawRow` is intentionally excluded from the preview payload.
- `StatementLink.referenceStatus` and `StatementLink.differenceType` preserve the
  raw Phase 1 classification for future filters.
- Strict `NOT_IN_ERP_EXTRACT` review items equal the dashboard count of 7.
- The broader 95 local rows with `referenceStatus: not_in_uploaded_erp_extract`
  remain available through `details.statementLinks`.

## Compatibility

| Client | Server payload | Behaviour |
|---|---|---|
| v1 UI | schema `1.1` | Ignores `details`, summary UI still works |
| v2 UI | schema `1.0` | Summary works; drill-down shows a notice |
| v2 UI | schema `1.1` | Full dashboard click-through and future Review Queue routes enabled |

## Endpoints

### `GET /api/health`

Returns service version and liveness.

### `GET /api/parse-demo`

Returns the committed baseline `ParsingPreviewResult`.

### `POST /api/parse-upload`

Accepts multipart `.xls` / `.xlsx` uploads and returns a
`ParsingPreviewResult`.

Required development header:

```http
X-Aging-Upload-Token: <AGING_UPLOAD_TOKEN>
```

Security and runtime limits:

- busboy multipart parsing
- `.xls` / `.xlsx` only
- PDF rejected in v1.2/v2.0 upload parsing
- 25 MB per file
- 100 MB per request
- 10 files per request
- magic-byte validation
- temp cleanup in `finally`
- Phase 1 worker runs in a child process
- upload token comparison uses `crypto.timingSafeEqual`

Production auth must replace the dev token with Microsoft Entra / Teams SSO.

Runtime config:

```text
AGING_UPLOAD_TOKEN
AGING_PYTHON
AGING_PHASE1_ROOT
```

## Baseline Fixture

Generate schema `1.1` baseline fixtures with:

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
npm.cmd --prefix aging-api run build
node tools/generate-baseline-fixture.mjs
```

The generator writes:

```text
aging-app/src/baselines/phase1-v1.3.0.json
aging-api/src/baselines/phase1-v1.3.0.json
```

The generator validates:

- transaction IDs are unique
- review item FKs resolve
- duplicate group FKs resolve
- statement link FKs resolve
- AGENT 85/85 links are matched
- LOCAL exact signed links are 162
- strict not-in-ERP review count matches dashboard count

## Deferred

- Review Queue rendering is v2.1.
- Party Detail rendering is v2.2.
- SharePoint persistence, memo, settlement, dispatch, and payment history are
  Phase 3+.
- Microsoft Entra / Teams SSO is required before production upload exposure.
