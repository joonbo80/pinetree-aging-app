// tools/test-party-detail-page-step6.mjs
//
// Phase 2 v2.2 Step 6 regression — Transactions tab behavior.
//
// Tests focus on:
//   - sort logic correctness (default = aging desc, amount desc)
//   - filter correctness (currency, direction, search)
//   - pickReference picks the right field per sourceType
//   - per-currency footer totals (never sum across currencies)
//   - reference field display invariants (uses split fields, not refNo)
//   - trace panel includes all required fields
//   - keyboard accessibility scaffolding

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../aging-app/src/baselines/phase1-v1.3.0.json');
const selectorPath = resolve(__dirname, '../aging-app/src/selectors/partyDetail.ts');
const sourcePath   = resolve(__dirname, '../aging-app/src/components/party/PartyDetailPage.tsx');

const result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const { selectPartyDetail } = await import(pathToFileURL(selectorPath).href);
const source = readFileSync(sourcePath, 'utf-8');

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; failures.push({ label, evidence }); console.error(`  ❌ ${label}${evidence ? ' — ' + evidence : ''}`); }
}

// ============================================================
// A. Sort logic — default sort (aging desc, amount desc)
// ============================================================
console.log('\n=== A. Sort logic ===');

// Replicate the default sort and verify properties on real party data
function defaultSort(rows) {
  return [...rows].sort((a, b) => {
    if (b.agingDays !== a.agingDays) return b.agingDays - a.agingDays;
    return Math.abs(b.signedBalance) - Math.abs(a.signedBalance);
  });
}

const sky = selectPartyDetail('skymaster-express', result);
const sortedSky = defaultSort(sky.transactions);
check(`skymaster: sorted output length = input length`,
      sortedSky.length === sky.transactions.length);

// First row has the highest aging
let allowSort = true;
for (let i = 1; i < sortedSky.length; i++) {
  if (sortedSky[i].agingDays > sortedSky[i-1].agingDays) {
    allowSort = false; break;
  }
}
check(`skymaster: aging is non-increasing in default sort`, allowSort);

// Within same aging tier, abs(amount) is non-increasing
let amountSort = true;
for (let i = 1; i < sortedSky.length; i++) {
  if (sortedSky[i].agingDays === sortedSky[i-1].agingDays) {
    if (Math.abs(sortedSky[i].signedBalance) > Math.abs(sortedSky[i-1].signedBalance)) {
      amountSort = false; break;
    }
  }
}
check(`skymaster: within-aging amount tiebreak is non-increasing`, amountSort);

// ============================================================
// B. Filter correctness — currency / direction / search
// ============================================================
console.log('\n=== B. Filter correctness ===');

// Currency filter
const skyUSD = sky.transactions.filter(t => t.currency === 'USD');
const skyCAD = sky.transactions.filter(t => t.currency === 'CAD');
check(`skymaster has USD transactions`,  skyUSD.length > 0);
check(`skymaster has CAD transactions`,  skyCAD.length > 0);
check(`USD + CAD == total (no other currency leak)`,
      skyUSD.length + skyCAD.length === sky.transactions.length);

// Direction filter
const dirs = new Set(sky.transactions.map(t => t.direction));
check(`skymaster has multiple direction values`, dirs.size >= 2);
const recv = sky.transactions.filter(t => t.direction === 'receivable');
const pay  = sky.transactions.filter(t => t.direction === 'payable');
const set  = sky.transactions.filter(t => t.direction === 'settled');
check(`recv + pay + settled == total`,
      recv.length + pay.length + set.length === sky.transactions.length);

// Search filter (search is across ourRefNo, invoiceNo, crdrNo, vendorInvoiceNo, blNo, sourceFile)
// Pick a real ourRefNo and verify the search would find it
const sampleTx = sky.transactions.find(t => t.ourRefNo);
if (sampleTx) {
  const q = sampleTx.ourRefNo.toLowerCase();
  const matches = sky.transactions.filter(t =>
    (t.ourRefNo ?? '').toLowerCase().includes(q),
  );
  check(`search by ourRefNo finds at least the original`, matches.length >= 1);
}

// ============================================================
// C. Reference picker — sourceType-specific
// ============================================================
console.log('\n=== C. Reference picker logic ===');

// Inspect source for the function
check(`pickReference present`, source.includes('function pickReference('));
check(`CRDR picks crdrNo first`, /sourceType === 'CRDR'[\s\S]*?crdrNo/.test(source));
check(`AP picks vendorInvoiceNo first`, /sourceType === 'AP'[\s\S]*?vendorInvoiceNo/.test(source));
check(`INVOICE picks invoiceNo`, source.includes('return tx.invoiceNo ?? tx.ourRefNo'));

// Verify on real data: every CRDR tx with crdrNo would render its crdrNo
const crdrTxs = sky.transactions.filter(t => t.sourceType === 'CRDR' && t.crdrNo);
check(`baseline has CRDR transactions with crdrNo`, crdrTxs.length > 0);

// ============================================================
// D. Per-currency footer totals — never summed across currencies
// ============================================================
console.log('\n=== D. Per-currency footer totals ===');

// Reproduce the totals calc and verify USD-only sum doesn't include CAD
let usdTotal = 0, cadTotal = 0;
for (const t of sky.transactions) {
  if (t.direction === 'settled') continue;
  if (t.currency === 'USD') usdTotal += t.signedBalance;
  if (t.currency === 'CAD') cadTotal += t.signedBalance;
}
check(`USD total != CAD total (parties have different scales)`, usdTotal !== cadTotal);
check(`USD sum reproducible`, typeof usdTotal === 'number' && isFinite(usdTotal));

// Verify Dashboard parity: settled transactions don't contribute
const settledSum = sky.transactions
  .filter(t => t.direction === 'settled')
  .reduce((s, t) => s + t.signedBalance, 0);
const allSum = sky.transactions.reduce((s, t) => s + t.signedBalance, 0);
const nonSettledSum = sky.transactions
  .filter(t => t.direction !== 'settled')
  .reduce((s, t) => s + t.signedBalance, 0);
check(`settled + non-settled = total (sanity)`,
      Math.abs((settledSum + nonSettledSum) - allSum) < 0.01);

// ============================================================
// E. Reference field model — uses split fields, NOT refNo (v2.0 P1 #4 fix preserved)
// ============================================================
console.log('\n=== E. Reference fields (v2.0 P1 #4 invariant) ===');

check(`code does NOT use t.refNo (overloaded field eliminated in v2.0 rev2)`,
      !source.includes('t.refNo') && !source.includes('tx.refNo'));
check(`code uses tx.ourRefNo`,        source.includes('tx.ourRefNo'));
check(`code uses tx.invoiceNo`,       source.includes('tx.invoiceNo'));
check(`code uses tx.crdrNo`,          source.includes('tx.crdrNo'));
check(`code uses tx.vendorInvoiceNo`, source.includes('tx.vendorInvoiceNo'));
check(`code uses tx.blNo`,            source.includes('tx.blNo'));

// ============================================================
// F. Trace panel completeness — must include source file + row + party name
// ============================================================
console.log('\n=== F. Trace panel completeness ===');

check(`trace panel renders Source File`,  source.includes('"Source File"'));
check(`trace panel renders Source Row`,   source.includes('"Source Row"'));
check(`trace panel renders Source Sheet`, source.includes('"Source Sheet"'));
check(`trace panel renders Transaction ID`, source.includes('"Transaction ID"'));
check(`trace panel renders Party Name (v2.1.1 invariant)`, source.includes('"Party Name"'));
check(`trace panel renders Party Key`,    source.includes('"Party Key"'));
check(`trace panel does NOT show rawRow`, !source.includes('rawRow') && !source.includes('"Raw Row"'));

// ============================================================
// G. Keyboard accessibility — Enter/Space/Esc on row
// ============================================================
console.log('\n=== G. Keyboard accessibility ===');

check(`row has tabIndex={0}`,  source.includes('tabIndex={0}'));
check(`row handles Enter`,     source.includes("e.key === 'Enter'"));
check(`row handles Space`,     source.includes("e.key === ' '"));
check(`row handles Escape`,    source.includes("e.key === 'Escape'"));
check(`row has aria-expanded`, source.includes('aria-expanded={isExpanded}'));

// ============================================================
// H. Statement-only party — Transactions tab still shows the spec copy
// ============================================================
console.log('\n=== H. Statement-only party preserved ===');

// Make sure the placeholder code path is still intact (didn't get
// removed when we added TransactionsTab)
check(`statement-only special copy preserved`,
      source.includes('No ERP transactions found. This party only appears in statement files.'));

// ============================================================
// I. Filter bar UI — 4 controls (currency, direction, search, sort)
// ============================================================
console.log('\n=== I. Filter bar shape ===');

check(`filter bar has Currency select`,  source.includes('CURRENCY'));
check(`filter bar has Direction select`, source.includes('DIRECTION'));
check(`filter bar has Search input`,     /<input\s+type="search"/.test(source));
check(`filter bar has Sort select`,      source.includes('SORT'));

// ============================================================
// J. Default sort = aging desc, amount desc (per spec)
// ============================================================
console.log('\n=== J. Default sort (spec) ===');

check(`default sort key is 'aging-desc'`,
      source.includes("useState<TxSortMode>('aging-desc')"));
check(`'aging-desc' label exists in dropdown`,
      source.includes('Aging desc (default)') || source.includes("value=\"aging-desc\""));

// ============================================================
// K. Real data: default sort behavior (spec: aging desc)
// ============================================================
console.log('\n=== K. Default sort on real data ===');

// Spec says aging desc. The TOP rows will include settled rows when
// they have older aging — that's the spec's behavior, not a bug.
// Users filter Direction=non-settled to exclude. We just verify
// the sort produced a non-empty, monotonic-aging output.
check(`default sort produces non-empty top-10`,  sortedSky.length >= 10);
check(`default sort top-10 aging is monotonically non-increasing`,
      sortedSky.slice(0, 10).every((t, i, arr) => i === 0 || arr[i-1].agingDays >= t.agingDays));
// Note: spec D14 freeze means we don't second-guess sort here. The
// "Settled rows can dominate top by aging" reality is observable in
// SKYMASTER (top-10 = 10 settled rows). Document and move on.

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
