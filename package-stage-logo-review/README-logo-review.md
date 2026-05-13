# v2.2 Logo + Favicon Integration Review Package

Date: 2026-05-06
Purpose: external review package for Claude/Codex review.

## Contents

This package contains full replacements or new files for the logo/favicon integration:

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

## Source assets used

- Header source: F:/01.PINETREE EXPRESS/INTRODUCE/FINAL_LOGO/72_DPI/PTE_LOGO_Horizontal_RGB.png
- Favicon crop source: same horizontal RGB PNG, left mark crop

## Verification already run

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project\aging-app"
npm.cmd run build
```

Result: PASS. Vite emitted bundled logo asset:

```text
dist/assets/pte-logo-header-CdWrwR82.png
```

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
node .\tools\test-logo-integration.mjs
```

Result:

```text
PASS: 25    FAIL: 0
```

## Reviewer focus

Please check:

1. Header layout is visually acceptable at desktop width and does not push search/API/lang controls.
2. Logo external link behavior is preserved.
3. Favicon renders acceptably at 16/32px.
4. `test-logo-integration.mjs` protects against missing assets and accidental internal `/dashboard` logo routing.
5. No unintended Dashboard/PartyDetail-specific changes were introduced.
