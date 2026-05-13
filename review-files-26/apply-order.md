# Step 12 - Absorption Order

This package contains 4 changed files for v2.2 Step 12.
All files are FULL replacements (not deltas). No overlay required.

## Predecessor

This package assumes Step 11 rev2 has been absorbed into mainline.
Cumulative state expected before applying Step 12:

```
Step 5:  PASS 33 / FAIL 0
Step 6:  PASS 66 / FAIL 0   (or 70 with dist build)
Step 7:  PASS 58 / FAIL 0
Step 8:  PASS 43 / FAIL 0
Step 9:  PASS 37 / FAIL 0
Step 10: PASS 48 / FAIL 0
Step 11: PASS 46 / FAIL 0   (with rev2 P2 fix)
```

## Files in this package

| Path | Type | Notes |
|------|------|-------|
| aging-app/src/components/dashboard/Dashboard.tsx | replace | adds onOpenParty prop + nameToKey map + clickable TopPartyTable rows |
| aging-app/src/parsing-engine/types.ts | replace | adds optional partyKey to TopPartySummary (additive only) |
| aging-app/src/styles/v2.2-party-detail.css | replace | +30 lines for top-party-row-link / top-party-link |
| tools/test-party-detail-page-step12.mjs | new | 20 invariants |

## Apply order

1. Replace all 4 files in their target paths
2. Wire onOpenParty in App.tsx (the parent that passes Dashboard
   props). Example:

```tsx
// App.tsx — the route that renders <Dashboard ... />
<Dashboard
  result={result}
  lang={lang}
  onBackToUpload={...}
  onOpenReview={...}
  onOpenReviewCategory={(category) => navigate(`/review/${category}`)}
  onOpenParty={(partyKey) => navigate(`/party/${partyKey}`)}  // <-- new
  detailsNotice={...}
/>
```

If your App.tsx already navigates Review categories with useNavigate,
the onOpenParty wiring is a one-liner using the same pattern.

## Verification

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
npm.cmd --prefix aging-app run build
npm.cmd --prefix aging-app run lint
node tools/test-party-detail-page-step12.mjs
# expect: PASS 20 / FAIL 0
```

Full regression should now read:

```
Step 5:  PASS 33 / FAIL 0
Step 6:  PASS 66 / FAIL 0   (or 70 with dist build)
Step 7:  PASS 58 / FAIL 0
Step 8:  PASS 43 / FAIL 0
Step 9:  PASS 37 / FAIL 0
Step 10: PASS 48 / FAIL 0
Step 11: PASS 46 / FAIL 0
Step 12: PASS 20 / FAIL 0   <-- new
```

## Browser smoke test (recommended)

1. Load any baseline data in /dashboard
2. Scroll to "Top Parties" section
3. Hover over any party name — cursor should be pointer + party name
   underlines in green
4. Click a party — should navigate to /party/{partyKey}
5. Verify partyName in URL matches a real party (e.g. skymaster-express)
