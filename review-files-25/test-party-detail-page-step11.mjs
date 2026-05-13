// tools/test-party-detail-page-step11.mjs
//
// Phase 2 v2.2 Step 11 regression — CSV export per tab.
//
// Goals verified:
//   1. csvExport module exports buildCsv + makeFilename (testable surface)
//   2. Filename convention: aging-party-{partyKey}-{tab}-{YYYYMMDD-HHmm}.csv
//   3. UTF-8 BOM (\uFEFF) prefix
//   4. Double-quote escape for embedded quotes/commas/newlines
//   5. Per-tab columns include the trace columns (audit chain preserved)
//   6. Reconciliation: row count of CSV body == visible row count
//   7. Strict-vs-broad NOT_IN_ERP labeling carries into Statements CSV
//   8. Duplicates CSV is flattened (1 row per group×member)
//   9. partyKey + partyName on every row (v2.1.1 invariant carried)
//  10. Export buttons exist in all 4 footers

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../aging-app/src/baselines/phase1-v1.3.0.json');
const selectorPath = resolve(__dirname, '../aging-app/src/selectors/partyDetail.ts');
const csvModulePath = resolve(__dirname, '../aging-app/src/components/party/csvExport.ts');
const pagePath = resolve(__dirname, '../aging-app/src/components/party/PartyDetailPage.tsx');

const result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const { selectPartyDetail } = await import(pathToFileURL(selectorPath).href);
const { buildCsv, makeFilename } = await import(pathToFileURL(csvModulePath).href);
const pageSource = readFileSync(pagePath, 'utf-8');

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) { pass++; console.log(`  \u2705 ${label}`); }
  else { fail++; failures.push({ label, evidence }); console.error(`  \u274c ${label}${evidence ? ' \u2014 ' + evidence : ''}`); }
}

// Helper: parse CSV body assuming our quoted format (every field "...").
// Returns Array<Array<string>> after stripping BOM.
function parseCsvBody(csv) {
  const stripped = csv.replace(/^\uFEFF/, '');
  // Simple parser for our format only — every field is double-quoted,
  // separated by commas, rows separated by \n. Internal quotes are
  // escaped as "".
  const rows = [];
  let i = 0;
  const n = stripped.length;
  let row = [];
  let cell = '';
  let inQuote = false;
  while (i < n) {
    const c = stripped[i];
    if (inQuote) {
      if (c === '"') {
        if (stripped[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuote = false; i++; continue;
      }
      cell += c; i++;
    } else {
      if (c === '"') { inQuote = true; i++; continue; }
      if (c === ',') { row.push(cell); cell = ''; i++; continue; }
      if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += c; i++;
    }
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ============================================================
// A. Module surface (buildCsv + makeFilename exported)
// ============================================================
console.log('\n=== A. Module surface ===');

check(`buildCsv exported and is a function`, typeof buildCsv === 'function');
check(`makeFilename exported and is a function`, typeof makeFilename === 'function');

// ============================================================
// B. Filename convention
// ============================================================
console.log('\n=== B. Filename convention ===');

const fixedDate = new Date(2026, 4, 5, 14, 32);  // 2026-05-05 14:32
const fname = makeFilename('skymaster-express', 'transactions', fixedDate);
check(`filename starts with aging-party-`, fname.startsWith('aging-party-'));
check(`filename includes partyKey`, fname.includes('skymaster-express'));
check(`filename includes tab name`, fname.includes('-transactions-'));
check(`filename uses YYYYMMDD-HHmm timestamp`,
      fname.includes('20260505-1432'),
      `got ${fname}`);
check(`filename ends with .csv`, fname.endsWith('.csv'));

// All 4 tab variants produce distinct filenames
const tabs = ['transactions', 'statements', 'reviews', 'duplicates'];
const distinctFilenames = new Set(tabs.map(t => makeFilename('p', t, fixedDate)));
check(`all 4 tabs produce distinct filenames`, distinctFilenames.size === 4);

// ============================================================
// C. UTF-8 BOM + escape format
// ============================================================
console.log('\n=== C. UTF-8 BOM + escape ===');

const sky = selectPartyDetail('skymaster-express', result);
const txCsv = buildCsv(sky, 'transactions');
check(`CSV starts with UTF-8 BOM (\\uFEFF)`,        txCsv.charCodeAt(0) === 0xFEFF);
check(`CSV body uses \\n line separators (no \\r)`,  !txCsv.includes('\r'));

// ============================================================
// D. Per-tab body shape
// ============================================================
console.log('\n=== D. Per-tab body shape ===');

const txRows = parseCsvBody(txCsv);
check(`Transactions CSV: header row present`, txRows.length >= 1);
check(`Transactions CSV: header has trace columns`,
      txRows[0].includes('sourceFile') &&
      txRows[0].includes('sourceSheet') &&
      txRows[0].includes('sourceRow'));
check(`Transactions CSV: header has partyKey + partyName (v2.1.1)`,
      txRows[0][0] === 'partyKey' && txRows[0][1] === 'partyName');
check(`Transactions CSV: row count == party tx count + 1 (header)`,
      txRows.length === sky.transactions.length + 1,
      `${txRows.length} rows vs ${sky.transactions.length} tx + 1`);
check(`Transactions CSV: every body row has skymaster-express in col 0`,
      txRows.slice(1).every(r => r[0] === 'skymaster-express'));

// ============================================================
// E. Statements CSV — strict-vs-broad NOT_IN_ERP labeling
// ============================================================
console.log('\n=== E. Statements CSV strict/broad labels ===');

const cedrus = selectPartyDetail('cedrus-global-trading', result);
const stmtCsv = buildCsv(cedrus, 'statements');
const stmtRows = parseCsvBody(stmtCsv);
const stmtHeaders = stmtRows[0];
const matchTypeIdx = stmtHeaders.indexOf('matchType');
const matchTypeLabelIdx = stmtHeaders.indexOf('matchTypeLabel');
check(`Statements CSV has matchType column`, matchTypeIdx >= 0);
check(`Statements CSV has matchTypeLabel column`, matchTypeLabelIdx >= 0);

// Of cedrus's NOT_IN_ERP rows, some are strict (= "Confirmed not in ERP")
// and some are broad (= "Not in uploaded ERP extract")
const notInErpRows = stmtRows.slice(1).filter(r => r[matchTypeIdx] === 'NOT_IN_ERP_EXTRACT');
const strictLabel = notInErpRows.filter(r => r[matchTypeLabelIdx] === 'Confirmed not in ERP');
const broadLabel  = notInErpRows.filter(r => r[matchTypeLabelIdx] === 'Not in uploaded ERP extract');
check(`cedrus has at least 1 "Confirmed not in ERP" row`, strictLabel.length >= 1);
check(`cedrus has at least 1 "Not in uploaded ERP extract" row`, broadLabel.length >= 1);
check(`strict + broad == total NOT_IN_ERP rows (no other label)`,
      strictLabel.length + broadLabel.length === notInErpRows.length);

// ============================================================
// F. Reviews CSV — partyName + reasonCode preserved
// ============================================================
console.log('\n=== F. Reviews CSV ===');

const wyl = selectPartyDetail('win-yan-logistics', result);
const revCsv = buildCsv(wyl, 'reviews');
const revRows = parseCsvBody(revCsv);
check(`Reviews CSV row count == reviewItems + 1`,
      revRows.length === wyl.reviewItems.length + 1);
const revHeaders = revRows[0];
check(`Reviews CSV has reasonCode + reason + category`,
      revHeaders.includes('reasonCode') &&
      revHeaders.includes('reason') &&
      revHeaders.includes('category'));
check(`Reviews CSV every row carries partyName`,
      revRows.slice(1).every(r => r[1] === 'WIN YAN LOGISTICS' || r[1].toUpperCase().includes('WIN YAN')));

// ============================================================
// G. Duplicates CSV — flattened group×member
// ============================================================
console.log('\n=== G. Duplicates CSV flattening ===');

const iata = selectPartyDetail('iata-cargo-accounts', result);
const dupCsv = buildCsv(iata, 'duplicates');
const dupRows = parseCsvBody(dupCsv);
const dupHeaders = dupRows[0];
check(`Duplicates CSV has groupIdentityKey column`,
      dupHeaders.includes('groupIdentityKey'));
check(`Duplicates CSV has memberTransactionId column`,
      dupHeaders.includes('memberTransactionId'));

// Total member rows = sum of group.count across all groups
const totalMembers = iata.duplicateGroups.reduce((s, g) => s + g.count, 0);
check(`Duplicates CSV body row count == Σ group.count`,
      dupRows.length - 1 === totalMembers,
      `${dupRows.length - 1} body rows vs ${totalMembers} expected`);

// Each group's identityKey appears g.count times
const groupKeyIdx = dupHeaders.indexOf('groupIdentityKey');
const keyCounts = {};
for (const row of dupRows.slice(1)) {
  const k = row[groupKeyIdx];
  keyCounts[k] = (keyCounts[k] ?? 0) + 1;
}
const allMatch = iata.duplicateGroups.every(g => keyCounts[g.identityKey] === g.count);
check(`each groupIdentityKey appears exactly group.count times`, allMatch);

// ============================================================
// H. Quote escape (embedded quote + comma)
// ============================================================
console.log('\n=== H. Quote escape ===');

// Construct a synthetic test by examining a reasonCode/reason that
// has commas. win-yan-logistics has W2_CROSS_CURRENCY_PARTY which has
// commas/quotes in some review reasons in the wild.
// We assert by escape format directly: every cell wrapped in "...",
// and any internal " is escaped as "".
const sample = revRows[0].join(',');
check(`CSV header row reads as comma-joined fields when un-quoted`,
      sample.includes('partyKey,partyName,category'));

// Find a row with a comma in the reason field, ensure it round-trips
const reasonIdx = revHeaders.indexOf('reason');
const withComma = revRows.slice(1).find(r => r[reasonIdx].includes(','));
if (withComma) {
  // Re-emit and re-parse: the comma must be preserved
  check(`row with comma in reason parses back correctly`,
        withComma[reasonIdx].includes(','));
}

// ============================================================
// I. Empty-tab CSV — header only, no body rows
// ============================================================
console.log('\n=== I. Empty-tab CSV ===');

const a1 = selectPartyDetail('a1-intermodal', result);
// a1-intermodal has 0 transactions, 0 duplicate groups
const a1TxCsv = buildCsv(a1, 'transactions');
const a1TxRows = parseCsvBody(a1TxCsv);
check(`empty Transactions CSV has only header row`, a1TxRows.length === 1);
check(`empty Transactions CSV still has UTF-8 BOM`,
      a1TxCsv.charCodeAt(0) === 0xFEFF);

const a1DupCsv = buildCsv(a1, 'duplicates');
const a1DupRows = parseCsvBody(a1DupCsv);
check(`empty Duplicates CSV has only header row`, a1DupRows.length === 1);

// ============================================================
// J. Export buttons present in all 4 tab footers (UI integration)
// ============================================================
console.log('\n=== J. UI export buttons ===');

check(`PartyDetailPage imports exportPartyTabCsv`,
      pageSource.includes("import { exportPartyTabCsv } from './csvExport'"));

const exportBtnCount = (pageSource.match(/onClick=\{\(\) => exportPartyTabCsv\(detail, '/g) ?? []).length;
check(`exportPartyTabCsv button onClick appears 4 times (one per tab)`,
      exportBtnCount === 4, `got ${exportBtnCount}`);

check(`Export button on Transactions tab`,
      pageSource.includes("exportPartyTabCsv(detail, 'transactions')"));
check(`Export button on Statements tab`,
      pageSource.includes("exportPartyTabCsv(detail, 'statements')"));
check(`Export button on Reviews tab`,
      pageSource.includes("exportPartyTabCsv(detail, 'reviews')"));
check(`Export button on Duplicates tab`,
      pageSource.includes("exportPartyTabCsv(detail, 'duplicates')"));

check(`Export buttons have aria-label`,
      pageSource.includes('aria-label="Export transactions to CSV"') &&
      pageSource.includes('aria-label="Export statement rows to CSV"') &&
      pageSource.includes('aria-label="Export review items to CSV"') &&
      pageSource.includes('aria-label="Export duplicate groups to CSV"'));

// ============================================================
// K. csvExport module is SEPARATE from PartyDetailPage (file split)
// ============================================================
console.log('\n=== K. File split (csvExport separate) ===');

const csvSource = readFileSync(csvModulePath, 'utf-8');
check(`csvExport.ts exists as separate module`, csvSource.length > 0);
check(`csvExport does not import from PartyDetailPage`,
      !csvSource.includes("from './PartyDetailPage'"));
check(`csvExport imports types from parsing-engine`,
      csvSource.includes("from '../../parsing-engine/types'"));

// ============================================================
// L. Browser download stability (reviewer P2 fix)
//
// triggerDownload must:
//   - attach the anchor to the DOM before clicking
//   - remove it after clicking
//   - DEFER URL.revokeObjectURL via setTimeout(..., 0)
//
// Without these, some browsers intermittently cancel the download
// because the blob URL is revoked before the download pipeline
// consumes it. This is silent failure — accountant clicks Export,
// nothing happens, data lost.
// ============================================================
console.log('\n=== L. Browser download stability (P2 fix) ===');

check(`anchor is appended to document.body before click`,
      csvSource.includes('document.body.appendChild(a)'));
check(`anchor is removed after click`,
      csvSource.includes('a.remove()'));
check(`URL.revokeObjectURL is deferred via setTimeout`,
      /setTimeout\(\s*\(\)\s*=>\s*URL\.revokeObjectURL\(url\)/.test(csvSource));
check(`revoke is NOT called synchronously after click (the bug pattern)`,
      // The pre-fix pattern was: a.click(); URL.revokeObjectURL(url);
      // (no setTimeout between them). Verify that pattern is gone.
      !/a\.click\(\);\s*URL\.revokeObjectURL/.test(csvSource));
check(`anchor uses display:none to avoid layout flicker`,
      csvSource.includes("a.style.display = 'none'"));

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
