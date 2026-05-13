# AGING APP — Phase 2 v1.1 Hardening Pass

**Date:** 2026-05-01
**Trigger:** External code review identifying 7 findings on the initial v1.1 build.
**Outcome:** All 7 addressed; v1.0 regression suite still 52/52 PASS; new P1-1 modal verified 6/6.

---

## Findings → fixes

### P1 — must fix before any business user touches this build

#### P1-1. File drop silently loaded baseline data

**Risk:** Accounting users would believe their files had been analyzed
when in reality only demo data was being shown.

**Fix:** New `UploadNotSupportedModal` component. `handleFiles()` in
`App.tsx` now stores the dropped files in `pendingFiles` state and opens
the modal. The modal:

- States plainly that **files are NOT analyzed**
- Lists every attempted file with name and size
- Offers **Close** (no data loaded) and **Load demo baseline instead** (explicit user choice)

Verified by `test_upload_modal.py` (6/6 PASS). Screenshot proof in EN and KO.

#### P1-2. API build zip was unrunnable standalone

**Risk:** Anyone unzipping `aging-api-build.zip` would hit a
`Cannot find module 'express'` error because only `dist/` was inside.

**Fix:**
- Added `scripts/copy-assets.mjs` to copy non-TS files (the baseline JSON) to `dist/`
- Updated `npm run build` to `tsc && npm run copy-assets`
- Build zip now contains: `dist/` + `package.json` + `package-lock.json` + `README.md`
- `dist-README.md` documents `npm install --omit=dev && node dist/server.js`

Verified by unzipping into `/tmp/verify-api-build/`, running `npm install --omit=dev`,
then `node dist/server.js`. The `/api/health` endpoint responded normally.

#### P1-3. UI type name misleading

**Risk:** When v1.2 wires up real `POST /api/parse-upload`, the temptation
will be to send back the raw Phase 1 parser output — which contains huge
`transactions[]` and `statements[]` arrays the UI doesn't need. The old
type name `ParseResult` invited that mistake.

**Fix:**
- Renamed `ParseResult` → `ParsingPreviewResult` in `parsing-engine/types.ts`
- Documentation comment explains it is a **summary DTO**, not raw parser output
- Old name kept as `@deprecated` alias for one release: `export type ParseResult = ParsingPreviewResult`
- All 9 importing files updated via `sed`
- New `docs/api-contract.md` documents the two-payload distinction (raw vs preview),
  endpoint contracts, and the v1.2 conversion layer plan

### P2 — quality / safety hardening

#### P2-1. CORS too permissive

**Fix:** `cors({ origin: true })` replaced with explicit allowlist:
`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:5000`,
`http://127.0.0.1:5000`. Override via `AGING_API_CORS_ORIGINS` env var.
Boot log now prints the active allowlist.

#### P2-2. JSON import attributes runtime-fragile

**Fix:** Both `routes/health.ts` and `routes/parse.ts` switched from
`import baseline from './baseline.json' with { type: 'json' }` to
`fs.readFileSync` + `JSON.parse`. Universally supported on all Node 20+
without flags. Comment in code explains the reason.

#### P2-3. Encoding mojibake reported by reviewer

**Investigation:** Scanned all 28 source/doc files for the specific
UTF-8-as-Latin-1 byte sequences (`c3 82 c2 b7`, `c3 a2 e2 80`, etc.) that
produce visible mojibake like `Â·` and `â€¦`. **Zero hits.** Verified by
unzipping the actual delivered zip and running `file` on every member.
The KO modal was visually verified in a real browser to render Hangul correctly.

**Mitigation against future drift:**
- Added `.editorconfig` (`charset = utf-8`, `end_of_line = lf`)
- Added `.gitattributes` (`text=auto eol=lf working-tree-encoding=UTF-8` per file type)

If the reviewer's tool still shows mojibake, it's an extraction tool issue,
not a source issue.

#### P2-4. Aggressive caret ranges

**Fix:**
- Added `engines: { node: ">=20.10 <23" }` to both `package.json` files
- Both `package-lock.json` files committed and now travel inside the source zips
- `aging-app/package.json` got a real `version: "1.1.0"` and `description`

Note: pinning major versions of Vite 8 / React 19 / Express 5 was
considered but rejected — these are the versions the build was tested
against, and the lockfile already pins the exact resolved versions.
The caret ranges document upgrade intent without violating reproducibility.

---

## Acceptance

| Test | Result |
|---|---|
| v1.0 checklist (52 items) | 52 / 52 PASS |
| API ON / API OFF integration | 6 / 6 PASS |
| Upload-not-supported modal flow | 6 / 6 PASS |
| API build zip runs standalone | PASS (verified by extraction + npm install + node) |
| UI build artifact unchanged behavior | PASS (visual + automated regression) |

---

## What did NOT change

- All 5 Tabs — Files, ERP Reconciliation, Statements, Review Queue, Raw JSON
- Confirm Import flow
- Bundled baseline JSON (still authoritative fallback)
- Spec / schema / parser version numbers (1.3.0 / 1.0 / 1.3.0)
- API endpoint shapes
- UI rendering, KO/EN copy

---

## Files in this release

```
aging-workspace-source.zip      Full monorepo source (UI + API + docs + .editorconfig + .gitattributes)
aging-app-source.zip            UI source only
aging-app-build.zip             UI dist (drop into any static host)
aging-app-preview.html          Single-file standalone (works offline → falls back; modal works)
aging-api-source.zip            API source only
aging-api-build.zip             ⭐ NOW STANDALONE-RUNNABLE — dist + package.json + lockfile + README
phase2-v1.1-hardening-changelog.md   This file
phase2-v1.1-README.md           Updated workspace README
```

---

## Next: v1.2

Per reviewer recommendation:

1. Implement `POST /api/parse-upload` with **busboy**, not hand-rolled multipart
2. File size limit at busboy layer (25 MB / file, 100 MB / request)
3. Magic-byte validation, not MIME-only
4. Run Phase 1 engine in worker / child process with CPU/memory limits
5. Add `/dashboard` placeholder + React Router
6. Auth before opening the endpoint (Microsoft Entra / Teams SSO is the natural fit)

The `docs/api-contract.md` v1.2 plan section is the source of truth for
that work.
