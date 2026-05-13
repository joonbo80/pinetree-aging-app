// tools/test-aging-report-badges.mjs
//
// Round 4 invariant test for Statement Collection Workbench badge
// polish, row-level highlighting, and statement-difference pinning.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const tablePath = resolve(
  root,
  'aging-app/src/components/aging/PartyRollupTable.tsx',
);
const txPath = resolve(
  root,
  'aging-app/src/components/aging/TransactionRows.tsx',
);
const cssPath = resolve(root, 'aging-app/src/styles/v2.3-aging-report.css');
const baselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);
const selectorPath = resolve(root, 'aging-app/src/selectors/agingReport.ts');

const tableSource = readFileSync(tablePath, 'utf8');
const txSource = readFileSync(txPath, 'utf8');
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

function countRows(rows, predicate) {
  return rows.filter(predicate).length;
}

console.log('=== Round 4 source invariants ===');

check(
  'rollup signal class helper exists',
  tableSource.includes('function rollupSignalClasses(row: PartyRollup)'),
);
check(
  'signal chip helper exists',
  tableSource.includes('function signalChips(row: PartyRollup)'),
);
check(
  'statement difference predicate handles BalanceDifference',
  tableSource.includes("value === 'BalanceDifference'"),
);
check(
  'statement difference predicate handles SettledAfterStatement',
  tableSource.includes("value === 'SettledAfterStatement'"),
);
check(
  'statement difference chip is rendered first',
  tableSource.indexOf("key: 'statement-diff'") <
    tableSource.indexOf("key: 'duplicate'") &&
    tableSource.indexOf("key: 'statement-diff'") <
      tableSource.indexOf("key: 'ninety-plus'"),
);
check(
  'signal cluster is rendered under party identity',
  tableSource.includes('className="aging-signal-cluster"'),
);
check(
  'high amount threshold is explicit',
  tableSource.includes('const HIGH_AMOUNT_THRESHOLD = 10000'),
);
check(
  'rollup row receives computed signal classes',
  tableSource.includes('className={rollupSignalClasses(row)}'),
);

console.log('=== Transaction row invariants ===');

check(
  'transaction row has computed signal class helper',
  txSource.includes('function transactionSignalClass(row: TransactionRow)'),
);
check(
  'transaction rows get signal classes',
  txSource.includes('className={transactionSignalClass(row)}'),
);
check(
  'transaction statement value is shown as a mini badge',
  txSource.includes('aging-mini-badge statement-'),
);
check(
  'transaction readiness value is shown as a mini badge',
  txSource.includes('aging-mini-badge readiness-'),
);

console.log('=== CSS invariants ===');

check(
  'signal cluster CSS exists',
  cssSource.includes('.aging-signal-cluster'),
);
check(
  'statement diff signal chip CSS exists',
  cssSource.includes('.aging-signal-chip.statement-diff'),
);
check(
  'statement diff rollup row receives left rail',
  cssSource.includes('.aging-rollup-row.signal-statement-diff > td:first-child'),
);
check(
  'statement diff transaction row receives left rail',
  cssSource.includes('.aging-transaction-row.signal-statement-diff > td:first-child'),
);
check(
  'high amount row treatment exists',
  cssSource.includes('.aging-rollup-row.signal-high-amount > td'),
);
check(
  '90+ row treatment exists',
  cssSource.includes('.aging-rollup-row.signal-ninety-plus > td'),
);
check(
  'mini badge CSS exists',
  cssSource.includes('.aging-mini-badge.statement-BalanceDifference'),
);

console.log('=== Runtime selector signal invariants ===');

const { selectAgingReport } = await import(`file://${selectorPath}`);
const report = selectAgingReport(baseline);
const parties = [
  ...report.tabs.current.parties,
  ...report.tabs.overdue.parties,
  ...report.tabs.cleared.parties,
];
const txRows = parties.flatMap((row) => row.transactions);

check(
  'runtime has statement-difference rollup rows',
  countRows(parties, (row) =>
    row.statementStatus === 'BalanceDifference' ||
    row.statementStatus === 'SettledAfterStatement',
  ) === 21,
);
check(
  'runtime has review-first rollup rows',
  countRows(parties, (row) => row.priorityBand === 'ReviewFirst') === 28,
);
check(
  'runtime has high-amount rollup rows',
  countRows(parties, (row) => Math.abs(row.openAmount) >= 10000) === 10,
);
check(
  'runtime has 90+ rollup rows',
  countRows(parties, (row) => row.ninetyPlusCount > 0) === 58,
);
check(
  'runtime has transaction rows with statement differences',
  countRows(txRows, (row) =>
    row.statementStatus === 'BalanceDifference' ||
    row.statementStatus === 'SettledAfterStatement',
  ) > 0,
);

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
