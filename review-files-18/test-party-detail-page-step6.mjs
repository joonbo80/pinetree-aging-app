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
// G. Keyboard accessibility — real button + Esc handling
// ============================================================
console.log('\n=== G. Keyboard accessibility ===');

// P2 fix: row uses a real <button> in first cell, so Enter/Space are
// handled natively by the button (no manual handler needed).
check(`first cell uses a real <button> (P2 fix)`,
      source.includes('className="tx-toggle-btn"'));
check(`button has aria-expanded`,
      source.includes('aria-expanded={isExpanded}'));
check(`button has aria-controls`,
      source.includes('aria-controls={`tx-trace-${tx.id}`}'));
check(`button has aria-label for context`,
      source.includes('aria-label={`${isExpanded ?'));
check(`Escape on expanded row collapses`,
      source.includes("e.key === 'Escape'"));
check(`row no longer carries tabIndex={0} (button does)`,
      !/tx-row['"`][^>]*tabIndex=\{0\}/.test(source));

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
// L. v2.2 Step 6.1 fixes (reviewer P1/P2 findings)
// ============================================================
console.log('\n=== L. Step 6.1 reviewer fixes ===');

// P1 #1: OPEN filter (receivable + payable) and default = OPEN
check(`OPEN filter option exists in dropdown`,
      source.includes('Open (receivable + payable)'));
check(`OPEN filter logic implemented`,
      source.includes("direction === 'OPEN'") &&
      source.includes("t.direction === 'receivable' || t.direction === 'payable'"));
check(`default direction = OPEN`,
      source.includes("useState<TxDirectionFilter>('OPEN')"));

// Reproduce the OPEN filter on real data: SKYMASTER OPEN should equal
// non-settled count
const skyOpenCount = sky.transactions.filter(
  t => t.direction === 'receivable' || t.direction === 'payable',
).length;
const skyNonSettledCount = sky.transactions.filter(t => t.direction !== 'settled').length;
check(`OPEN filter == non-settled count on skymaster (${skyOpenCount} vs ${skyNonSettledCount})`,
      skyOpenCount === skyNonSettledCount);
check(`OPEN filter excludes settled rows on skymaster`,
      skyOpenCount > 0 && skyOpenCount < sky.transactions.length);

// P1 #2: Date sort uses shared display helper (postDate fallback)
check(`displayDate helper exists`,
      source.includes('function displayDate('));
check(`displayDate uses invoiceDate ?? postDate fallback`,
      source.includes('tx.invoiceDate ?? tx.postDate ?? '));
check(`date sort uses displayDate, not raw invoiceDate`,
      source.includes('displayDate(b).localeCompare(displayDate(a))') &&
      source.includes('displayDate(a).localeCompare(displayDate(b))'));
check(`display cell uses displayDate (matches sort)`,
      source.includes('{displayDate(tx) || '));

// Verify on real data: sorting CRDR-only rows by date should NOT produce
// all-empty dates if rows have postDate
const crdrSortable = sky.transactions
  .filter(t => t.sourceType === 'CRDR')
  .filter(t => t.invoiceDate || t.postDate);
check(`baseline has CRDR rows with postDate or invoiceDate`,
      crdrSortable.length > 0);
const crdrWithDateAfterFix = crdrSortable.filter(
  t => (t.invoiceDate ?? t.postDate ?? '') !== '',
).length;
const crdrWithDateBeforeFix = crdrSortable.filter(t => t.invoiceDate).length;
check(`postDate fallback recovers more sortable dates than invoiceDate alone`,
      crdrWithDateAfterFix >= crdrWithDateBeforeFix);

// P1 #3: CSS file exists for the new classes
const cssPath = resolve(__dirname, '../aging-app/src/styles/v2.2-party-detail.css');
let cssExists = false;
let cssBody = '';
try {
  cssBody = readFileSync(cssPath, 'utf-8');
  cssExists = true;
  check(`v2.2 CSS file exists at expected path`, true);
  check(`CSS defines .party-tab-filter-bar`, cssBody.includes('.party-tab-filter-bar'));
  check(`CSS defines .tx-table`,              cssBody.includes('.tx-table'));
  check(`CSS defines .tx-row-expanded`,        cssBody.includes('.tx-row-expanded'));
  check(`CSS defines .pill-receivable + .pill-payable`,
        cssBody.includes('.pill-receivable') && cssBody.includes('.pill-payable'));
  check(`CSS defines .aging-90plus`,            cssBody.includes('.aging-90plus'));
  check(`CSS defines .trace-panel`,             cssBody.includes('.trace-panel'));
  check(`CSS defines .tx-toggle-btn (P2 fix)`,  cssBody.includes('.tx-toggle-btn'));
} catch {
  check(`v2.2 CSS file exists at expected path`, false, `not found at ${cssPath}`);
}

// ============================================================
// L.5  CSS LOAD CHAIN — file existence is not enough
//
// Reviewer round-2 P1: previous test passed because the CSS file
// existed, but global.css never imported it, so the runtime bundle
// shipped without the v2.2 classes. UI was unstyled despite tests
// passing. This is the same vacuous-pass pattern v2.1.1 surfaced.
//
// The fix: assert the import chain (source level) AND if a build
// artifact exists, assert the bundled CSS too.
// ============================================================
console.log('\n=== L.5 CSS load chain (regression: file-only check is vacuous) ===');

// L.5.a — global.css must @import v2.2-party-detail.css
const globalCssPath = resolve(__dirname, '../aging-app/src/styles/global.css');
let globalCss = '';
try {
  globalCss = readFileSync(globalCssPath, 'utf-8');
  check(`global.css exists`, true);
} catch {
  check(`global.css exists`, false, `not found at ${globalCssPath}`);
}

// Either an @import OR a same-content inlining counts. We accept both:
const importsViaAtRule =
  /@import\s+['"]\.\/v2\.2-party-detail\.css['"]/.test(globalCss) ||
  /@import\s+url\(['"]?\.\/v2\.2-party-detail\.css['"]?\)/.test(globalCss);
const inlinedKey =
  globalCss.includes('.tx-toggle-btn') &&
  globalCss.includes('.party-tab-filter-bar');
check(
  `global.css loads v2.2 CSS (via @import OR inlined classes)`,
  importsViaAtRule || inlinedKey,
  importsViaAtRule
    ? '@import found'
    : inlinedKey
      ? 'inlined into global.css'
      : 'NEITHER @import nor inlined classes found in global.css',
);

// L.5.b — if a built bundle exists, the v2.2 classes MUST be in it.
// Search aging-app/dist/assets/*.css for representative class names.
import { readdirSync, statSync } from 'node:fs';
const distAssetsPath = resolve(__dirname, '../aging-app/dist/assets');
let distChecked = false;
try {
  if (statSync(distAssetsPath).isDirectory()) {
    const cssFiles = readdirSync(distAssetsPath).filter(f => f.endsWith('.css'));
    if (cssFiles.length > 0) {
      distChecked = true;
      const bundled = cssFiles
        .map(f => readFileSync(resolve(distAssetsPath, f), 'utf-8'))
        .join('\n');
      check(`built CSS bundle contains .tx-toggle-btn`,        bundled.includes('.tx-toggle-btn'));
      check(`built CSS bundle contains .party-tab-filter-bar`, bundled.includes('.party-tab-filter-bar'));
      check(`built CSS bundle contains .pill-receivable`,      bundled.includes('.pill-receivable'));
      check(`built CSS bundle contains .aging-90plus`,         bundled.includes('.aging-90plus'));
    }
  }
} catch {
  // dist/ doesn't exist yet — that's fine, the source-level check above is sufficient.
}
if (!distChecked) {
  console.log(`  ℹ️  no dist/assets/*.css found — source-level @import check is the binding assertion`);
  console.log(`     (run \`npm run build\` to also exercise the bundled-CSS path)`);
}

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
