// inv-aging-data invariants for v2.3 C2 Round 1.
//
// Round 1 rev2: rewritten to import the selector .ts directly and
// assert its REAL output against expected baseline numbers. The rev1
// version re-implemented classifyTab inside the invariant test, which
// did not actually verify the selector under test (Round 1 review
// P1-1: "test does not check selector output"). This rev2 fixes that.
//
// Requirements:
//   Node 22.6+  for TypeScript-strip-types support. Node 24 (user
//   mainline) has it stable. Invoke with:
//     node --experimental-strip-types tools/test-aging-report-view.mjs
//   On Node 23.6+ the flag is no-op (already stable) but harmless.
//   On Node 22.6+ the flag is required.
//
// Canonical paths:
//   aging-app/src/selectors/agingReport.ts  (selector under test)
//   aging-app/src/baselines/phase1-v1.3.0.json  (fixture)
//
// Expected on fixed state:  PASS: 30+   FAIL: 0
// Expected on broken state (selector absent): all source-level and
// runtime invariants FAIL.
//
// Spec references (v2.3 C2 micro-spec rev3 FROZEN):
//   Section 1.4   Fixture baseline numbers
//   Section 3.2   Statement Status mapping (4 values)
//   Section 3.4   Priority Band (Cleared FIRST)
//   Section 3.5   Tab classification (21 / 463 / 118 / 628 / 1230)
//   Section 7.4   NOT_IN_ERP_EXTRACT excluded
//   Q-A           HIGH_AMOUNT_THRESHOLD = 10,000 per currency
//   Round 1 rev2 P1-2: AR/AP never netted in rollup

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const selectorPath = resolve(
  root,
  'aging-app/src/selectors/agingReport.ts',
);
const baselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);

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

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

const selectorExists = existsSync(selectorPath);
const baselineExists = existsSync(baselinePath);

if (!baselineExists) {
  console.error(`Baseline fixture not found: ${baselinePath}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Source-level invariants
// ---------------------------------------------------------------------------

const source = selectorExists ? readFileSync(selectorPath, 'utf8') : '';

section('inv-aging-data-1: selectAgingReport export exists');
check(
  'inv-aging-data-1: selectAgingReport function is exported',
  /export\s+function\s+selectAgingReport\s*\(/.test(source),
);

section('inv-aging-data-2/3: tab classification structure');
check(
  'inv-aging-data-2: classifyTab evaluates isZeroBalance before dueDate',
  /function\s+classifyTab[\s\S]{0,400}?isZeroBalance[\s\S]{0,300}?dueDate/.test(
    source,
  ),
);
check(
  'inv-aging-data-3: classifyTab returns 4 bucket values',
  /'cleared'/.test(source) &&
    /'no-due-date-open'/.test(source) &&
    /'current'/.test(source) &&
    /'overdue'/.test(source),
);

section('inv-aging-data-4: Statement Status has exactly 4 values');
const statusUnionMatch = source.match(
  /export\s+type\s+StatementStatus\s*=([^;]+);/,
);
const statusUnion = statusUnionMatch ? statusUnionMatch[1] : '';
check(
  'inv-aging-data-4a: includes ExactMatch',
  /'ExactMatch'/.test(statusUnion),
);
check(
  'inv-aging-data-4b: includes BalanceDifference',
  /'BalanceDifference'/.test(statusUnion),
);
check(
  'inv-aging-data-4c: includes SettledAfterStatement',
  /'SettledAfterStatement'/.test(statusUnion),
);
check(
  'inv-aging-data-4d: includes NoStatement',
  /'NoStatement'/.test(statusUnion),
);
check(
  'inv-aging-data-4e: does NOT include NotInERP variants',
  !/NotInERP|NOT_IN_ERP/.test(statusUnion),
);

section('inv-aging-data-5: HIGH_AMOUNT_THRESHOLD = 10,000 per currency');
check(
  'inv-aging-data-5: source has both currencies at 10000',
  /HIGH_AMOUNT_THRESHOLD[\s\S]{0,200}USD:\s*10_?000[\s\S]{0,80}CAD:\s*10_?000/.test(
    source,
  ),
);

section('inv-aging-data-6/7: Priority Band Cleared first guard');
check(
  'inv-aging-data-6: evaluatePriorityBand returns Cleared on isZeroBalance before any other rule',
  /function\s+evaluatePriorityBand[^{]*\{[\s\S]{0,200}?if\s*\(\s*tx\.isZeroBalance\s*\)\s*return\s+'Cleared'/.test(
    source,
  ),
);
const priorityBodyMatch = source.match(
  /function\s+evaluatePriorityBand[\s\S]*?\n\}/,
);
const priorityBody = priorityBodyMatch ? priorityBodyMatch[0] : '';
const zeroBalanceMentions = (
  priorityBody.match(/isZeroBalance/g) || []
).length;
check(
  'inv-aging-data-7: evaluatePriorityBand checks isZeroBalance exactly once (early return)',
  zeroBalanceMentions === 1,
);

section('inv-aging-data-AR-AP-source: rollup grouping key includes direction');
check(
  'inv-aging-data-AR-AP-source-1: buildTabData groups by partyKey + currency + direction',
  /buildTabData[\s\S]{0,1500}?partyKey[\s\S]{0,100}?currency[\s\S]{0,100}?direction/.test(
    source,
  ),
);
check(
  'inv-aging-data-AR-AP-source-2: PartyRollup interface has direction field',
  /export interface PartyRollup\b[\s\S]{0,800}?direction\s*:\s*Direction/.test(
    source,
  ),
);

// ---------------------------------------------------------------------------
// Runtime invariants: import selector and assert on real output
// ---------------------------------------------------------------------------

let agingReportModule;
let importError = null;

if (selectorExists) {
  try {
    agingReportModule = await import(pathToFileURL(selectorPath).href);
  } catch (err) {
    importError = err;
  }
}

section('inv-aging-data-import: selector module importable');
check(
  'inv-aging-data-import: selector module loaded successfully',
  agingReportModule != null,
  importError
    ? `import error: ${importError.message}`
    : selectorExists
      ? 'unknown'
      : 'selector source absent',
);

if (agingReportModule) {
  const { selectAgingReport, HIGH_AMOUNT_THRESHOLD } = agingReportModule;
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const report = selectAgingReport(baseline);

  section('inv-aging-data-output-coverage: real selector tab counts');
  const currentTxCount = report.tabs.current.transactionCount;
  const overdueTxCount = report.tabs.overdue.transactionCount;
  const clearedTxCount = report.tabs.cleared.transactionCount;
  const noDueOpenCount = report.noDueDate.openCount;
  const sum =
    currentTxCount + overdueTxCount + clearedTxCount + noDueOpenCount;

  check(
    'inv-aging-data-output-1: current = 21',
    currentTxCount === 21,
    `actual ${currentTxCount}`,
  );
  check(
    'inv-aging-data-output-2: overdue = 463',
    overdueTxCount === 463,
    `actual ${overdueTxCount}`,
  );
  check(
    'inv-aging-data-output-3: no-due-date open = 118',
    noDueOpenCount === 118,
    `actual ${noDueOpenCount}`,
  );
  check(
    'inv-aging-data-output-4: cleared = 628',
    clearedTxCount === 628,
    `actual ${clearedTxCount}`,
  );
  check(
    'inv-aging-data-output-5: total coverage = 1,230',
    sum === 1230,
    `actual ${sum}`,
  );
  check(
    'inv-aging-data-output-6: coverageSum equals totalTransactions',
    report.coverageSum === report.totalTransactions,
    `${report.coverageSum} vs ${report.totalTransactions}`,
  );

  section('inv-aging-data-output-status: only 4 Statement Status values appear');
  const usedStatuses = new Set();
  for (const tab of [
    report.tabs.current,
    report.tabs.overdue,
    report.tabs.cleared,
  ]) {
    for (const party of tab.parties) {
      for (const t of party.transactions) {
        usedStatuses.add(t.statementStatus);
      }
    }
  }
  for (const t of report.noDueDate.transactions) {
    usedStatuses.add(t.statementStatus);
  }
  const expectedStatuses = new Set([
    'ExactMatch',
    'BalanceDifference',
    'SettledAfterStatement',
    'NoStatement',
  ]);
  check(
    'inv-aging-data-output-status-1: only 4 spec values in output',
    [...usedStatuses].every((s) => expectedStatuses.has(s)),
    `actual: ${[...usedStatuses].join(', ')}`,
  );
  check(
    'inv-aging-data-output-status-2: no NotInERP variants',
    ![...usedStatuses].some((s) => /NotInERP|NOT_IN_ERP/.test(s)),
  );

  section('inv-aging-data-output-AR-AP: rollup never nets AR with AP');
  const openTabs = [report.tabs.current, report.tabs.overdue];
  const partyCurrencyDirections = new Map();
  for (const tab of openTabs) {
    for (const party of tab.parties) {
      const key = `${party.partyKey}__${party.currency}`;
      if (!partyCurrencyDirections.has(key)) {
        partyCurrencyDirections.set(key, new Set());
      }
      partyCurrencyDirections.get(key).add(party.direction);
    }
  }
  let mixedPartyCount = 0;
  for (const dirs of partyCurrencyDirections.values()) {
    if (dirs.has('receivable') && dirs.has('payable')) {
      mixedPartyCount++;
    }
  }
  // Baseline has 6 (party, currency) pairs with mixed AR+AP across
  // the full open scope (Current + Overdue + No Due Date bucket).
  // The Current and Overdue tabs alone contain 3 of those 6 mixed
  // pairs (the other 3 are split between Overdue and No Due Date
  // bucket, which has its own representation).
  //
  // We check the (Current + Overdue) view here because those are the
  // two tabs that use party rollup. The No Due Date bucket is rendered
  // as a flat row list (no rollup), so the netting concern does not
  // arise there.
  check(
    'inv-aging-data-output-AR-AP-1: 3 mixed AR+AP party-currency pairs in (Current + Overdue) appear as separate rollup rows',
    mixedPartyCount === 3,
    `actual ${mixedPartyCount}`,
  );

  const wigRollups = [];
  for (const tab of openTabs) {
    for (const party of tab.parties) {
      if (
        party.partyKey === 'wig-beauty-outlet' &&
        party.currency === 'CAD'
      ) {
        wigRollups.push(party);
      }
    }
  }
  const wigAR = wigRollups.find((p) => p.direction === 'receivable');
  const wigAP = wigRollups.find((p) => p.direction === 'payable');
  check(
    'inv-aging-data-output-AR-AP-2: wig-beauty-outlet CAD has separate receivable rollup',
    wigAR != null,
    wigAR ? `openAmount=${wigAR.openAmount.toFixed(2)}` : 'missing',
  );
  check(
    'inv-aging-data-output-AR-AP-3: wig-beauty-outlet CAD has separate payable rollup',
    wigAP != null,
    wigAP ? `openAmount=${wigAP.openAmount.toFixed(2)}` : 'missing',
  );
  // wig-beauty-outlet has 4 open CAD transactions in baseline:
  //   - 2 receivable in Overdue tab (sum = 182.44)
  //   - 1 receivable in No Due Date bucket (87.83, separate from tabs)
  //   - 1 payable in Overdue tab (-86.66)
  //
  // The Overdue rollup for wig-beauty must show AR (182.44) and AP
  // (-86.66) as TWO separate rows; netting them would produce 95.78
  // (wrong). Pre-rev2 selector that grouped only by (party, currency)
  // would have netted to 95.78.
  if (wigAR) {
    check(
      'inv-aging-data-output-AR-AP-4: wig-beauty-outlet Overdue AR rollup = 182.44 (sum of 2 receivable rows, not netted with AP)',
      Math.abs(wigAR.openAmount - 182.44) < 0.01,
      `openAmount=${wigAR.openAmount.toFixed(2)} (expected 182.44; if 95.78, AR/AP were netted)`,
    );
  }
  if (wigAP) {
    check(
      'inv-aging-data-output-AR-AP-5: wig-beauty-outlet Overdue AP rollup = -86.66 (1 payable row, not netted with AR)',
      Math.abs(wigAP.openAmount + 86.66) < 0.01,
      `openAmount=${wigAP.openAmount.toFixed(2)} (expected -86.66)`,
    );
  }

  section('inv-aging-data-output-priority: Cleared band only on isZeroBalance');
  let badClearedCount = 0;
  let badNonClearedCount = 0;
  for (const tab of [report.tabs.current, report.tabs.overdue]) {
    for (const party of tab.parties) {
      for (const t of party.transactions) {
        if (!t.isZeroBalance && t.priorityBand === 'Cleared') {
          badClearedCount++;
        }
      }
    }
  }
  for (const party of report.tabs.cleared.parties) {
    for (const t of party.transactions) {
      if (t.isZeroBalance && t.priorityBand !== 'Cleared') {
        badNonClearedCount++;
      }
    }
  }
  check(
    'inv-aging-data-output-priority-1: no open row has Cleared band',
    badClearedCount === 0,
    `${badClearedCount} open rows mis-labeled Cleared`,
  );
  check(
    'inv-aging-data-output-priority-2: every settled row has Cleared band',
    badNonClearedCount === 0,
    `${badNonClearedCount} settled rows not labeled Cleared`,
  );

  section('inv-aging-data-output-threshold: HIGH_AMOUNT_THRESHOLD applied');
  check(
    'inv-aging-data-output-threshold-1: HIGH_AMOUNT_THRESHOLD.USD = 10000',
    HIGH_AMOUNT_THRESHOLD.USD === 10000,
  );
  check(
    'inv-aging-data-output-threshold-2: HIGH_AMOUNT_THRESHOLD.CAD = 10000',
    HIGH_AMOUNT_THRESHOLD.CAD === 10000,
  );
} else {
  console.log(
    '\n(Skipping runtime invariants because selector module did not load.)',
  );
}

// ---------------------------------------------------------------------------
// Baseline-fact invariants
// ---------------------------------------------------------------------------

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const stmts = baseline.details.statementLinks;

section('inv-aging-data-baseline: matchType distribution');
const matchTypeCounts = {};
for (const l of stmts) {
  matchTypeCounts[l.matchType] = (matchTypeCounts[l.matchType] || 0) + 1;
}
check(
  'inv-aging-data-baseline-1: EXACT_SIGNED = 231',
  matchTypeCounts.EXACT_SIGNED === 231,
  `actual ${matchTypeCounts.EXACT_SIGNED}`,
);
check(
  'inv-aging-data-baseline-2: BALANCE_DIFFERENCE = 97',
  matchTypeCounts.BALANCE_DIFFERENCE === 97,
  `actual ${matchTypeCounts.BALANCE_DIFFERENCE}`,
);
check(
  'inv-aging-data-baseline-3: SETTLED_AFTER_STATEMENT = 15',
  matchTypeCounts.SETTLED_AFTER_STATEMENT === 15,
  `actual ${matchTypeCounts.SETTLED_AFTER_STATEMENT}`,
);
check(
  'inv-aging-data-baseline-4: NOT_IN_ERP_EXTRACT = 95',
  matchTypeCounts.NOT_IN_ERP_EXTRACT === 95,
  `actual ${matchTypeCounts.NOT_IN_ERP_EXTRACT}`,
);

const notInErp = stmts.filter((l) => l.matchType === 'NOT_IN_ERP_EXTRACT');
check(
  'inv-aging-data-baseline-notinerp: all 95 NOT_IN_ERP_EXTRACT have null matchedTransactionId',
  notInErp.every((l) => !l.matchedTransactionId),
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
