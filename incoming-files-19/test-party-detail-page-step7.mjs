// tools/test-party-detail-page-step7.mjs
//
// Phase 2 v2.2 Step 7 regression — Statements tab behavior.
//
// Tests focus on the reviewer P1/P2 corrections to micro-spec:
//   P1 #1 — Confirmed not in ERP vs Not in uploaded ERP extract labels
//   P1 #2 — Match filter set: Exact / Matched with difference / Unmatched / Settled after
//   P1 #3 — Cross-tab focus tolerates OPEN filter (focused row visible)
//   P2    — Priority: strict NOT_IN_ERP first, broad NOT_IN_ERP after BAL_DIFF/CHANGED
//   S6    — Trace panel uses "Statement status fields" not "RAW"

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
// A. StatementsTab component exists
// ============================================================
console.log('\n=== A. Component shape ===');

check(`StatementsTab component defined`,
      source.includes('function StatementsTab(') && source.includes('StatementsTabProps'));
check(`StatementTracePanel defined`,           source.includes('function StatementTracePanel('));
check(`MatchTypeBadge defined`,                source.includes('function MatchTypeBadge('));
check(`SourcePill defined (LOCAL/AGENT pill)`, source.includes('function SourcePill('));
check(`ErpMatchCell defined`,                  source.includes('function ErpMatchCell('));
check(`StatementsFilterBar defined`,           source.includes('function StatementsFilterBar('));
check(`matchTypePriority helper defined`,      source.includes('function matchTypePriority('));
check(`pickStatementReference helper defined`, source.includes('function pickStatementReference('));

// ============================================================
// B. Reviewer P1 #1 — Strict vs broad NOT_IN_ERP labels
// ============================================================
console.log('\n=== B. P1 #1: NOT_IN_ERP label distinction ===');

check(`source contains "Confirmed not in ERP"`,
      source.includes('Confirmed not in ERP'));
check(`source contains "Not in uploaded ERP extract"`,
      source.includes('Not in uploaded ERP extract'));
check(`MatchTypeBadge takes "strict" boolean`,
      source.includes('strict: boolean') && source.includes('matchType === \'NOT_IN_ERP_EXTRACT\' && strict'));
check(`strictNotInErpKeys built from review items`,
      source.includes('strictNotInErpKeys') &&
      source.includes("r.category !== 'NOT_IN_ERP_EXTRACT'"));

// Verify on real data: strict 7 review-items map to specific statement links
const allReviews = result.details.reviewItems;
const strictReviewItems = allReviews.filter(r => r.category === 'NOT_IN_ERP_EXTRACT');
check(`baseline has exactly 7 strict NOT_IN_ERP review items`,
      strictReviewItems.length === 7);

// Build the strict key set the way the component does
const strictKeys = new Set(
  strictReviewItems
    .filter(r => r.trace)
    .map(r => `${r.trace.sourceFile}|${r.trace.sourceRow}`),
);
check(`strict key set has 7 entries`, strictKeys.size === 7);

// Across all statement links: 95 broad, 7 of those are strict
const allLinks = result.details.statementLinks;
const broadCount = allLinks.filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT').length;
const strictMatchCount = allLinks
  .filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT')
  .filter(l => strictKeys.has(`${l.sourceFile}|${l.sourceRow}`)).length;
check(`baseline broad NOT_IN_ERP links = 95`, broadCount === 95, `got ${broadCount}`);
check(`of those, strict ones = 7`, strictMatchCount === 7, `got ${strictMatchCount}`);

// ============================================================
// C. Reviewer P1 #2 — Match filter taxonomy
// ============================================================
console.log('\n=== C. P1 #2: Match filter taxonomy ===');

check(`StmtMatchFilter type has EXACT`,
      source.includes("'EXACT'"));
check(`StmtMatchFilter has MATCHED_WITH_DIFFERENCE`,
      source.includes("'MATCHED_WITH_DIFFERENCE'"));
check(`StmtMatchFilter has UNMATCHED`,
      source.includes("'UNMATCHED'"));
check(`StmtMatchFilter has SETTLED_AFTER`,
      source.includes("'SETTLED_AFTER'"));
check(`MATCHED_WITH_DIFFERENCE includes BALANCE_DIFFERENCE`,
      /MATCHED_WITH_DIFFERENCE[\s\S]{0,200}BALANCE_DIFFERENCE/.test(source));
check(`MATCHED_WITH_DIFFERENCE includes CHANGED_AFTER_STATEMENT`,
      /MATCHED_WITH_DIFFERENCE[\s\S]{0,300}CHANGED_AFTER_STATEMENT/.test(source));
check(`dropdown labels: "Exact", "Matched with difference", "Unmatched (outside extract)", "Settled after statement"`,
      source.includes('>Exact<') &&
      source.includes('>Matched with difference<') &&
      source.includes('Unmatched (outside extract)') &&
      source.includes('Settled after statement'));

// ============================================================
// D. Reviewer P1 #3 — Cross-tab focus tolerates OPEN filter
// ============================================================
console.log('\n=== D. P1 #3: Focus + OPEN filter compat ===');

check(`focusedTxId state added in PartyDetailPage`,
      source.includes('const [focusedTxId, setFocusedTxId]'));
check(`focusTransaction function defined`,
      source.includes('const focusTransaction = (txId: string | null)'));
check(`focusing also switches activeTab to transactions`,
      source.includes("setActiveTab('transactions')"));

// Critical: TransactionsTab OPEN filter must INCLUDE focused row
// even if it's settled
check(`OPEN filter includes focused-tx exception`,
      source.includes("t.id === focusedTxId"));
check(`focused row receives scrollIntoView`,
      source.includes('scrollIntoView'));
check(`focused row gets tx-row-focused class`,
      source.includes('tx-row-focused'));

// useEffect timer clears focus
check(`focus auto-clears via setTimeout`,
      source.includes('setTimeout(') && source.includes('onClearFocus()'));

// ============================================================
// E. Reviewer P2 — Priority order strict-first
// ============================================================
console.log('\n=== E. P2: Priority order ===');

// Spot-check the priority function
check(`matchTypePriority: strict NOT_IN_ERP gets 1 (highest)`,
      /NOT_IN_ERP_EXTRACT' && isStrict\) return 1/.test(source));
check(`matchTypePriority: BALANCE_DIFFERENCE gets 2`,
      /BALANCE_DIFFERENCE'\)\s*return 2/.test(source));
check(`matchTypePriority: CHANGED_AFTER_STATEMENT gets 3`,
      /CHANGED_AFTER_STATEMENT'\)\s*return 3/.test(source));
check(`matchTypePriority: broad NOT_IN_ERP_EXTRACT gets 4`,
      /matchType === 'NOT_IN_ERP_EXTRACT'\)\s*return 4/.test(source));
check(`matchTypePriority: SETTLED_AFTER_STATEMENT gets 5`,
      /SETTLED_AFTER_STATEMENT'\)\s*return 5/.test(source));
check(`matchTypePriority: EXACT_SIGNED gets 6`,
      /EXACT_SIGNED'\)\s*return 6/.test(source));

// ============================================================
// F. Reviewer S6 — Trace panel section name (not "RAW")
// ============================================================
console.log('\n=== F. S6: Trace panel section names ===');

check(`uses "Statement status fields" (not "RAW")`,
      source.includes('STATEMENT STATUS FIELDS'));
check(`source does NOT use bare "RAW" section label`,
      !/<div[^>]*>RAW<\/div>/.test(source) &&
      !source.includes('section-label">RAW'));
check(`trace shows referenceStatus when present`,
      source.includes('link.referenceStatus'));
check(`trace shows differenceType when present`,
      source.includes('link.differenceType'));

// ============================================================
// G. Real-data verification with cedrus-global-trading
//    (10 broad NOT_IN_ERP + 2 strict + 4 BAL_DIFF + 4 EXACT)
// ============================================================
console.log('\n=== G. Real-data: cedrus-global-trading (3 matchTypes) ===');

const cedrus = selectPartyDetail('cedrus-global-trading', result);
check(`cedrus has statement links`, cedrus.statementLinks.length > 0,
      `got ${cedrus.statementLinks.length}`);

const cedrusByType = {};
for (const l of cedrus.statementLinks) {
  cedrusByType[l.matchType] = (cedrusByType[l.matchType] ?? 0) + 1;
}
check(`cedrus has NOT_IN_ERP_EXTRACT links`, (cedrusByType['NOT_IN_ERP_EXTRACT'] ?? 0) > 0,
      `got ${cedrusByType['NOT_IN_ERP_EXTRACT'] ?? 0}`);
check(`cedrus has BALANCE_DIFFERENCE links`, (cedrusByType['BALANCE_DIFFERENCE'] ?? 0) > 0);
check(`cedrus has EXACT_SIGNED links`,        (cedrusByType['EXACT_SIGNED'] ?? 0) > 0);

// Of cedrus's NOT_IN_ERP, how many are strict?
const cedrusReview = cedrus.reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT');
const cedrusStrictKeys = new Set(
  cedrusReview.filter(r => r.trace).map(r => `${r.trace.sourceFile}|${r.trace.sourceRow}`),
);
const cedrusStrictLinks = cedrus.statementLinks
  .filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT')
  .filter(l => cedrusStrictKeys.has(`${l.sourceFile}|${l.sourceRow}`));
check(`cedrus has at least 1 strict (review-item-backed) NOT_IN_ERP`,
      cedrusStrictLinks.length >= 1, `got ${cedrusStrictLinks.length}`);

const cedrusBroadLinks = cedrus.statementLinks
  .filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT')
  .filter(l => !cedrusStrictKeys.has(`${l.sourceFile}|${l.sourceRow}`));
check(`cedrus has broad NOT_IN_ERP rows distinct from strict`,
      cedrusBroadLinks.length >= 1, `got ${cedrusBroadLinks.length}`);

// ============================================================
// H. Priority sort produces the expected top-row composition
// ============================================================
console.log('\n=== H. Priority sort top rows ===');

// Replicate the priority function
function priority(link, isStrict) {
  if (link.matchType === 'NOT_IN_ERP_EXTRACT' && isStrict) return 1;
  if (link.matchType === 'BALANCE_DIFFERENCE')             return 2;
  if (link.matchType === 'CHANGED_AFTER_STATEMENT')        return 3;
  if (link.matchType === 'NOT_IN_ERP_EXTRACT')             return 4;
  if (link.matchType === 'SETTLED_AFTER_STATEMENT')        return 5;
  if (link.matchType === 'EXACT_SIGNED')                   return 6;
  return 7;
}

const cedrusSorted = [...cedrus.statementLinks].sort((a, b) => {
  const pa = priority(a, cedrusStrictKeys.has(`${a.sourceFile}|${a.sourceRow}`));
  const pb = priority(b, cedrusStrictKeys.has(`${b.sourceFile}|${b.sourceRow}`));
  if (pa !== pb) return pa - pb;
  return Math.abs(b.statementBalance) - Math.abs(a.statementBalance);
});

// First rows should be strict
const firstP = priority(cedrusSorted[0], cedrusStrictKeys.has(`${cedrusSorted[0].sourceFile}|${cedrusSorted[0].sourceRow}`));
check(`cedrus first sorted row has priority 1 or 2`, firstP <= 2, `got priority ${firstP}`);

// Last rows should be EXACT_SIGNED (unless party has none)
const lastP = priority(cedrusSorted[cedrusSorted.length - 1], cedrusStrictKeys.has(`${cedrusSorted[cedrusSorted.length-1].sourceFile}|${cedrusSorted[cedrusSorted.length-1].sourceRow}`));
check(`cedrus last sorted row has priority >= 4`, lastP >= 4, `got priority ${lastP}`);

// ============================================================
// I. Empty state copy
// ============================================================
console.log('\n=== I. Empty state ===');

check(`source includes "No statement rows for this party"`,
      source.includes('No statement rows for this party'));
check(`empty copy mentions LOCAL_STATEMENT and AGENT_STATEMENT`,
      source.includes('LOCAL_STATEMENT') && source.includes('AGENT_STATEMENT'));

// ============================================================
// J. Footer reconciliation note (broad vs strict)
// ============================================================
console.log('\n=== J. Footer broad/strict reconciliation ===');

check(`broadNotInErpCount derived from links`,
      source.includes('broadNotInErpCount'));
check(`strictNotInErpCount derived from links + strict set`,
      source.includes('strictNotInErpCount'));
check(`footer says "outside the uploaded ERP extract"`,
      source.includes('outside the uploaded ERP extract'));
check(`footer says "confirmed review item"`,
      source.includes('confirmed review'));

// ============================================================
// K. ERP match cell behavior
// ============================================================
console.log('\n=== K. ERP match cell ===');

check(`ErpMatchCell returns em-dash for unmatched`,
      source.includes("if (!link.matchedTransactionId)"));
check(`ErpMatchCell shows source-file:row arrow link`,
      source.includes('→') && source.includes('tx.trace.sourceRow'));
check(`ErpMatchCell shows delta on BALANCE_DIFFERENCE`,
      source.includes("'BALANCE_DIFFERENCE'") && source.includes('Δ '));
check(`onClick triggers onFocus`,
      /onClick={\(\) => onFocus\(tx\.id\)}/.test(source));

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
