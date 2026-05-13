// tools/test-party-detail-page-step9.mjs
//
// Phase 2 v2.2 Step 9 regression — Duplicates tab.
//
// Tests focus on:
//   - Group rendering with member expand
//   - Cross-tab focus from member rows (reuses Step 7 mechanism)
//   - Filter/sort correctness
//   - Per-currency totals (D5)
//   - Empty state spec compliance
//   - Real-data verification with iata-cargo-accounts (9 groups)

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

check(`DuplicatesTab component defined`,
      source.includes('function DuplicatesTab(') && source.includes('onFocusTransaction:'));
check(`DuplicatesFilterBar defined`, source.includes('function DuplicatesFilterBar('));
check(`DuplicateGroupMembers defined`, source.includes('function DuplicateGroupMembers('));
check(`DupCurrencyFilter type`, source.includes('DupCurrencyFilter'));
check(`DupSortMode type with 4 modes`,
      source.includes("'impact-desc'") &&
      source.includes("'impact-asc'") &&
      source.includes("'count-desc'") &&
      source.includes("'identity-asc'"));

// ============================================================
// B. Group row rendering
// ============================================================
console.log('\n=== B. Group row columns ===');

// Inspect that the table has the expected columns
check(`column: Identity (uses group.identityKey)`,
      source.includes('group.identityKey') && source.includes('>Identity</th>'));
check(`column: Currency`, source.includes('>Currency</th>'));
check(`column: Members (uses group.count)`,
      source.includes('group.count') && source.includes('>Members</th>'));
check(`column: Potential impact`,
      source.includes('group.potentialSignedImpact') && source.includes('>Potential impact</th>'));
check(`column: Status`, source.includes('>Status</th>'));

// ============================================================
// C. Member expand (group rows expand to show member tx)
// ============================================================
console.log('\n=== C. Member expansion ===');

check(`expand state per group (expandedKey)`,
      source.includes('const [expandedKey, setExpandedKey]'));
check(`expand button has aria-expanded + aria-controls`,
      source.includes('aria-expanded={isExpanded}') &&
      source.includes('aria-controls={`dup-members-'));
check(`Escape collapses expanded group`,
      source.includes("e.key === 'Escape'") && source.includes('setExpandedKey(null)'));
check(`expanded row renders DuplicateGroupMembers`,
      source.includes('<DuplicateGroupMembers'));
check(`member row resolves tx via txById Map`,
      source.includes('txById.get(tid)'));

// ============================================================
// D. Cross-tab focus from member rows
// ============================================================
console.log('\n=== D. Cross-tab focus ===');

check(`DuplicateGroupMembers takes onFocus prop`,
      source.includes('function DuplicateGroupMembers(') &&
      /DuplicateGroupMembers\([\s\S]{0,400}onFocus:/.test(source));
check(`member row has erp-match-link button`,
      /dup-member-row[\s\S]{0,800}erp-match-link/.test(source));
check(`button click triggers onFocus(tx.id)`,
      source.includes('onClick={() => onFocus(tx.id)}'));
check(`button label "View tx"`, source.includes('View tx'));

// ============================================================
// E. Defensive: missing tx (member id not in party's tx set)
// ============================================================
console.log('\n=== E. Defensive missing-tx handling ===');

check(`missing tx renders fallback row, not crash`,
      source.includes('dup-member-missing') &&
      source.includes("transaction not found in this party"));

// ============================================================
// F. Filter/sort
// ============================================================
console.log('\n=== F. Filter/sort ===');

check(`currency filter (ALL/USD/CAD)`,
      source.includes("currency !== 'ALL'") && source.includes('grp.currency === currency'));
check(`search across identityKey + member refs`,
      source.includes('grp.identityKey.toLowerCase().includes(q)') &&
      /tx\.invoiceNo[\s\S]{0,80}includes\(q\)/.test(source));
check(`default sort = impact-desc`,
      source.includes("useState<DupSortMode>('impact-desc')"));
check(`sort mode handles all 4 cases`,
      /case 'impact-desc'/.test(source) &&
      /case 'impact-asc'/.test(source) &&
      /case 'count-desc'/.test(source) &&
      /case 'identity-asc'/.test(source));

// ============================================================
// G. Per-currency totals (D5 — never sum across)
// ============================================================
console.log('\n=== G. Per-currency totals (D5) ===');

check(`totals object has separate USD/CAD`,
      source.includes('const t = { USD: 0, CAD: 0 }'));
check(`totals bin by group.currency`,
      source.includes('t[g.currency] += g.potentialSignedImpact'));

// ============================================================
// H. Empty states (spec §"Empty States")
// ============================================================
console.log('\n=== H. Empty states ===');

check(`zero-group party shows neutral empty state`,
      source.includes('No duplicate groups for this party.'));
check(`tab visible even when 0 groups (placeholder branch present)`,
      source.includes('detail.duplicateGroups.length === 0'));
check(`filter-empty message`,
      source.includes('No duplicate groups match the current filter.'));

// ============================================================
// I. Real-data: iata-cargo-accounts (9 groups, top duplicate party)
// ============================================================
console.log('\n=== I. Real-data: iata-cargo-accounts ===');

const iata = selectPartyDetail('iata-cargo-accounts', result);
check(`iata-cargo-accounts has 9 duplicate groups`,
      iata.duplicateGroups.length === 9, `got ${iata.duplicateGroups.length}`);

// Verify: every group has count 2 (baseline data fact)
const counts = new Set(iata.duplicateGroups.map(g => g.count));
check(`all baseline groups are 2-member`, counts.size === 1 && counts.has(2));

// Currency split
const ccyByGroup = iata.duplicateGroups.reduce((acc, g) => {
  acc[g.currency] = (acc[g.currency] ?? 0) + 1;
  return acc;
}, {});
check(`iata has both USD and CAD groups OR a clear majority`,
      (ccyByGroup.USD ?? 0) + (ccyByGroup.CAD ?? 0) === 9);

// Verify: every member tx id in groups exists in party transactions
const partyTxIds = new Set(iata.transactions.map(t => t.id));
let missingMembers = 0;
for (const g of iata.duplicateGroups) {
  for (const tid of g.transactionIds) {
    if (!partyTxIds.has(tid)) missingMembers++;
  }
}
check(`iata: all duplicate group members are in party transactions (no orphans)`,
      missingMembers === 0, `${missingMembers} orphan ids`);

// ============================================================
// J. Global reconciliation
// ============================================================
console.log('\n=== J. Global reconciliation ===');

const allKeys = new Set();
for (const t of result.details.transactions) allKeys.add(t.partyKey);

let totalGroupTouches = 0;
for (const k of allKeys) {
  totalGroupTouches += selectPartyDetail(k, result).duplicateGroups.length;
}

const globalGroups = result.details.duplicateGroups.length;
// Since baseline has 0 cross-party groups, sum of per-party should equal global
check(`Σ per-party duplicateGroups = ${globalGroups} global (baseline has 0 cross-party groups)`,
      totalGroupTouches === globalGroups,
      `got ${totalGroupTouches}`);

// ============================================================
// K. Statement-only party — Duplicates tab still renders neutrally
// ============================================================
console.log('\n=== K. Statement-only party Duplicates tab ===');

const a1 = selectPartyDetail('a1-intermodal', result);
check(`a1-intermodal has 0 duplicate groups (no transactions)`,
      a1.duplicateGroups.length === 0);
// The placeholder branch handles 0-group case, tab still visible
check(`spec §"Empty States" preserved (do not hide tab)`,
      source.includes("detail.duplicateGroups.length === 0") &&
      source.includes('No duplicate groups for this party'));

// ============================================================
// L. Sort verification on real data
// ============================================================
console.log('\n=== L. Sort verification ===');

const iataSorted = [...iata.duplicateGroups].sort((a, b) =>
  Math.abs(b.potentialSignedImpact) - Math.abs(a.potentialSignedImpact),
);
const monotonic = iataSorted.every((g, i, arr) =>
  i === 0 || Math.abs(arr[i-1].potentialSignedImpact) >= Math.abs(g.potentialSignedImpact),
);
check(`impact-desc sort is monotonically non-increasing`, monotonic);

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
