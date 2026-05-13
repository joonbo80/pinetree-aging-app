# Phase 2 v2.2 — Step 5 Complete

**Status:** Ready for review
**Date:** 2026-05-04
**Predecessor:** v2.2 Step 4 absorbed (`PASS 48 + PASS 105 / FAIL 0`)
**Spec:** `phase2-v2.2-party-detail-spec.md` (frozen 2026-05-04)
**Step:** 5 — Tab scaffolding + mainline boundary fixes incorporated

---

## Summary

Step 5 adds the tab navigation strip and panel shell on top of the
absorbed Step 4 page. Each tab is wired to its corresponding selector
data; tab content placeholders show counts and stub messages until
Steps 6-9 fill them in.

The two mainline absorption boundary fixes from Step 4 are retained
and the test suite is extended to enforce them as invariants going
forward.

---

## Files changed

| Step | Path | Change | Purpose |
|---|---|---|---|
| 5 | `aging-app/src/components/party/PartyDetailPage.tsx` | +180 / -8 | Tab bar, tab panels, placeholders for 4 tabs, ARIA tablist pattern, null-result distinct state |
| 5 | `tools/test-party-detail-page-step5.mjs` | new (250 lines) | 33-assertion regression suite |

No other files touched. Step 6+ will replace the four
TabPlaceholder components with real tab content.

---

## What this step does

### Tab bar

Four tabs in fixed spec order: Transactions / Statements / Reviews /
Duplicates. Each shows label + count from selector. Default active
tab is Transactions per spec D1.

### Tab panel shell

One panel container with `role="tabpanel"`, `aria-labelledby`,
`tabIndex={0}`. The active placeholder content is rendered inside.
Steps 6-9 will replace each placeholder.

### Accessibility

Full WAI-ARIA tablist pattern:

- `role="tablist"` on the bar
- `role="tab"` + `aria-selected` + `aria-controls` + `id` on each tab
- `role="tabpanel"` + `aria-labelledby` on the panel
- `tabIndex={selected ? 0 : -1}` so screen readers / keyboard users
  cycle correctly
- ArrowLeft / ArrowRight cycles tabs (with focus following)
- Real `<button>` elements, not `<div onClick>`

### Spec §"Empty States" preserved

- Duplicates tab visible even when 0 groups (spec: "Do not hide the tab")
- Reviews tab visible even when 0 items
- Statement-only party Transactions tab shows the exact spec copy:
  "No ERP transactions found. This party only appears in statement files."

### Mainline absorption boundary fixes retained

User's two Step 4 boundary fixes from absorption notes are now in code:

1. **Distinct `result === null` state** — "No data loaded yet" message
   with Upload/Dashboard actions. Separated from "unknown party".
2. **Schema 1.0 fallback** remains a separate branch.

These are now enforced by the new test (set I).

---

## Verification — 33/33 PASS

```
=== A. Tab order and labels ===                    5 PASS
=== B. Tab counts derive from selector ===         6 PASS
=== C. Tab visibility (always-on tabs) ===         3 PASS
=== D. Default tab (spec D1) ===                   1 PASS
=== E. Tab accessibility (WAI-ARIA pattern) ===    8 PASS
=== F. Real <button> elements ===                  1 PASS
=== G. Statement-only special copy ===             1 PASS
=== H. Tab content uses selector arrays ===        4 PASS
=== I. State boundary: null vs schema-1.0 ===      4 PASS

PASS: 33    FAIL: 0
```

---

## Acceptance criteria status (from spec)

| # | Criterion | Status |
|---|---|---|
| 1 | `/party/:partyKey` opens from Review Queue links | DONE in mainline absorption |
| 2 | Header shows human-readable `partyName` | DONE (Step 4) |
| 3 | Summary cards reconcile to selector counts | DONE (Step 4) |
| 4 | Transactions tab count matches selector | **Tab count DONE; content pending Step 6** |
| 5 | Statements tab shows linked + unlinked | **Tab count DONE; content pending Step 7** |
| 6 | Reviews tab dedupes nothing | **Tab count DONE; content pending Step 8** |
| 7 | Duplicates tab shows groups touching party | **Tab count DONE; content pending Step 9** |
| 8 | Row expansion shows source file + row | Pending Step 10 |
| 9 | CSV per tab with UTF-8 BOM | Pending Step 11 |
| 10 | Unknown party never throws | DONE (Step 4) |
| 11 | Schema 1.0 details-unavailable notice | DONE (Step 4) |
| 12 | partyName never collapses to partyKey | DONE (Step 4) |

The four "tab" criteria (#4-7) now have their navigation working. Tab
content delivery moves to Steps 6-9.

---

## Style additions for `global.css`

Step 5 introduces the tab pattern. Suggested CSS:

```css
/* Party Detail tabs */
.party-tabs {
  margin-top: 16px;
}

.party-tab-bar {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  gap: 0;
}

.party-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 0.95em;
  color: var(--color-text-muted, #777);
  display: flex;
  gap: 8px;
  align-items: center;
}

.party-tab:hover {
  color: var(--color-text, #222);
}

.party-tab-active {
  color: var(--color-text, #222);
  border-bottom-color: var(--color-accent, var(--brand-green, #166534));
  font-weight: 600;
}

.party-tab-count {
  background: var(--color-surface-alt, #f3f4f6);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.75em;
  font-variant-numeric: tabular-nums;
}

.party-tab-active .party-tab-count {
  background: var(--color-accent-soft, #dcfce7);
}

.party-tab-panel {
  padding: 16px 0;
  outline: none;
}

.party-tab-panel:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.party-tab-content-placeholder {
  padding: 24px;
  background: var(--color-surface-alt, #f8fafc);
  border-radius: 6px;
  text-align: center;
}
```

Tokens come from existing project variables; neutral fallbacks provided.

---

# Logo Integration Guide

User uploaded two assets:

```
PTE_LOGO_STACKED_CMYK_IMAGE.jpg   787 × 255   (horizontal, ideal for header)
PTE_LOGO_Squared_RGB.jpg          596 × 452   (vertical, ideal for favicon/splash)
```

These are NOT incorporated into the v2.2 Step 5 code change. Logo
integration touches the global Header component (or App shell), which
is outside the v2.2 Party Detail scope. It is also small enough to be
done as a separate one-shot task whenever convenient.

## Recommended placement

| Asset | Use | Where |
|---|---|---|
| STACKED | Header brand block | `<Header>` left side, height 32-40px |
| Squared | favicon | `index.html` `<link rel="icon">` |
| Squared | Teams app icon | when/if Teams manifest is added |
| Squared | Splash / login | when/if SSO landing page is added |

## Format recommendation

**Convert to SVG before deploying.** Reasons:

- JPG 787×255 = 33 KB but blurs on retina displays at small sizes
- SVG: sharp at any zoom, smaller file (~5-10 KB), no jaggies
- Teams iOS / Android render SVG cleanly

If a designer's SVG is unavailable, the JPG can be vectorized — but
asking for the original SVG is faster and produces better results.

## Header.tsx integration

```tsx
// aging-app/src/components/Header.tsx
import logo from '../assets/pte-stacked.svg';  // place asset under src/assets/

export function Header() {
  return (
    <header className="app-header">
      <a href="/" aria-label="Pinetree Express AGING App home">
        <img
          src={logo}
          alt="Pinetree Express"
          className="brand-logo"
        />
      </a>
      <span className="app-title">AGING APP</span>
      {/* existing nav, search, status indicators */}
    </header>
  );
}
```

CSS:

```css
.brand-logo {
  height: 32px;
  width: auto;
  display: block;
}

@media (min-width: 1024px) {
  .brand-logo { height: 36px; }
}
```

## index.html favicon

```html
<link rel="icon" type="image/svg+xml" href="/icons/pte-squared.svg" />
<!-- fallback for older browsers -->
<link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
```

## Verification checklist after logo integration

- [ ] Header logo visible in /dashboard, /review, /party/:partyKey
- [ ] Header logo navigates back to root on click
- [ ] alt text reads "Pinetree Express" (not filename)
- [ ] favicon shows in browser tab + bookmarks
- [ ] Logo not stretched on mobile viewport (height fixed, width auto)
- [ ] Logo not embedded in Party Detail or Review Queue page bodies
  (header is the only place)

---

## Reviewer focus areas

If reviewer wants to spot-check this round:

1. **Read the new tab section** (~100 lines added). Check that:
   - Tab order is fixed and matches spec listing
   - All four tabs are always rendered (no conditional hiding)
   - Active state is single-source (parent owns `activeTab`)

2. **WAI-ARIA pattern compliance**:
   - `role="tablist"` on container
   - `role="tab"` + `aria-selected` + `aria-controls` on each tab
   - `role="tabpanel"` + `aria-labelledby` on panel
   - `tabIndex={selected ? 0 : -1}` enables proper roving focus
   - ArrowLeft/ArrowRight handler cycles tabs

3. **Empty state copy**:
   - Statement-only party Transactions tab uses exact spec text
   - Duplicates tab does NOT hide when count is 0
   - Reviews tab does NOT hide when count is 0

4. **Boundary state distinction**:
   - `result === null` → "No data loaded yet" (NOT unknown party)
   - `result.details === undefined` → schema 1.0 notice (NOT unknown party)
   - `partyKey not found` → "No data for this party" (NOT no result loaded)

5. **No tab content delivered yet** — Steps 6-9 are explicitly deferred.
   Each tab placeholder self-documents which Step will replace it.

---

## Open question for reviewer

Currently, ArrowLeft/ArrowRight on the tab bar **changes both active
tab and focus**. An alternative pattern keeps focus on the originally-
focused element until Enter/Space activates. Both are valid WAI-ARIA
patterns; we chose immediate-activate for a smoother accountant
experience (cycle through tabs while reading).

If reviewer prefers explicit Enter-to-activate, the change is one-line
(call `.focus()` only, not `onTabChange()`).

---

## Methodology note

```
Spec freeze (done) → Selector + types (Step 1-3, absorbed)
                  → Header + cards (Step 4, absorbed with 2 boundary fixes)
                  → Tab scaffolding (Step 5, this round) ← absorbed boundary
                                                            fixes are retained
                                                            and now invariant-
                                                            tested
```

Combined v2.2 invariant net so far:
- 48 selector assertions (Step 3)
- 105 page assertions (Step 4)
- 33 tab scaffolding assertions (Step 5)
- **186 total**, all PASS

By Step 13 (browser hands-on) the net should comfortably exceed v2.1's
(48). Appropriate given Party Detail is the audit-grade core.

---

## Next steps

```
✅ Step 1-2 + 3 — Selector + types + invariants
✅ Step 4 — Header + 6 cards
✅ Step 5 — Tab scaffolding (this round)
[ ] Step 6 — Transactions tab content
[ ] Step 7 — Statements tab content
[ ] Step 8 — Reviews tab content
[ ] Step 9 — Duplicates tab content
[ ] Step 10 — Trace panel reuse from v2.1
[ ] Step 11 — CSV export per tab
[ ] Step 12 — Dashboard Top Parties links
[ ] Step 13 — Browser verification
```

Logo integration is independent — can happen any time, ideally before
Step 13 browser verification so the new logo appears in screenshots.
