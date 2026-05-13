// inv-aging-ui invariants for v2.3 C2 Round 2.
//
// Pins the UI shell layer: page exists, route wired, callout above
// tabs, tab order correct, Dashboard entry point present, CSS loaded.
// Round 2 is a structural shell -- the party rollup table itself
// arrives in Round 3, so these invariants focus on file presence,
// import wiring, and component contract.
//
// Spec references (v2.3 C2 micro-spec rev3 FROZEN):
//   Section 3.1   Page structure
//   Decision 4    No Due Date pinned call-out ABOVE tabs
//   Decision 6    Tab order: Current / Overdue / Cleared
//
// Run with:
//   node --experimental-strip-types tools/test-aging-report-ui.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const paths = {
  agingReportPage: resolve(
    root,
    'aging-app/src/pages/AgingReportPage.tsx',
  ),
  noDueDateCallout: resolve(
    root,
    'aging-app/src/components/aging/NoDueDateCallout.tsx',
  ),
  agingTabs: resolve(
    root,
    'aging-app/src/components/aging/AgingTabs.tsx',
  ),
  css: resolve(root, 'aging-app/src/styles/v2.3-aging-report.css'),
  appTsx: resolve(root, 'aging-app/src/App.tsx'),
  dashboardTsx: resolve(
    root,
    'aging-app/src/components/dashboard/Dashboard.tsx',
  ),
  indexHtml: resolve(root, 'aging-app/index.html'),
  selectorTs: resolve(
    root,
    'aging-app/src/selectors/agingReport.ts',
  ),
};

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) {
    pass++;
    console.log(`PASS ${label}`);
  } else {
    fail++;
    failures.push({ label, evidence });
    console.error(`FAIL ${label}${evidence ? ` -- ${evidence}` : ''}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function readIf(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const src = {
  agingReportPage: readIf(paths.agingReportPage),
  noDueDateCallout: readIf(paths.noDueDateCallout),
  agingTabs: readIf(paths.agingTabs),
  css: readIf(paths.css),
  appTsx: readIf(paths.appTsx),
  dashboardTsx: readIf(paths.dashboardTsx),
  indexHtml: readIf(paths.indexHtml),
  selectorTs: readIf(paths.selectorTs),
};

// ---------------------------------------------------------------------------

section('inv-aging-ui-1: AgingReportPage component file exists');
check(
  'inv-aging-ui-1a: AgingReportPage.tsx file present',
  src.agingReportPage.length > 0,
);
check(
  'inv-aging-ui-1b: AgingReportPage is exported',
  /export\s+(function|const)\s+AgingReportPage\b/.test(src.agingReportPage),
);

section('inv-aging-ui-2: AgingReportPage imports the Round 1 selector');
check(
  'inv-aging-ui-2: imports selectAgingReport from selectors/agingReport',
  /import\s*\{[^}]*\bselectAgingReport\b[^}]*\}\s*from\s*['"][^'"]*selectors\/agingReport['"]/.test(
    src.agingReportPage,
  ),
);

section('inv-aging-ui-3: NoDueDateCallout renders above AgingTabs');
// The order in JSX must be: callout markup precedes the <AgingTabs />.
// We look for the first occurrence of each and assert the callout
// comes first.
const calloutIdx = src.agingReportPage.indexOf('<NoDueDateCallout');
const tabsIdx = src.agingReportPage.indexOf('<AgingTabs');
check(
  'inv-aging-ui-3a: <NoDueDateCallout> present in page',
  calloutIdx !== -1,
);
check(
  'inv-aging-ui-3b: <AgingTabs> present in page',
  tabsIdx !== -1,
);
check(
  'inv-aging-ui-3c: NoDueDateCallout appears before AgingTabs (above tabs)',
  calloutIdx !== -1 && tabsIdx !== -1 && calloutIdx < tabsIdx,
);

section('inv-aging-ui-4: NoDueDateCallout uses OPEN count, not gross count');
// Decision 4 P1-1 fix: callout shows openCount (118 in baseline),
// not the gross dueDate-missing 303. The component must accept an
// openCount prop and use it in the title.
check(
  'inv-aging-ui-4a: NoDueDateCallout component file present',
  src.noDueDateCallout.length > 0,
);
check(
  'inv-aging-ui-4b: NoDueDateCallout accepts openCount prop',
  /openCount\s*:\s*number/.test(src.noDueDateCallout),
);
check(
  'inv-aging-ui-4c: NoDueDateCallout title uses "open" wording',
  /No Due Date \(open\)/.test(src.noDueDateCallout),
);

section('inv-aging-ui-5: AgingTabs renders Current / Overdue / Cleared in order');
check(
  'inv-aging-ui-5a: AgingTabs component file present',
  src.agingTabs.length > 0,
);
// Look for the TAB_DEFINITIONS array (or equivalent ordered list).
// The keys must appear in order: current, then overdue, then cleared.
const tabsBody = src.agingTabs;
const currentIdx = tabsBody.indexOf("'current'");
const overdueIdx = tabsBody.indexOf("'overdue'");
const clearedIdx = tabsBody.indexOf("'cleared'");
check(
  'inv-aging-ui-5b: tab order current < overdue < cleared',
  currentIdx !== -1 &&
    overdueIdx !== -1 &&
    clearedIdx !== -1 &&
    currentIdx < overdueIdx &&
    overdueIdx < clearedIdx,
);

section('inv-aging-ui-6: /aging route registered in App.tsx');
check(
  'inv-aging-ui-6a: App.tsx imports AgingReportPage',
  /import\s*\{[^}]*\bAgingReportPage\b[^}]*\}\s*from\s*['"][^'"]*pages\/AgingReportPage['"]/.test(
    src.appTsx,
  ),
);
check(
  'inv-aging-ui-6b: App.tsx has <Route path="/aging" element=...>',
  /<Route\s+path=["']\/aging["']\s+element=\{[\s\S]{0,400}?<AgingReportPage\b/.test(
    src.appTsx,
  ),
);
check(
  'inv-aging-ui-6c: /aging Route passes result prop to AgingReportPage',
  /<AgingReportPage\b[\s\S]{0,200}?result=\{result\}/.test(src.appTsx),
);

section('inv-aging-ui-7: Dashboard has Open Collection Workbench entry');
check(
  'inv-aging-ui-7a: Dashboard.tsx declares onOpenAging prop',
  /onOpenAging\??\s*[:?]/.test(src.dashboardTsx),
);
check(
  'inv-aging-ui-7b: Dashboard.tsx renders Open Collection Workbench button',
  /Open Collection Workbench/.test(src.dashboardTsx),
);

section('inv-aging-ui-8: App.tsx forwards onOpenAging to Dashboard');
check(
  'inv-aging-ui-8: App.tsx passes onOpenAging to Dashboard with navigate /aging',
  /<Dashboard\b[\s\S]{0,800}?onOpenAging=\{[^}]*navigate\(\s*['"]\/aging['"]\s*\)[^}]*\}/.test(
    src.appTsx,
  ),
);

section('inv-aging-ui-9: CSS file present');
check(
  'inv-aging-ui-9a: v2.3-aging-report.css file present',
  src.css.length > 0,
);
check(
  'inv-aging-ui-9b: CSS defines .aging-no-due-date-callout class',
  /\.aging-no-due-date-callout\b/.test(src.css),
);
check(
  'inv-aging-ui-9c: CSS defines .aging-tabs-strip class',
  /\.aging-tabs-strip\b/.test(src.css),
);

section('inv-aging-ui-10: CSS load path registered');
// The stylesheet may be loaded via index.html <link> OR via JS import
// in AgingReportPage.tsx. Either path satisfies the invariant.
const cssLinkInHtml = /href\s*=\s*["'][^"']*v2\.3-aging-report\.css["']/.test(
  src.indexHtml,
);
const cssImportInPage = /import\s+['"][^'"]*v2\.3-aging-report\.css['"]/.test(
  src.agingReportPage,
);
check(
  'inv-aging-ui-10: CSS registered via index.html <link> OR AgingReportPage import',
  cssLinkInHtml || cssImportInPage,
  cssLinkInHtml
    ? '(via index.html)'
    : cssImportInPage
      ? '(via JS import)'
      : 'neither path found',
);

// ---------------------------------------------------------------------------
// Build-hygiene pins (Round 1 lesson #20)
// ---------------------------------------------------------------------------

section('inv-aging-ui-build-hygiene: TypeScript strict check guards');

// AgingReportPage's onBackToDashboard is optional (?:) so unused
// callers do not fail noUnusedParameters. The page itself uses
// useNavigate as a fallback; we verify both.
check(
  'inv-aging-ui-build-hygiene-1: AgingReportPage onBackToDashboard prop is optional',
  /onBackToDashboard\?\s*:\s*\(\)\s*=>\s*void/.test(src.agingReportPage),
);
check(
  'inv-aging-ui-build-hygiene-2: AgingReportPage imports useNavigate (fallback navigation)',
  /import\s*\{[^}]*\buseNavigate\b[^}]*\}\s*from\s*['"]react-router-dom['"]/.test(
    src.agingReportPage,
  ),
);

// NoDueDateCallout should have no unused imports.
check(
  'inv-aging-ui-build-hygiene-3: NoDueDateCallout imports only what it uses (no React import on JSX-only file)',
  // React 17+ classic JSX runtime: no React import required for JSX.
  // If a React import IS present, it must be used (e.g. React.ReactNode).
  !/^import\s+React\b/m.test(src.noDueDateCallout) ||
    /React\.\w+/.test(src.noDueDateCallout),
);

// ---------------------------------------------------------------------------

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const item of failures) {
    console.error(
      `- ${item.label}${item.evidence ? `: ${item.evidence}` : ''}`,
    );
  }
  process.exit(1);
}
