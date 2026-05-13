# AGING APP — API Contract (Phase 2 v1.1)

**Audience:** UI engineers and API engineers working on the Pinetree
Express AGING application. Read this before changing either side.

---

## Versioning

Three independent version numbers. They are **not** the same thing.

| Version | What it means | Location |
|---------|---------------|----------|
| `specVersion` | Phase 1 parsing engine specification | `phase1_final_freeze.pdf` |
| `schemaVersion` | Shape of the JSON exchanged on the wire | This document |
| `parserVersion` | Implementation version of the Phase 1 parser | API server build |

Current values: `specVersion: 1.3.0`, `schemaVersion: 1.0`, `parserVersion: 1.3.0`.

---

## Two distinct payloads (do not confuse)

### 1. Raw Phase 1 Parse Result

What the Phase 1 engine actually produces. Contains:

```ts
{
  specVersion, schemaVersion, parserVersion,
  uploadSession: { ... },

  // The big arrays — *not* sent to the UI
  transactions: Transaction[],            // every parsed row
  statements: Statement[],                // every parsed statement block
  rejectedRows: RejectedRow[],            // rows the parser refused

  // Summary blocks
  classificationReport, reconciliationReport,
  validationReport, duplicateReview, ...
}
```

This is the source of truth. It can be 5–50 MB depending on input size.

### 2. Parsing Preview Result (the `ParsingPreviewResult` type)

What the API returns to the UI. This is **summary-only** — designed for
the Upload + Parsing Preview screen which shows totals, badges, and
the 7 review candidates.

```ts
{
  specVersion, schemaVersion, parserVersion,
  uploadSession: { ... },
  classificationReport: ClassificationResult[],
  reconciliationReport: { INVOICE, CRDR, AP, ... },
  directionTotals: DirectionTotal[],
  zeroBalance: ZeroBalanceBreakdown,
  validationReport: { critical[], warnings[], info[] },
  duplicateReview: { groupCount, transactionCount, topGroups[] },
  skippedRows: { sourceType, reason, count }[],
  statementMatchReport: { agent, local },
  reviewCandidates: { local: ReviewCandidate[] }
}
```

**No** raw `transactions`, `statements`, `rejectedRows` arrays. Those stay
on the server and are surfaced through future endpoints (drilldown,
rejected-row export, etc.).

The full TypeScript shape is in
`aging-app/src/parsing-engine/types.ts` as `ParsingPreviewResult`.

---

## API server responsibility

The API server receives raw Phase 1 output and projects it down to
`ParsingPreviewResult` before responding. The conversion layer:

1. Counts critical / warning / info entries (drops verbose details).
2. Picks the top-10 duplicate groups by absolute impact.
3. Filters review candidates down to the 7 `NOT_IN_UPLOADED_ERP_EXTRACT` rows.
4. Excludes raw `transactions`, `statements`, `rejectedRows` arrays.

This conversion is **not yet implemented** — `/api/parse-demo` simply
serves the frozen baseline JSON which is already in preview form. The
conversion layer is added in v1.2 alongside `POST /api/parse-upload`.

---

## Endpoints

### `GET /api/health`

Returns `200 OK`. Used by the UI on boot to set the API ONLINE / OFFLINE
indicator.

```json
{
  "status": "ok",
  "service": "aging-api",
  "version": "1.1.0",
  "specVersion": "1.3.0",
  "parserVersion": "1.3.0",
  "uptime": 42,
  "timestamp": "2026-05-01T19:45:05.710Z"
}
```

Failure modes: server down, network error, CORS rejection. UI treats any
non-200 as offline and silently uses bundled fallback.

---

### `GET /api/parse-demo`

Returns `200 OK` with a `ParsingPreviewResult` body. Always represents
the frozen Phase 1 baseline.

Headers:

```
Content-Type: application/json
X-Aging-Source: api-baseline
```

The UI reads `X-Aging-Source` (and the simple "did this fetch succeed?"
signal) to label the data origin in the Readiness panel.

Failure modes: 500 if the baseline JSON cannot be loaded. UI falls back
to the bundled copy — same data, different label (`SOURCE · FALLBACK`).

---

### `POST /api/parse-upload`  (501 in v1.1)

**v1.1:** returns `501 Not Implemented`.

```json
{
  "error": "Upload parsing not implemented in this build",
  "code": "NOT_IMPLEMENTED",
  "detail": "Phase 2 v1.1 ships /api/parse-demo only. Live parsing of .xls/.xlsx is planned for v1.2."
}
```

**v1.2 design (target):**

- Multipart upload via `busboy` (no hand-rolled multipart parsing)
- Per-file size limit: 25 MB; per-request total: 100 MB
- Accepted: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/pdf`
- Server-side run of the Phase 1 engine
- Convert raw result → `ParsingPreviewResult`
- Response: `200 OK` with `ParsingPreviewResult` body
- Error responses follow the shape:

```json
{ "error": "string", "code": "STRING_CODE", "detail": "string" }
```

Codes: `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `PARSE_FAILED`, `INVALID_INPUT`.

---

## CORS

In development the server accepts requests from
`http://localhost:5173` and `http://127.0.0.1:5173` only.

Production deployments behind SharePoint or Teams must replace this
allowlist with the actual hosting origin and must require authentication
before opening `POST /api/parse-upload`.

`X-Aging-Source` is exposed via `Access-Control-Expose-Headers`.

---

## Security notes for v1.2

The moment `/api/parse-upload` actually parses user-uploaded files,
the threat model changes. Before v1.2 ships:

- [ ] Replace `cors({ origin: true })` with explicit allowlist (already done in v1.1)
- [ ] Reject files > 25 MB at the busboy layer, not after reading
- [ ] Validate magic bytes, not just MIME types
- [ ] Run the Phase 1 engine in a child process with a CPU/memory limit
- [ ] Strip uploaded files from disk after the response is sent
- [ ] Add request rate limiting per IP / authenticated user
- [ ] Authentication required (Microsoft Entra / Teams SSO is the natural fit)

---

## Changelog

- **v1.1.0** — Added `/api/health` and `/api/parse-demo`. `/api/parse-upload`
  returns 501. UI imports `ParsingPreviewResult` (renamed from `ParseResult`,
  alias kept for one release).
