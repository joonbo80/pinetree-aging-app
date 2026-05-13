# v2.2 Logo + Favicon Integration Review Package rev2

Date: 2026-05-06
Purpose: external review package for Claude/Codex review.

## What changed from rev1

Reviewer findings fixed:

1. P1 favicon.ico structural corruption
   - Regenerated favicon.ico as a valid ICO container with 16/32/48 PNG entries.
   - Added invariants that read ICONDIR header: reserved=0, type=1, sane count, 16/32/48 entries.

2. P2 Header.tsx UTF-8 BOM
   - Removed BOM from Header.tsx.
   - Added invariant that rejects UTF-8 BOM in Header.tsx.

## Contents

- aging-app/src/components/Header.tsx
- aging-app/src/styles/global.css
- aging-app/index.html
- aging-app/src/assets/pte-logo-header.png
- aging-app/src/assets/pte-favicon-16.png
- aging-app/src/assets/pte-favicon-32.png
- aging-app/src/assets/pte-favicon-48.png
- aging-app/public/favicon.ico
- aging-app/public/pte-favicon-16.png
- aging-app/public/pte-favicon-32.png
- aging-app/public/pte-favicon-48.png
- tools/test-logo-integration.mjs

## Intended behavior

- Header shows the Pinetree Express logo image instead of plain PINETREE text.
- Logo click remains external: https://pinetreeexpress.com
- target="_blank" and rel="noopener noreferrer" are preserved.
- Favicon uses the triangle mark derived from the existing Pinetree logo asset.
- index.html title is "Pinetree Express · AGING APP".

## Verification already run

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project\aging-app"
npm.cmd run build
```

Result: PASS.

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
node .\tools\test-logo-integration.mjs
```

Result:

```text
PASS: 32    FAIL: 0
```

## Reviewer focus

Please check:

1. favicon.ico parses as a valid ICO and has sane entries.
2. Header.tsx has no UTF-8 BOM.
3. Header layout is visually acceptable at desktop width and does not push search/API/lang controls.
4. Logo external link behavior is preserved.
5. Favicon renders acceptably at 16/32px.
6. No unintended Dashboard/PartyDetail-specific changes were introduced.
