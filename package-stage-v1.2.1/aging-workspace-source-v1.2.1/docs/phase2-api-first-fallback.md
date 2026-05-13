# Phase 2 API-First + Local Fallback

## Purpose

The Upload + Parsing Preview UI should prefer the local Node API when available and fall back to embedded baseline data when the API is unavailable.

This keeps the UI usable during development while preparing the path for SharePoint/Teams integration.

## API Server

File:

```text
server/index.mjs
```

Run:

```sh
node server/index.mjs
```

Default URL:

```text
http://localhost:4000
```

## Endpoints

### GET /api/health

Returns:

```js
{
  status: "ok",
  uptime,
  timestamp
}
```

### GET /api/parse-demo

Returns the Phase 1 v1.3.0 baseline parse result with:

```js
{
  source: "api-demo",
  generatedAt,
  ...baselineParseResult
}
```

### POST /api/parse-upload

Currently returns `501`.

This endpoint is reserved for Phase 2 live upload parsing.

## UI Behavior

The `Load baseline demo` button:

1. Tries `http://localhost:4000/api/parse-demo`.
2. If successful, shows `Source: API Demo`.
3. If unavailable, loads `window.BASELINE_RESULT`.
4. If fallback is used, shows `Source: Local Baseline`.

## Why This Structure

- UI can be tested without a server.
- API contract can be tested before adding dependencies.
- SharePoint/Teams work can be added behind the API without changing the preview UI.
- Express/TypeScript can replace this server later while preserving routes.

## QA

API available:

- Start `node server/index.mjs`.
- Open `phase2-ui/index.html`.
- Click `Load baseline demo`.
- Confirm `Source: API Demo`.

API unavailable:

- Stop API server.
- Open `phase2-ui/index.html`.
- Click `Load baseline demo`.
- Confirm `Source: Local Baseline`.
