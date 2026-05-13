// tools/test-aging-report-filter.mjs
//
// Round 5 invariant test for URL-backed quick filters, native asOfDate,
// and multi-AND filter behavior in the Statement Collection Workbench.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

const hookPath = resolve(root, 'aging-app/src/hooks/useAgingFilters.ts');
const filtersPath = resolve(
  root,
  'aging-app/src/components/aging/AgingFilters.tsx',
);
const tabsPath = resolve(root, 'aging-app/src/components/aging/AgingTabs.tsx');
const logicPath = resolve(
  root,
  'aging-app/src/components/aging/agingFilterLogic.ts',
);
const pagePath = resolve(root, 'aging-app/src/pages/AgingReportPage.tsx');
const cssPath = resolve(root, 'aging-app/src/styles/v2.3-aging-report.css');
const selectorPath = resolve(root, 'aging-app/src/selectors/agingReport.ts');
const baselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);

const hookSource = readFileSync(hookPath, 'utf8');
const filtersSource = readFileSync(filtersPath, 'utf8');
const tabsSource = readFileSync(tabsPath, 'utf8');
const logicSource = readFileSync(logicPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}`);
  }
}

function closeEnough(actual, expected) {
  return Math.abs(actual - expected) < 0.01;
}

console.log('=== Round 5 URL state invariants ===');

check(
  'useAgingFilters hook exists',
  hookSource.includes('export function useAgingFilters'),
);
check(
  'useAgingFilters uses useSearchParams',
  hookSource.includes('useSearchParams'),
);
check(
  'URL param key asOf is used',
  hookSource.includes("searchParams.get('asOf')") &&
    hookSource.includes("next.set('asOf', value)"),
);
check(
  'URL param key currency is CSV-backed',
  hookSource.includes("'currency'") && hookSource.includes('writeCsvParam'),
);
check(
  'URL param key direction is CSV-backed',
  hookSource.includes("'direction'") && hookSource.includes('writeCsvParam'),
);
check(
  'URL param key signal is CSV-backed',
  hookSource.includes("'signal'") && hookSource.includes('SIGNAL_VALUES'),
);
check(
  'clearAll removes asOf/currency/direction/signal',
  hookSource.includes("next.delete('asOf')") &&
    hookSource.includes("next.delete('currency')") &&
    hookSource.includes("next.delete('direction')") &&
    hookSource.includes("next.delete('signal')"),
);

console.log('=== Round 5 component wiring invariants ===');

check(
  'AgingReportPage imports useAgingFilters',
  pageSource.includes("import { useAgingFilters }"),
);
check(
  'AgingReportPage passes filters.asOfDate to selector',
  pageSource.includes('selectAgingReport(result, filters.asOfDate)'),
);
check(
  'AgingReportPage renders AgingFilters',
  pageSource.includes('<AgingFilters') &&
    pageSource.includes('defaultAsOfDate={defaultAsOfDate}'),
);
check(
  'AgingReportPage passes filters to AgingTabs',
  pageSource.includes('<AgingTabs report={report} filters={filters} />'),
);
check(
  'AgingFilters renders native date input',
  filtersSource.includes('type="date"'),
);
check(
  'AgingFilters exposes Currency / Direction / Signals groups',
  filtersSource.includes('<FilterGroup label="Currency">') &&
    filtersSource.includes('<FilterGroup label="Direction">') &&
    filtersSource.includes('<FilterGroup label="Signals">'),
);
check(
  'AgingFilters renders active removable chips',
  filtersSource.includes('aging-active-filter-chip') &&
    filtersSource.includes('Clear all filters'),
);
check(
  'AgingTabs imports production filter helper',
  tabsSource.includes("import { filterAgingTabData } from './agingFilterLogic.ts'"),
);
check(
  'AgingTabs keeps tab counts unfiltered and filters body data',
  tabsSource.includes('unfilteredActiveData') &&
    tabsSource.includes('filterAgingTabData(data, filters)'),
);

console.log('=== Round 5 CSS invariants ===');

check(
  'filter panel CSS exists',
  cssSource.includes('.aging-filter-panel'),
);
check(
  'active filter chip CSS exists',
  cssSource.includes('.aging-active-filter-chip'),
);
check(
  'active filter dot CSS exists',
  cssSource.includes('.aging-filter-chip-dot'),
);
check(
  'native asOf control CSS exists',
  cssSource.includes('.aging-asof-control input'),
);

console.log('=== Round 5 production filter output invariants ===');

const { selectAgingReport } = await import(`file://${selectorPath}`);
const { filterAgingTabData } = await import(`file://${logicPath}`);
const report = selectAgingReport(baseline);
const baseFilters = {
  asOfDate: '2026-05-01',
  currencies: [],
  directions: [],
  signals: [],
};

const cad = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  currencies: ['CAD'],
});
check('CAD filter returns 66 overdue party rows', cad.parties.length === 66);
check('CAD filter returns 302 transactions', cad.transactionCount === 302);
check(
  'CAD filter keeps USD totals at zero',
  cad.totals.USD.receivable === 0 && cad.totals.USD.payable === 0,
);

const cadPayable = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  currencies: ['CAD'],
  directions: ['payable'],
});
check(
  'CAD + payable multi-AND returns 48 party rows',
  cadPayable.parties.length === 48,
);
check(
  'CAD + payable keeps receivable at zero',
  cadPayable.totals.CAD.receivable === 0 &&
    closeEnough(cadPayable.totals.CAD.payable, -275497.75),
);

const statementDiff = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  signals: ['statementDiff'],
});
check(
  'Statement Diff filter returns 5 overdue party rows',
  statementDiff.parties.length === 5,
);
check(
  'Statement Diff filter includes IATA first',
  statementDiff.parties[0]?.partyKey === 'iata-cargo-accounts',
);

const statementDiffHigh = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  signals: ['statementDiff', 'highAmount'],
});
check(
  'Statement Diff + High Amount multi-AND returns 3 rows',
  statementDiffHigh.parties.length === 3,
);
check(
  'Statement Diff + High Amount returns 84 transactions',
  statementDiffHigh.transactionCount === 84,
);

const duplicate = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  signals: ['duplicate'],
});
check('Duplicate filter returns 24 rows', duplicate.parties.length === 24);

const ninetyPlus = filterAgingTabData(report.tabs.overdue, {
  ...baseFilters,
  signals: ['ninetyPlus'],
});
check('90+ filter returns 6 rows', ninetyPlus.parties.length === 6);
check(
  '90+ filter first row is LEMOND',
  ninetyPlus.parties[0]?.partyKey === 'lemond-food-corp-new-addr',
);

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
