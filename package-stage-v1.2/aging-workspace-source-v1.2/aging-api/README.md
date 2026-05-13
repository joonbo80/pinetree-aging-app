# aging-api v1.2

Express API for the AGING APP Upload + Parsing Preview flow.

## Run

```bash
npm install
npm run dev
```

The API listens on `http://127.0.0.1:3001` by default.

## Phase 1 worker runtime

`POST /api/parse-upload` stores uploaded `.xls` / `.xlsx` files in an
API-managed temp folder, then spawns `scripts/phase1-worker.mjs`.
In built deployments, `npm run build` copies this worker to
`dist/scripts/phase1-worker.mjs`.

Set these environment variables when needed:

```bash
AGING_UPLOAD_TOKEN="dev-secret-change-me"
AGING_PYTHON="C:/path/to/python.exe"
AGING_PHASE1_ROOT="C:/path/to/New project"
```

`AGING_PHASE1_ROOT` must contain:

- `parsing-engine/`
- `tools/extract_workbook.py`
- `pydeps2/` or another Python environment where `xlrd` is importable

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Version and liveness |
| GET | `/api/parse-demo` | Frozen baseline preview JSON |
| POST | `/api/parse-upload` | Multipart `.xls` / `.xlsx` upload, returns `ParsingPreviewResult` |

`POST /api/parse-upload` requires:

```http
X-Aging-Upload-Token: <AGING_UPLOAD_TOKEN>
```

This is a development gate only. Production should replace it with
Microsoft Entra / Teams SSO.

Security limits in v1.2:

- 10 files per request
- 25 MB per file
- 100 MB per request
- `.xls` / `.xlsx` only
- magic-byte validation
- temp cleanup in `finally`
- Phase 1 parser isolated in a child process
