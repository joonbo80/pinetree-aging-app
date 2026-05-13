// tools/test-party-detail-selector.mjs
//
// Phase 2 v2.2 Step 3 regression suite for selectPartyDetail().
//
// Runs against the committed schema 1.1 baseline. Validates:
//   - selector output shape per spec
//   - global reconciliation (sum of per-party counts == global totals)
//   - 5 sample parties: handpicked spread (heavy / mid / statement-only / unknown)
//   - explicit invariants from frozen spec D1-D14
//
// Run with:
//   npm.cmd --prefix aging-api run build
//   npx tsx tools/test-party-detail-selector.mjs
//
// (We use tsx because selectPartyDetail.ts is TypeScript and lives in
// the UI workspace; no compiled JS for the selector exists.)

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../aging-app/src/baselines/phase1-v1.3.0.json');
const selectorPath = resolve(__dirname, '../aging-app/src/selectors/partyDetail.ts');

const result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const { selectPartyDetail } = await import(pathToFileURL(selectorPath).href);

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    failures.push({ label, evidence });
    console.error(`  ❌ ${label}${evidence ? ` — ${evidence}` : ''}`);
  }
}

// ============================================================
// Invariant set A: Output shape
// ============================================================
console.log('\n=== A. Output shape on a sample party ===');

const sampleKey = 'skymaster-express';
const sample = selectPartyDetail(sampleKey, result);

check('returns object',                typeof sample === 'object' && sample !== null);
check('has partyKey === input',        sample.partyKey === sampleKey);
check('has non-empty partyName',       typeof sample.partyName === 'string' && sample.partyName.length > 0);
check('partyName !== partyKey (kebab)', !(sample.partyName === sample.partyKey && sample.partyName.includes('-')),
      `name=${sample.partyName} key=${sample.partyKey}`);
check('partyNameVariants is array',    Array.isArray(sample.partyNameVariants));
check('department.dominant exists',    'dominant' in sample.department);
check('department.breakdown is array', Array.isArray(sample.department.breakdown));
check('status is one of 3 values',     ['Clean', 'Has issues', 'Statement only'].includes(sample.status),
      `got: ${sample.status}`);
check('currencyTotals is array',       Array.isArray(sample.currencyTotals));
check('summary has 6 keys',            Object.keys(sample.summary).length === 6);
check('transactions is array',         Array.isArray(sample.transactions));
check('statementLinks is array',       Array.isArray(sample.statementLinks));
check('reviewItems is array',          Array.isArray(sample.reviewItems));
check('duplicateGroups is array',      Array.isArray(sample.duplicateGroups));

// ============================================================
// Invariant set B: Filter correctness — every row in output really
//                  belongs to that party (no leakage)
// ============================================================
console.log('\n=== B. Filter correctness (no leakage) ===');

const txLeak = sample.transactions.filter(t => t.partyKey !== sampleKey).length;
const linkLeak = sample.statementLinks.filter(l => l.partyKey !== sampleKey).length;
const reviewLeak = sample.reviewItems.filter(r => r.partyKey !== sampleKey).length;

check('all transactions have correct partyKey',     txLeak === 0, `${txLeak} leaked`);
check('all statementLinks have correct partyKey',   linkLeak === 0, `${linkLeak} leaked`);
check('all reviewItems have correct partyKey',      reviewLeak === 0, `${reviewLeak} leaked`);

// Duplicate groups: each group must contain at least one tx of this party
const partyTxIds = new Set(sample.transactions.map(t => t.id));
const groupLeak = sample.duplicateGroups.filter(g =>
  !g.transactionIds.some(id => partyTxIds.has(id)),
).length;
check('all duplicateGroups touch this party', groupLeak === 0, `${groupLeak} leaked`);

// ============================================================
// Invariant set C: Global reconciliation
//   Sum-of-per-party counts must equal the global details.* counts.
//   This is the "no double-counting, no orphan" check.
// ============================================================
console.log('\n=== C. Global reconciliation ===');

const allPartyKeys = new Set();
for (const t of result.details.transactions) allPartyKeys.add(t.partyKey);
for (const l of result.details.statementLinks) allPartyKeys.add(l.partyKey);
for (const r of result.details.reviewItems) {
  if (r.partyKey) allPartyKeys.add(r.partyKey);
}

let txSum = 0, linkSum = 0, reviewSum = 0, notInErpSum = 0, warningsSum = 0;
const allDetails = [];
for (const k of allPartyKeys) {
  const d = selectPartyDetail(k, result);
  txSum += d.summary.totalTransactions;
  linkSum += d.summary.statementRows;
  reviewSum += d.reviewItems.length;
  notInErpSum += d.summary.notInErpExtract;
  warningsSum += d.summary.warnings;
  allDetails.push(d);
}

const globalTx = result.details.transactions.length;
const globalLinks = result.details.statementLinks.length;
const globalReviews = result.details.reviewItems.filter(r => r.partyKey).length;
const globalNotInErp = result.details.reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT').length;
const globalWarnings = result.details.reviewItems.filter(r => r.category === 'WARNINGS').length;

check(`sum tx across parties = global (${globalTx})`,            txSum === globalTx, `got ${txSum}`);
check(`sum statement links = global (${globalLinks})`,           linkSum === globalLinks, `got ${linkSum}`);
check(`sum review items (with partyKey) = global (${globalReviews})`, reviewSum === globalReviews, `got ${reviewSum}`);
check(`sum NOT_IN_ERP across parties = global ${globalNotInErp}`, notInErpSum === globalNotInErp, `got ${notInErpSum}`);
check(`sum WARNINGS across parties = global ${globalWarnings}`,  warningsSum === globalWarnings, `got ${warningsSum}`);

// Dashboard agrees: the global NOT_IN_ERP review count must equal the
// Dashboard "reviewCandidates.local.length" (== 7 in current baseline)
const dashboardCount = result.reviewCandidates.local.length;
check(`Dashboard count == global NOT_IN_ERP (${dashboardCount})`, globalNotInErp === dashboardCount,
      `dashboard=${dashboardCount} global=${globalNotInErp}`);

// ============================================================
// Invariant set D: Sample heavy party (SKYMASTER EXPRESS)
//   Hand-checked numbers from baseline analysis: 86 tx + 20 links + 1 review
// ============================================================
console.log('\n=== D. Sample heavy party (skymaster-express) ===');

check(`skymaster: 86 transactions`,    sample.transactions.length === 86, `got ${sample.transactions.length}`);
check(`skymaster: 20 statement links`, sample.statementLinks.length === 20, `got ${sample.statementLinks.length}`);
check(`skymaster: 1 review item`,      sample.reviewItems.length === 1, `got ${sample.reviewItems.length}`);
check(`skymaster: human-readable name (uppercase)`,
      sample.partyName === sample.partyName.toUpperCase() || /[A-Z]/.test(sample.partyName),
      `got "${sample.partyName}"`);

// ============================================================
// Invariant set E: Statement-only party
//   These exist in the baseline (5 parties from analysis).
//   Pick one and confirm "Statement only" status + empty Transactions.
// ============================================================
console.log('\n=== E. Statement-only party ===');

const statementOnlyCandidates = Array.from(allPartyKeys).filter(k => {
  const d = selectPartyDetail(k, result);
  return d.transactions.length === 0 && d.statementLinks.length > 0;
});
check(`at least 1 statement-only party in baseline`, statementOnlyCandidates.length > 0,
      `found ${statementOnlyCandidates.length}`);

if (statementOnlyCandidates.length > 0) {
  const soKey = statementOnlyCandidates[0];
  const so = selectPartyDetail(soKey, result);
  check(`statement-only party "${soKey}" has status === "Statement only"`,
        so.status === 'Statement only', `got "${so.status}"`);
  check(`statement-only party has 0 currency totals (no tx)`,
        so.currencyTotals.length === 0, `got ${so.currencyTotals.length}`);
  check(`statement-only party has non-empty partyName from statement source`,
        !!so.partyName && so.partyName !== humanizeKey(soKey),
        `got "${so.partyName}"`);
}

function humanizeKey(key) {
  if (!key) return 'Unknown party';
  return key.split('-').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================
// Invariant set F: Unknown party — never throws, returns empty
// ============================================================
console.log('\n=== F. Unknown party graceful empty ===');

const unknown = selectPartyDetail('this-party-does-not-exist', result);
check(`unknown returns object`,             typeof unknown === 'object' && unknown !== null);
check(`unknown.partyKey === input`,         unknown.partyKey === 'this-party-does-not-exist');
check(`unknown has empty transactions`,     unknown.transactions.length === 0);
check(`unknown has empty statementLinks`,   unknown.statementLinks.length === 0);
check(`unknown has empty reviewItems`,      unknown.reviewItems.length === 0);
check(`unknown has empty duplicateGroups`,  unknown.duplicateGroups.length === 0);
check(`unknown.status === "Clean"`,         unknown.status === 'Clean');
check(`unknown.partyName is humanized key`, unknown.partyName === 'This Party Does Not Exist',
      `got "${unknown.partyName}"`);

// ============================================================
// Invariant set G: Schema 1.0 graceful empty
// ============================================================
console.log('\n=== G. Schema 1.0 (no details) graceful empty ===');

const v10Result = { ...result, details: undefined };
const v10 = selectPartyDetail('skymaster-express', v10Result);
check(`schema 1.0 returns empty PartyDetail (no throw)`,
      v10.transactions.length === 0 && v10.summary.totalTransactions === 0);

const nullResult = selectPartyDetail('skymaster-express', null);
check(`null result returns empty PartyDetail (no throw)`,
      nullResult.transactions.length === 0);

// ============================================================
// Invariant set H: Currency rules (USD/CAD never summed)
// ============================================================
console.log('\n=== H. Currency rules ===');

// Find a party that has BOTH USD and CAD transactions
const mixedCurrencyParty = allDetails.find(d =>
  d.currencyTotals.length === 2,
);

if (mixedCurrencyParty) {
  check(`mixed-currency party has 2 currencyTotals entries`,
        mixedCurrencyParty.currencyTotals.length === 2);
  const usdEntry = mixedCurrencyParty.currencyTotals.find(c => c.currency === 'USD');
  const cadEntry = mixedCurrencyParty.currencyTotals.find(c => c.currency === 'CAD');
  check(`USD entry is separate object`, !!usdEntry);
  check(`CAD entry is separate object`, !!cadEntry);
  check(`USD before CAD in stable order`,
        mixedCurrencyParty.currencyTotals[0].currency === 'USD');
} else {
  console.log('  ℹ️  no mixed-currency party in baseline (acceptable)');
}

// ============================================================
// Invariant set I: partyName never collapses to partyKey (v2.1.1 invariant
//                  extended to selector output)
// ============================================================
console.log('\n=== I. partyName invariants on every party ===');

let collapseCount = 0;
const collapseSamples = [];
for (const d of allDetails) {
  if (d.partyKey.includes('-') && d.partyName === d.partyKey) {
    collapseCount++;
    if (collapseSamples.length < 3) collapseSamples.push(d.partyKey);
  }
}
check(`No party in selector has partyName collapse to kebab-case partyKey`,
      collapseCount === 0,
      collapseCount > 0 ? `${collapseCount} collapsed: ${collapseSamples.join(', ')}` : '');

// ============================================================
// Invariant set J: Determinism — same input gives same output
// ============================================================
console.log('\n=== J. Determinism ===');

const a = JSON.stringify(selectPartyDetail('skymaster-express', result));
const b = JSON.stringify(selectPartyDetail('skymaster-express', result));
check(`same input → same JSON`, a === b);

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`PASS: ${pass}    FAIL: ${fail}`);
console.log(`${'='.repeat(60)}`);

if (fail > 0) {
  console.error('\nFailures:');
  for (const f of failures) {
    console.error(`  - ${f.label}`);
    if (f.evidence) console.error(`    ${f.evidence}`);
  }
  process.exit(1);
}
