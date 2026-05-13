# Phase 2 v1.2.1 Hardening Notes

Date: 2026-05-01

## Scope

This patch absorbs the independent v1.2 review notes without changing the
Upload + Parsing Preview contract.

## Changes

1. Upload token comparison now uses `crypto.timingSafeEqual`.
   - Endpoint behavior is unchanged.
   - Missing or invalid tokens still return `401 UPLOAD_UNAUTHORIZED`.

2. Runtime documentation now states that the UI must run over HTTP.
   - v1.2.x uses BrowserRouter.
   - Direct `file://` preview does not support routes such as `/dashboard`.

3. Deployment notes now explicitly call out the mixed runtime.
   - Node.js runs the API and worker shell.
   - Python extracts `.xls` / `.xlsx` workbook rows for Phase 1.
   - `AGING_PYTHON` and `AGING_PHASE1_ROOT` must be configured for live upload
     parsing outside the development workspace.

## Deferred

- Microsoft Entra / Teams SSO remains the production replacement for the
  development upload token.
- Rate limiting remains deferred until the authenticated user identity is
  available.
- SharePoint persistence remains Phase 3+.

## Compatibility

No JSON schema, parser contract, or UI data contract changes.
