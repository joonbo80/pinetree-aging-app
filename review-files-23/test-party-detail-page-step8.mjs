// tools/test-party-detail-page-step8.mjs
//
// Phase 2 v2.2 Step 8 regression — Reviews tab.
//
// Tests focus on:
//   - Component renders all 5 categories (no dedup per spec)
//   - Same tx in multiple categories produces multiple rows
//   - Category filter works
//   - Cross-tab focus from review item to its linked tx
//   - NOT_IN_ERP_EXTRACT items render WITHOUT focus jump (no transactionId)
//   - Per-currency impact totals (D5 — never sum across)
//   - Default sort: category priority then |amount| desc

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
  if (ok) { pass++; console.log(`  \u2705 ${label}`); }
  else { fail++; failures.push({ label, evidence }); console.error(`  \u274c ${label}${evidence ? ' \u2014 ' + evidence : ''}`); }
}

// ============================================================
// A. Component shape
// ============================================================
console.log('\n=== A. Component shape ===');

check(`ReviewsTab component defined`,
      source.includes('function ReviewsTab(') && source.includes('onFocusTransaction:'));
check(`ReviewsFilterBar defined`,    source.includes('function ReviewsFilterBar('));
check(`CategoryBadge defined`,       source.includes('function CategoryBadge('));
check(`ReviewTracePanel defined`,    source.includes('function ReviewTracePanel('));
check(`reviewCategoryPriority helper`, source.includes('function reviewCategoryPriority('));
check(`CATEGORY_LABELS map defined`,   source.includes('CATEGORY_LABELS') && source.includes("'Warnings'"));

// ============================================================
// B. Category priority sort (most-actionable first)
// ============================================================
console.log('\n=== B. Category priority order ===');

check(`NOT_IN_ERP_EXTRACT priority = 1 (highest)`,
      /NOT_IN_ERP_EXTRACT':\s*return 1/.test(source));
check(`AGING_90_PLUS priority = 2`,
      /AGING_90_PLUS':\s*return 2/.test(source));
check(`DUPLICATES priority = 3`,
      /DUPLICATES':\s*return 3/.test(source));
check(`WARNINGS priority = 4`,
      /WARNINGS':\s*return 4/.test(source));
check(`UNKNOWN_DEPARTMENT priority = 5`,
      /UNKNOWN_DEPARTMENT':\s*return 5/.test(source));

// ============================================================
// C. Cross-tab focus — linked tx
// ============================================================
console.log('\n=== C. Cross-tab focus ===');

check(`ReviewsTab takes onFocusTransaction prop`,
      /ReviewsTab\s*\([\s\S]{0,300}onFocusTransaction:/.test(source));
check(`matchedTx lookup via item.transactionId`,
      source.includes('item.transactionId\n                ? detail.transactions.find'));
check(`Linked Tx column has erp-match-link button when matchedTx`,
      source.includes('matchedTx ? (') && source.includes('onClick={() => onFocusTransaction(matchedTx.id)}'));
check(`Linked Tx renders em-dash for items WITHOUT transactionId`,
      source.includes(': (\n                        <span className="muted-small">\u2014</span>'));
check(`Trace panel has "View this transaction in Transactions tab" link`,
      source.includes('View this transaction in Transactions tab'));

// ============================================================
// D. No deduplication (spec — same tx can appear in multiple categories)
// ============================================================
console.log('\n=== D. No dedup ===');

// Verify on real data: win-yan-logistics has 13 reviews across 3 categories
const wyl = selectPartyDetail('win-yan-logistics', result);
check(`win-yan-logistics has 13 review items`, wyl.reviewItems.length === 13,
      `got ${wyl.reviewItems.length}`);

const wylByCategory = {};
for (const r of wyl.reviewItems) {
  wylByCategory[r.category] = (wylByCategory[r.category] ?? 0) + 1;
}
check(`win-yan-logistics has 6 WARNINGS`,         wylByCategory.WARNINGS === 6);
check(`win-yan-logistics has 6 DUPLICATES`,        wylByCategory.DUPLICATES === 6);
check(`win-yan-logistics has 1 NOT_IN_ERP_EXTRACT`, wylByCategory.NOT_IN_ERP_EXTRACT === 1);

// Find a tx that appears in multiple review categories within this party
const txCategoryMap = {};
for (const r of wyl.reviewItems) {
  if (!r.transactionId) continue;
  txCategoryMap[r.transactionId] = txCategoryMap[r.transactionId] ?? new Set();
  txCategoryMap[r.transactionId].add(r.category);
}
const multiCatTx = Object.entries(txCategoryMap).filter(([, cats]) => cats.size > 1);
check(`win-yan-logistics has at least 1 tx in 2+ categories (no-dedup verifiable)`,
      multiCatTx.length > 0,
      `${multiCatTx.length} multi-category txs found`);

// Source-level: filter logic does NOT dedupe
check(`filter logic does not dedup by transactionId`,
      !/Set\(\s*detail\.reviewItems\.map\([^)]*transactionId/.test(source));

// ============================================================
// E. Category filter
// ============================================================
console.log('\n=== E. Category filter ===');

check(`ReviewCategoryFilter type has all 5 categories + ALL`,
      source.includes("'WARNINGS'") &&
      source.includes("'AGING_90_PLUS'") &&
      source.includes("'DUPLICATES'") &&
      source.includes("'NOT_IN_ERP_EXTRACT'") &&
      source.includes("'UNKNOWN_DEPARTMENT'") &&
      source.includes("'ALL'"));
check(`filter dropdown shows count next to each category`,
      source.includes('All ({totalCount})') && source.includes('counts[k]'));
check(`empty categories hidden from dropdown`,
      source.includes('counts[k] > 0 ? ('));

// ============================================================
// F. NOT_IN_ERP_EXTRACT review items have NO transactionId (statement-only)
// ============================================================
console.log('\n=== F. NOT_IN_ERP_EXTRACT no transactionId (data fact) ===');

const allReviews = result.details.reviewItems;
const strictNotInErp = allReviews.filter(r => r.category === 'NOT_IN_ERP_EXTRACT');
const strictWithTxId = strictNotInErp.filter(r => r.transactionId);
check(`baseline: 7 strict NOT_IN_ERP review items`, strictNotInErp.length === 7);
check(`all 7 strict NOT_IN_ERP items have null transactionId`,
      strictWithTxId.length === 0,
      `${strictWithTxId.length} have transactionId`);

// ============================================================
// G. Per-currency impact totals (D5 — never sum across)
// ============================================================
console.log('\n=== G. Per-currency impact totals ===');

check(`impact uses separate USD/CAD entries`,
      source.includes('const t = { USD: 0, CAD: 0 }'));
check(`impact iterates rows and bins by currency`,
      source.includes('t[r.currency] += r.amount'));

// ============================================================
// H. Search filter
// ============================================================
console.log('\n=== H. Search filter ===');

check(`search matches reason field`,    source.includes("(item.reason ?? '').toLowerCase().includes(q)"));
check(`search matches reasonCode field`, source.includes("(item.reasonCode ?? '').toLowerCase().includes(q)"));

// ============================================================
// I. Trace panel completeness
// ============================================================
console.log('\n=== I. Trace panel ===');

check(`trace shows source file when present`,    source.includes('item.trace.sourceFile'));
check(`trace shows source row`,
      source.includes('item.trace.sourceRow') &&
      (source.includes('String(item.trace.sourceRow)') || source.includes('row: item.trace.sourceRow')));
check(`trace shows party name (v2.1.1 invariant)`, source.includes('"Party Name"') || source.includes("'Party Name'"));
check(`trace shows reason code separately from human reason`,
      source.includes('"Reason Code"') || source.includes("'Reason Code'") && source.includes('item.reasonCode'));
check(`trace shows severity`,                    source.includes('"Severity"') || source.includes("'Severity'"));
check(`trace shows linked transaction section when present`,
      source.includes('LINKED TRANSACTION'));
check(`trace does NOT show rawRow`,
      !source.includes('rawRow') && !source.includes('Raw Row'));
check(`extraDetails filters non-primitive details`,
      source.includes("typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'"));

// ============================================================
// J. Empty states
// ============================================================
console.log('\n=== J. Empty states ===');

check(`empty party message: "No review items for this party"`,
      source.includes('No review items for this party'));
check(`filter-empty message: "No review items match the current filter"`,
      source.includes('No review items match the current filter'));

// ============================================================
// K. Real-data: priority sort places NOT_IN_ERP first
// ============================================================
console.log('\n=== K. Priority sort top-row composition ===');

function priority(cat) {
  if (cat === 'NOT_IN_ERP_EXTRACT') return 1;
  if (cat === 'AGING_90_PLUS') return 2;
  if (cat === 'DUPLICATES') return 3;
  if (cat === 'WARNINGS') return 4;
  if (cat === 'UNKNOWN_DEPARTMENT') return 5;
  return 6;
}

const wylSorted = [...wyl.reviewItems].sort((a, b) => {
  const pa = priority(a.category);
  const pb = priority(b.category);
  if (pa !== pb) return pa - pb;
  return Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0);
});
check(`win-yan-logistics: first sorted is NOT_IN_ERP (priority 1)`,
      wylSorted[0].category === 'NOT_IN_ERP_EXTRACT',
      `got ${wylSorted[0].category}`);

// ============================================================
// L. Global: sum of per-party review counts == 234 global
// ============================================================
console.log('\n=== L. Global reconciliation ===');

const allKeys = new Set();
for (const r of allReviews) {
  if (r.partyKey) allKeys.add(r.partyKey);
}
let totalReviews = 0;
for (const k of allKeys) {
  const d = selectPartyDetail(k, result);
  totalReviews += d.reviewItems.length;
}
check(`Σ per-party reviewItems = 234 global`,
      totalReviews === 234, `got ${totalReviews}`);

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
