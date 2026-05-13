# AGING APP — Phase 2 v1.1.1 (Hardening pass round 2)

**Date:** 2026-05-01
**Trigger:** Second external code review after v1.1 hardening, identifying
4 remaining issues before main-line absorption.
**Outcome:** All 4 fixed and verified. Reviewer's accepted next step is
absorption into main and beginning v1.2 (`POST /api/parse-upload`).

---

## Findings → fixes

### 1. [P1] CORS allowlist missing `localhost:4173`

**Issue:** Default allowlist had 5173 (vite dev) and 5000 (QA static server)
but not 4173, which is the default port of `vite preview` — meaning the
production-ish preview build would see `API OFFLINE` even when the API was
running.

**Fix:** `aging-api/src/server.ts` — added:

```ts
'http://localhost:4173',
'http://127.0.0.1:4173',
```

Boot log now prints all six origins. Verified: `curl -H "Origin: http://localhost:4173"`
gets `Access-Control-Allow-Origin: http://localhost:4173` reflected back.

---

### 2. [P2] CORS comment / docs implied CORS is a security boundary

**Issue:** `server.ts` line 15 said the allowlist plus auth was "the only
thing standing between the parser and the public internet". That's
factually wrong. CORS is a browser policy. `curl`, server-to-server
requests, and any non-browser client ignore it.

**Fix:** Rewrote the comment block in `server.ts` to be honest:

> CORS is a browser policy. It does NOT protect the server from curl,
> server-to-server requests, or anything that ignores the Origin header.
> Treat CORS as a UX/integration constraint, not a security boundary.

Also rewrote `docs/api-contract.md` security checklist to put CORS at the
**bottom** with the explicit note that it's a UX requirement, not a
security requirement, and to put authentication / rate limiting / size
limits / magic-byte validation / process isolation / generic error
responses at the top where they belong.

---

### 3. [P2] `parse.ts` 500 response leaked `err.message`

**Issue:** Baseline-load failure returned:

```ts
{
  error: 'Baseline not available',
  code: 'BASELINE_LOAD_FAILED',
  detail: err instanceof Error ? err.message : String(err),  // ← leaks file path / stack
}
```

If the baseline JSON were missing, the response would have leaked the
absolute file path and possibly Node internals.

**Fix:** `aging-api/src/routes/parse.ts`:

```ts
console.error('[parse-demo] baseline load failed:', err);  // server-log only
const error: ApiErrorResponse = {
  error: 'Baseline not available',
  code: 'BASELINE_LOAD_FAILED',
};                                                          // no detail in response
res.status(500).json(error);
```

Also tightened the `ApiErrorResponse` doc-comment in `types.ts`:

> `detail` OPTIONAL. Use ONLY for information that is part of the public
> contract (e.g. "this endpoint ships in v1.2"). NEVER include err.message,
> stack traces, file paths, or any runtime detail — those are
> server-log-only.

`/api/parse-upload` 501 response keeps its `detail` field because that
detail (`"... planned for v1.2"`) is part of the public contract, not a
runtime error.

Verified: compiled `dist/routes/parse.js` no longer contains
`detail: err`.

---

### 4. [P2] v1.2 contract listed PDF among `parse-upload` accepted formats

**Issue:** `docs/api-contract.md` v1.2 design block had:

> Accepted: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/pdf`

But the Phase 1 engine treats PDFs as **metadata-only attachments**, not
as data sources. Letting them ride on `parse-upload` would be misleading
and would invite "why isn't my PDF being parsed?" tickets.

**Fix:** `docs/api-contract.md`:

- Removed `application/pdf` from the v1.2 `parse-upload` accepted list
- Added an explicit note: "PDF is intentionally NOT accepted in v1.2"
- Added a new **Deferred: PDF attachments** section describing a future
  dedicated endpoint (provisionally `POST /api/statement-attachment`)
  with the open design questions (storage location, linkage model,
  whether to extract text)
- Until that endpoint exists, Phase 1 PDF metadata-only behaviour stays

---

## Verification

| Test | Result |
|---|---|
| CORS allows `http://localhost:4173` | **PASS** |
| CORS rejects unknown origin (`evil.example.com`) | **PASS** |
| Boot log shows all 6 entries including 4173 | **PASS** |
| Compiled `parse.js` does not include `err.message` in response | **PASS** |
| `api-contract.md` v1.2 block does not mention `application/pdf` | **PASS** |
| Deferred PDF section exists in `api-contract.md` | **PASS** |
| `/api/parse-upload` still returns 501 (unchanged) | **PASS** |
| `aging-api-build.zip` standalone-runnable (P1-2 from previous pass) | **PASS** |
| v1.0 QA checklist (52 items) regression | **52 / 52 PASS** |
| Upload-not-supported modal flow regression | **6 / 6 PASS** |

---

## What did NOT change

- UI source — no UI changes in this round
- API endpoints — same shapes, same status codes, just better wording
- Versions — `specVersion: 1.3.0`, `schemaVersion: 1.0`, `parserVersion: 1.3.0`,
  `aging-api: 1.1.0`, `aging-app: 1.1.0`. The hardening is internal /
  documentation; bumping a public version number would be misleading.
- Bundled baseline JSON

---

## Files in this release

```
aging-workspace-source.zip      Full monorepo source (v1.1.1)
aging-app-source.zip            UI source (unchanged from v1.1)
aging-app-build.zip             UI dist (unchanged from v1.1, rebuilt for parity)
aging-app-preview.html          Standalone single-file UI (unchanged)
aging-api-source.zip            API source (v1.1.1)
aging-api-build.zip             API standalone-runnable build (v1.1.1)
phase2-v1.1.1-changelog.md      This file
phase2-api-contract.md          Updated v1.1.1 contract (deferred PDF, honest CORS)
phase2-v1.1-README.md           Workspace README (still accurate)
phase2-v1.1-hardening-changelog.md   Round-1 hardening (kept for history)
```

---

## Status

**Reviewer's verdict:** "이 버전은 창고/흡수 대상으로 합격입니다." after these fixes.

The API/UI structure is now ready to be absorbed into the main line.
v1.2 (`POST /api/parse-upload` with busboy + auth + child-process
isolation, plus `/dashboard` placeholder + React Router) is the next step.
