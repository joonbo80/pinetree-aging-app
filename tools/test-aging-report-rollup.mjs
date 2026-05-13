// inv-aging-rollup invariants for v2.3 C2 Round 3.
//
// Pins the party rollup table layer: AgingTabs renders the table,
// rows expand to transaction details, Open Party Detail routes to
// /party/:partyKey, and selector output still supports the expected
// party-row counts and priority sort.
//
// Run with:
//   node --experimental-strip-types tools/test-aging-report-rollup.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const paths = {
  agingTabs: resolve(root, 'aging-app/src/components/aging/AgingTabs.tsx'),
  partyRollupTable: resolve(
    root,
    'aging-app/src/components/aging/PartyRollupTable.tsx',
  ),
  transactionRows: resolve(
    root,
    'aging-app/src/components/aging/TransactionRows.tsx',
  ),
  css: resolve(root, 'aging-app/src/styles/v2.3-aging-report.css'),
  selectorTs: resolve(root, 'aging-app/src/selectors/agingReport.ts'),
  baseline: resolve(root, 'aging-app/src/baselines/phase1-v1.3.0.json'),
  dashboardTsx: resolve(
    root,
    'aging-app/src/components/dashboard/Dashboard.tsx',
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
  agingTabs: readIf(paths.agingTabs),
  partyRollupTable: readIf(paths.partyRollupTable),
  transactionRows: readIf(paths.transactionRows),
  css: readIf(paths.css),
  dashboardTsx: readIf(paths.dashboardTsx),
};

section('inv-aging-rollup-1: component files exist');
check('PartyRollupTable.tsx exists', src.partyRollupTable.length > 0);
check('TransactionRows.tsx exists', src.transactionRows.length > 0);
check(
  'AgingTabs imports PartyRollupTable',
  /import\s*\{\s*PartyRollupTable\s*\}\s*from\s*['"]\.\/PartyRollupTable['"]/.test(
    src.agingTabs,
  ),
);
check(
  'AgingTabs no longer renders Round 3 placeholder text',
  !/Party rollup table for the \{activeTab\} tab arrives in\s+Round 3/.test(
    src.agingTabs,
  ),
);

section('inv-aging-rollup-2: table structure and expansion');
check(
  'PartyRollupTable exports component',
  /export\s+function\s+PartyRollupTable\b/.test(src.partyRollupTable),
);
check(
  'PartyRollupTable uses useState for expanded row ids',
  /useState<Set<string>>/.test(src.partyRollupTable),
);
check(
  'PartyRollupTable renders aria-expanded toggle',
  /aria-expanded=\{isExpanded\}/.test(src.partyRollupTable),
);
check(
  'PartyRollupTable renders TransactionRows when expanded',
  /<TransactionRows\s+rows=\{row\.transactions\}/.test(src.partyRollupTable),
);
check(
  'PartyRollupTable uses colSpan for detail row',
  /colSpan=\{11\}/.test(src.partyRollupTable),
);

section('inv-aging-rollup-3: Party Detail navigation');
check(
  'PartyRollupTable imports useNavigate',
  /useNavigate/.test(src.partyRollupTable),
);
check(
  'Open Party Detail button label present',
  /Open Party Detail/.test(src.partyRollupTable),
);
check(
  'navigate routes to /party/:partyKey',
  /navigate\(`\/party\/\$\{row\.partyKey\}`\)/.test(src.partyRollupTable),
);

section('inv-aging-rollup-4: table columns and badges');
for (const label of [
  'Party',
  'Currency',
  'Direction',
  'Amount',
  'Invoices',
  'Oldest',
  'Statement',
  'Readiness',
  'Priority',
  'Action',
]) {
  check(`column header "${label}" present`, src.partyRollupTable.includes(label));
}
check(
  'Statement badge formatter covers Balance Difference',
  /Balance Difference/.test(src.partyRollupTable),
);
check(
  'Action Readiness formatter covers Ready to Follow Up',
  /Ready to Follow Up/.test(src.partyRollupTable),
);
check(
  'Priority formatter covers Review First',
  /Review First/.test(src.partyRollupTable),
);

section('inv-aging-rollup-5: transaction row details');
check(
  'TransactionRows renders source file and row',
  /\{row\.sourceFile\}:\{row\.sourceRow\}/.test(src.transactionRows),
);
check(
  'TransactionRows renders statement status',
  /row\.statementStatus/.test(src.transactionRows),
);
check(
  'TransactionRows renders action readiness',
  /row\.actionReadiness/.test(src.transactionRows),
);
check(
  'TransactionRows renders signed balance amount',
  /row\.signedBalance/.test(src.transactionRows),
);

section('inv-aging-rollup-6: CSS classes present');
for (const className of [
  'aging-rollup-table',
  'aging-rollup-row',
  'aging-rollup-detail-row',
  'aging-transaction-table',
  'aging-direction-pill',
  'dashboard-workbench-cta',
]) {
  check(`CSS defines .${className}`, new RegExp(`\\.${className}\\b`).test(src.css));
}
check(
  'Dashboard CTA cleanup: panel header no longer contains duplicate title injection',
  !/panel-title">Open Collection Workbench[\s\S]{0,300}panel-title">Aging Bucket/.test(
    src.dashboardTsx,
  ),
);

section('inv-aging-rollup-7: real selector output supports table counts');
let agingReportModule;
let importError = null;
try {
  agingReportModule = await import(
    'file://' + paths.selectorTs.replace(/\\/g, '/')
  );
} catch (err) {
  importError = err;
}
check(
  'selector module imports',
  agingReportModule != null,
  importError ? importError.message : '',
);

if (agingReportModule && existsSync(paths.baseline)) {
  const baseline = JSON.parse(readFileSync(paths.baseline, 'utf8'));
  const report = agingReportModule.selectAgingReport(baseline);
  check('Current tab party rows = 7', report.tabs.current.parties.length === 7);
  check('Overdue tab party rows = 109', report.tabs.overdue.parties.length === 109);
  check('Cleared tab party rows = 152', report.tabs.cleared.parties.length === 152);
  check(
    'Overdue first row is IATA CAD payable Review First',
    report.tabs.overdue.parties[0]?.partyKey === 'iata-cargo-accounts' &&
      report.tabs.overdue.parties[0]?.currency === 'CAD' &&
      report.tabs.overdue.parties[0]?.direction === 'payable' &&
      report.tabs.overdue.parties[0]?.priorityBand === 'ReviewFirst',
  );
  check(
    'IATA overdue rollup has 42 transactions',
    report.tabs.overdue.parties[0]?.transactions.length === 42,
  );
}

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
