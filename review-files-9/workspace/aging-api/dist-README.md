# aging-api — Build Artifact

**Version:** 1.1.0
**Generated from:** aging-api source v1.1.0
**Node requirement:** >= 20.10 < 23

This zip contains a self-contained, runnable build of the AGING API server.

## Contents

```
dist/                          Compiled JavaScript output
├── server.js                  Entry point
├── types.js
├── routes/
│   ├── health.js
│   └── parse.js
└── baselines/
    └── phase1-v1.3.0.json     Phase 1 baseline (read by parse-demo)

package.json                   Production dependencies + scripts
package-lock.json              Locked dependency versions
README.md                      This file
```

## Run

```bash
# 1. Install production dependencies (cors + express only)
npm install --omit=dev

# 2. Start the server
node dist/server.js
```

The server listens on `http://127.0.0.1:3001` by default. Override with:

```bash
PORT=3002 HOST=0.0.0.0 node dist/server.js
```

## CORS allowlist

By default the server accepts requests from:

- `http://localhost:5173`, `http://127.0.0.1:5173`  (Vite dev server)
- `http://localhost:5000`, `http://127.0.0.1:5000`  (used by QA tooling)

Override with a comma-separated list:

```bash
AGING_API_CORS_ORIGINS="https://your-host.example.com" node dist/server.js
```

## Endpoints

| Method | Path | Status |
|---|---|---|
| GET | `/api/health` | 200 — service health + versions |
| GET | `/api/parse-demo` | 200 — frozen baseline ParsingPreviewResult |
| POST | `/api/parse-upload` | 501 — placeholder, live parsing in v1.2 |

See `docs/api-contract.md` in the source repo for the full contract.

## Verify install

```bash
curl -s http://127.0.0.1:3001/api/health
# → {"status":"ok","service":"aging-api","version":"1.1.0",...}
```
