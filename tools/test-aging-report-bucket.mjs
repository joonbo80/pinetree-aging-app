// tools/test-aging-report-bucket.mjs
//
// Round 7 invariant test for the Overdue aging bucket breakdown.
// Imports the production bucket helper directly.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const logicPath = resolve(
  root,
  'aging-app/src/components/aging/agingBucketLogic.ts',
);
const componentPath = resolve(
  root,
  'aging-app/src/components/aging/AgingBucketBreakdown.tsx',
);
const tabsPath = resolve(
  root,
  'aging-app/src/components/aging/AgingTabs.tsx',
);
const cssPath = resolve(root, 'aging-app/src/styles/v2.3-aging-report.css');
const selectorPath = resolve(root, 'aging-app/src/selectors/agingReport.ts');
const filterPath = resolve(
  root,
  'aging-app/src/components/aging/agingFilterLogic.ts',
);
const baselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);

const logicSource = readFileSync(logicPath, 'utf8');
const componentSource = readFileSync(componentPath, 'utf8');
const tabsSource = readFileSync(tabsPath, 'utf8');
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

function byBucket(rows, bucket) {
  const found = rows.find((row) => row.bucket === bucket);
  if (!found) throw new Error(`Missing bucket ${bucket}`);
  return found;
}

console.log('=== Round 7 source invariants ===');

check(
  'agingBucketLogic.ts exports buildBucketBreakdown',
  logicSource.includes('export function buildBucketBreakdown'),
);
check(
  'agingBucketLogic.ts exports BUCKET_ORDER',
  logicSource.includes('export const BUCKET_ORDER'),
);
check(
  'BUCKET_ORDER is exactly 0-30, 31-60, 61-90, 90+',
  /\[\s*'0-30',\s*'31-60',\s*'61-90',\s*'90\+',\s*\]/s.test(logicSource),
);
check(
  'bucket helper imports selector types with .ts extension',
  logicSource.includes("from '../../selectors/agingReport.ts'"),
);
check(
  'bucket helper preserves currency + direction separation',
  logicSource.includes('summary.totals[currency].payable') &&
    logicSource.includes('summary.totals[currency].receivable'),
);
check(
  'AgingBucketBreakdown imports production helper',
  componentSource.includes("from './agingBucketLogic.ts'"),
);
check(
  'AgingBucketBreakdown renders calm explanation copy',
  componentSource.includes('Overdue only. USD/CAD and AR/AP remain separated.'),
);
check(
  'AgingTabs imports AgingBucketBreakdown',
  tabsSource.includes("import { AgingBucketBreakdown }"),
);
check(
  'AgingTabs renders breakdown only for Overdue tab',
  tabsSource.includes("activeTab === 'overdue'") &&
    tabsSource.includes('<AgingBucketBreakdown tabData={activeData} />'),
);
check(
  'AgingTabs places breakdown before PartyRollupTable',
  tabsSource.indexOf('<AgingBucketBreakdown tabData={activeData} />') >
    -1 &&
    tabsSource.indexOf('<AgingBucketBreakdown tabData={activeData} />') <
      tabsSource.indexOf('<PartyRollupTable tabId={activeTab} data={activeData} />'),
);
check(
  'bucket breakdown CSS exists',
  cssSource.includes('.aging-bucket-breakdown') &&
    cssSource.includes('.aging-bucket-grid') &&
    cssSource.includes('.aging-bucket-cell'),
);
check(
  'bucket breakdown CSS has responsive single-column fallback',
  cssSource.includes('.aging-bucket-grid') &&
    cssSource.includes('grid-template-columns: 1fr'),
);

console.log('=== Round 7 production output invariants ===');

const { selectAgingReport } = await import(`file://${selectorPath}`);
const { filterAgingTabData } = await import(`file://${filterPath}`);
const { buildBucketBreakdown } = await import(`file://${logicPath}`);

const report = selectAgingReport(baseline);
const emptyFilters = {
  asOfDate: '2026-05-01',
  currencies: [],
  directions: [],
  signals: [],
};
const cadFilters = {
  ...emptyFilters,
  currencies: ['CAD'],
};

const overdue = report.tabs.overdue;
const breakdown = buildBucketBreakdown(overdue);
const filteredCadBreakdown = buildBucketBreakdown(
  filterAgingTabData(overdue, cadFilters),
);

const b0030 = byBucket(breakdown, '0-30');
const b3160 = byBucket(breakdown, '31-60');
const b6190 = byBucket(breakdown, '61-90');
const b90 = byBucket(breakdown, '90+');

check('breakdown returns four buckets', breakdown.length === 4);
check(
  'breakdown bucket order is stable',
  breakdown.map((row) => row.bucket).join('|') === '0-30|31-60|61-90|90+',
);
check(
  'sum of bucket transaction counts equals Overdue count 463',
  breakdown.reduce((sum, row) => sum + row.transactionCount, 0) === 463 &&
    overdue.transactionCount === 463,
);
check('0-30 bucket count is 213', b0030.transactionCount === 213);
check('31-60 bucket count is 204', b3160.transactionCount === 204);
check('61-90 bucket count is 33', b6190.transactionCount === 33);
check('90+ bucket count is 13', b90.transactionCount === 13);
check(
  '0-30 bucket preserves USD AR/AP totals',
  closeEnough(b0030.totals.USD.receivable, 62049.17) &&
    closeEnough(b0030.totals.USD.payable, -4769.48),
);
check(
  '0-30 bucket preserves CAD AR/AP totals',
  closeEnough(b0030.totals.CAD.receivable, 82103.26) &&
    closeEnough(b0030.totals.CAD.payable, -115506.11),
);
check(
  '31-60 bucket preserves CAD AP total',
  closeEnough(b3160.totals.CAD.payable, -159991.64),
);
check(
  '61-90 bucket preserves USD AP total',
  closeEnough(b6190.totals.USD.payable, -5186.43),
);
check(
  '90+ bucket preserves all four currency/direction totals',
  closeEnough(b90.totals.USD.receivable, 2746.16) &&
    closeEnough(b90.totals.USD.payable, -870.29) &&
    closeEnough(b90.totals.CAD.receivable, 955) &&
    closeEnough(b90.totals.CAD.payable, 0),
);
check(
  'CAD filter changes bucket counts and keeps total below all-overdue total',
  filteredCadBreakdown.reduce((sum, row) => sum + row.transactionCount, 0) > 0 &&
    filteredCadBreakdown.reduce((sum, row) => sum + row.transactionCount, 0) <
      463,
);
check(
  'CAD filter removes USD totals from bucket output',
  filteredCadBreakdown.every(
    (row) =>
      closeEnough(row.totals.USD.receivable, 0) &&
      closeEnough(row.totals.USD.payable, 0),
  ),
);

console.log(`PASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  process.exitCode = 1;
}
