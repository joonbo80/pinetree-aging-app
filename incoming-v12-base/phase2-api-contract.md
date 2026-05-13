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
- Accepted formats: **`.xls` and `.xlsx` only** in v1.2
  - `application/vnd.ms-excel`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **PDF is intentionally NOT accepted** in v1.2. The Phase 1 parsing
  engine treats PDFs as metadata-only attachments, not as data sources,
  so accepting them on this endpoint would be misleading. PDF handling
  will land later as a dedicated `POST /api/statement-attachment` (or
  similar) — see "Deferred: PDF attachments" below.
- Magic-byte validation in addition to MIME type
- Server-side run of the Phase 1 engine in a child process with CPU/memory limits
- Convert raw result → `ParsingPreviewResult`
- Response: `200 OK` with `ParsingPreviewResult` body
- Error responses follow the shape:

```json
{ "error": "string", "code": "STRING_CODE" }
```

(`detail` is optional and reserved for *contract* information, never for
runtime error messages — see ApiErrorResponse type comment.)

Codes: `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `PARSE_FAILED`, `INVALID_INPUT`,
`UNAUTHENTICATED`, `RATE_LIMITED`.

---

### Deferred: PDF attachments

A separate endpoint is planned for after v1.2 to handle PDF agent /
local statements. Open design questions:

- Storage location (SharePoint document library vs API-managed blob)
- Linkage model (statement record ↔ PDF) — needs the v1.3 persistence work
- Whether to extract any text (no-go for now; treat as opaque attachment)

Until that endpoint exists, the Phase 1 PDF metadata-only behaviour stays:
PDFs can ride along as upload session metadata but are not parsed.

---

## CORS

CORS is a browser policy. It does NOT protect the server from `curl`,
server-to-server requests, or any client that ignores the Origin header.
This allowlist exists so the browser-served UI can call the API; it is
not a security boundary.

In development the server accepts requests from:

- `http://localhost:5173`, `http://127.0.0.1:5173`  (Vite dev server)
- `http://localhost:4173`, `http://127.0.0.1:4173`  (Vite preview)
- `http://localhost:5000`, `http://127.0.0.1:5000`  (QA static server)

Override via `AGING_API_CORS_ORIGINS` env (comma-separated).

`X-Aging-Source` is exposed via `Access-Control-Expose-Headers`.

---

## Security checklist for v1.2

The moment `/api/parse-upload` actually parses user-uploaded files, the
threat model changes. CORS is **not** part of the answer — it's a browser
policy and does nothing against `curl` or any non-browser client.

The actual security boundary must include all of the following before
v1.2 ships:

- [ ] **Authentication required** before the endpoint accepts any body
      (Microsoft Entra / Teams SSO is the natural fit)
- [ ] **Per-user / per-IP rate limiting** (e.g. express-rate-limit)
- [ ] **File size limit at the busboy layer** — reject before the bytes
      are buffered, not after reading
- [ ] **Magic-byte validation** in addition to MIME type
- [ ] **Reject anything that isn't `.xls` or `.xlsx`** — no PDF on this
      endpoint (see "Deferred: PDF attachments" above)
- [ ] **Phase 1 engine in a child process** with CPU + memory + wall-clock
      limits, isolated from the request handler
- [ ] **Strip temp files from disk** in a `finally` block whose execution
      is independent of response success
- [ ] **Generic error responses** — `err.message` / stack traces stay in
      server logs only, never in the HTTP body
- [ ] **Logging + alerting** on parse failures, oversize attempts, auth
      failures
- [ ] **Tighten CORS allowlist** to the production origin only (Teams or
      SharePoint). This is a UX requirement, not a security requirement —
      but it should still be done

---

## Changelog

- **v1.1.1** — Hardening pass round 2:
  - Added `localhost:4173` / `127.0.0.1:4173` (vite preview) to CORS allowlist
  - Rewrote CORS comments to be honest: it's a browser policy, not a security boundary
  - Stripped `err.message` from `/api/parse-demo` 500 response (server-log only)
  - Removed PDF from v1.2 `parse-upload` accepted formats; PDF moves to a
    deferred dedicated endpoint
  - Documented `ApiErrorResponse.detail` as contract-only, never runtime detail

- **v1.1.0** — Added `/api/health` and `/api/parse-demo`. `/api/parse-upload`
  returns 501. UI imports `ParsingPreviewResult` (renamed from `ParseResult`,
  alias kept for one release).
