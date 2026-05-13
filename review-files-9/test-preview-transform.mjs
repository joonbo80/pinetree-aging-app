// tools/test-preview-transform.mjs
// Runs the v2 previewTransform on the frozen Phase 1 baseline raw output
// and verifies the details block is well-formed.
//
// Windows-safe: uses pathToFileURL for dynamic ESM import (reviewer P2).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const previewTransformPath = resolve(__dirname, '../aging-api/src/services/previewTransform.ts');
const { toParsingPreviewResult } = await import(pathToFileURL(previewTransformPath).href);

const rawPath = resolve(__dirname, '../baselines/phase1-v1.3.0/erp-all-parse-result.json');
const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

console.log(`Input: ${raw.transactions?.length ?? 0} transactions, ${raw.statements?.length ?? 0} statements`);

const result = toParsingPreviewResult(raw);

console.log(`\n=== Top-level shape ===`);
console.log(`schemaVersion: ${result.schemaVersion}`);
console.log(`has details: ${!!result.details}`);

if (!result.details) {
  console.error('FAIL: no details');
  process.exit(1);
}

const d = result.details;
console.log(`\n=== Details counts ===`);
console.log(`transactions:    ${d.transactions.length}`);
console.log(`reviewItems:     ${d.reviewItems.length}`);
console.log(`duplicateGroups: ${d.duplicateGroups.length}`);
console.log(`statementLinks:  ${d.statementLinks.length}`);

let allPass = true;

// Check 1: Duplicates match summary
console.log(`\n=== Cross-check: duplicates ===`);
const summaryDupGroups = result.duplicateReview.groupCount;
const summaryDupTx = result.duplicateReview.transactionCount;
const detailDupTxIds = new Set(d.duplicateGroups.flatMap(g => g.transactionIds));
console.log(`groups: summary=${summaryDupGroups} ↔ details=${d.duplicateGroups.length}`);
console.log(`tx:     summary=${summaryDupTx} ↔ details unique=${detailDupTxIds.size}`);
if (summaryDupGroups !== d.duplicateGroups.length) {
  console.error('  FAIL: duplicate group count mismatch');
  allPass = false;
} else {
  console.log('  PASS');
}

// Check 2: AGENT FK preservation — reviewer P0 #1 / rev2 P0 #2
console.log(`\n=== AGENT FK preservation ===`);
const agentLinks = d.statementLinks.filter(l => l.source === 'AGENT');
// The summary field is `matchedCRDRRefs`, not `matchedRefCount` (rev1 used
// the wrong name and got vacuous-pass via 85 ≥ 0).
const agentSummaryMatched = result.statementMatchReport?.agent?.matchedCRDRRefs ?? 0;
const agentLinksMatched = agentLinks.filter(l => l.matchedTransactionId !== null).length;
console.log(`AGENT total rows:           ${agentLinks.length}`);
console.log(`Summary matchedCRDRRefs:    ${agentSummaryMatched}`);
console.log(`v2 matched FK count:        ${agentLinksMatched}`);
console.log(`Hard-asserted floor (v1.0 audit): 85`);
// Hard equality: not "≥" comparison.
if (agentLinks.length !== 85) {
  console.error(`  FAIL: expected 85 AGENT links, got ${agentLinks.length}`);
  allPass = false;
} else if (agentLinksMatched !== 85) {
  console.error(`  FAIL: expected 85/85 matched, got ${agentLinksMatched}/85`);
  const failing = agentLinks.filter(l => l.matchedTransactionId === null && l.crdrNo).slice(0, 3);
  for (const f of failing) console.error(`    ${JSON.stringify(f)}`);
  allPass = false;
} else if (agentSummaryMatched !== 85) {
  console.error(`  FAIL: summary matchedCRDRRefs expected 85, got ${agentSummaryMatched}`);
  allPass = false;
} else {
  console.log('  PASS (85/85 matched, summary agrees)');
}

// Check 2.5: LOCAL exact-match FK correctness (reviewer rev2 P0 #1)
//
// EXACT_SIGNED links must point to the row in exactSignedBalanceMatches[0],
// not to candidateRows[0]. Round 1 had 76/162 EXACT_SIGNED links pointing
// to wrong rows.
console.log(`\n=== LOCAL EXACT_SIGNED correctness (rev2 P0 #1) ===`);
const exactLocalLinks = d.statementLinks.filter(l => l.source === 'LOCAL' && l.matchType === 'EXACT_SIGNED');
console.log(`LOCAL EXACT_SIGNED links:   ${exactLocalLinks.length}`);

// Cross-reference each link back to the raw exactSignedBalanceMatches[0]
// to confirm the FK actually points there.
let exactCorrect = 0, exactWrong = 0;
const txIdToInfo = new Map();
for (const t of d.transactions) {
  txIdToInfo.set(t.id, { sourceType: t.sourceType, sourceRow: t.trace.sourceRow });
}
for (const stmt of raw.statementMatchReport?.local?.statements ?? []) {
  for (const m of stmt.matches ?? []) {
    const esm = m.exactSignedBalanceMatches;
    if (!Array.isArray(esm) || esm.length === 0) continue;
    const expected = esm[0];
    const link = exactLocalLinks.find(l =>
      l.sourceFile === stmt.sourceFile && l.sourceRow === m.statementRow,
    );
    if (!link || !link.matchedTransactionId) continue;
    const actual = txIdToInfo.get(link.matchedTransactionId);
    if (actual && actual.sourceType === expected.sourceType && actual.sourceRow === expected.sourceRow) {
      exactCorrect++;
    } else {
      exactWrong++;
      if (exactWrong <= 3) {
        console.error(`  WRONG: stmt ${stmt.partyName} row ${m.statementRow} ref ${m.ourRefNo}`);
        console.error(`         expected ${expected.sourceType} row ${expected.sourceRow}`);
        console.error(`         got      ${actual.sourceType} row ${actual.sourceRow}`);
      }
    }
  }
}
console.log(`Correctly pointing to esm[0]: ${exactCorrect}`);
console.log(`Wrong FK:                     ${exactWrong}`);
if (exactWrong > 0) {
  console.error(`  FAIL: ${exactWrong} EXACT_SIGNED links point to wrong row`);
  allPass = false;
} else {
  console.log('  PASS');
}

// Check 3: LOCAL FK rate
console.log(`\n=== LOCAL FK rate ===`);
const localLinks = d.statementLinks.filter(l => l.source === 'LOCAL');
const localFound = localLinks.filter(l => l.matchType !== 'NOT_IN_ERP_EXTRACT' && l.matchType !== 'OUTSIDE_DATE_RANGE');
const localMatched = localFound.filter(l => l.matchedTransactionId !== null).length;
const localFkRate = localFound.length === 0 ? 1 : localMatched / localFound.length;
console.log(`LOCAL "should be in ERP" rows: ${localFound.length}`);
console.log(`Of which FK resolved:           ${localMatched}`);
console.log(`FK resolution rate: ${(localFkRate * 100).toFixed(1)}%`);
if (localFkRate < 0.95) {
  console.error(`  FAIL: LOCAL FK rate below 95%`);
  const failing = localFound.filter(l => l.matchedTransactionId === null).slice(0, 3);
  for (const f of failing) console.error(`    ${JSON.stringify(f)}`);
  allPass = false;
} else {
  console.log('  PASS');
}

// Check 4: matchType distribution
console.log(`\n=== matchType distribution ===`);
const localDist = new Map();
for (const l of localLinks) localDist.set(l.matchType, (localDist.get(l.matchType) ?? 0) + 1);
console.log('LOCAL:');
for (const [k, v] of [...localDist].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}`);

const agentDist = new Map();
for (const l of agentLinks) agentDist.set(l.matchType, (agentDist.get(l.matchType) ?? 0) + 1);
console.log('AGENT:');
for (const [k, v] of [...agentDist].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}`);

// Check 4.5: NOT_IN_ERP_EXTRACT review items must equal Dashboard's 7
// (reviewer rev2 P1 #3 — UX contract)
console.log(`\n=== NOT_IN_ERP_EXTRACT UX contract (rev2 P1 #3) ===`);
const notInErpReviews = d.reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT').length;
const summaryReviewLocal = result.reviewCandidates.local.length;
console.log(`Dashboard "Not in ERP extract" card: ${summaryReviewLocal}`);
console.log(`ReviewItem NOT_IN_ERP_EXTRACT count: ${notInErpReviews}`);
console.log(`StatementLinks with matchType NOT_IN_ERP_EXTRACT: ${d.statementLinks.filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT').length}`);
if (notInErpReviews !== summaryReviewLocal) {
  console.error(`  FAIL: ReviewItem count (${notInErpReviews}) != Dashboard count (${summaryReviewLocal})`);
  console.error(`  Clicking the card opens a list with the wrong number of rows`);
  allPass = false;
} else {
  console.log(`  PASS — ${notInErpReviews} = ${summaryReviewLocal}, click takes user to matching list`);
}

// Check 5: FK integrity (spec §4.3)
console.log(`\n=== FK integrity (spec §4.3) ===`);
const ids = new Set(d.transactions.map(t => t.id));
let okReview = true, okDup = true, okStmt = true;
for (const r of d.reviewItems) {
  if (r.transactionId !== null && !ids.has(r.transactionId)) { okReview = false; break; }
}
for (const g of d.duplicateGroups) {
  for (const id of g.transactionIds) if (!ids.has(id)) { okDup = false; break; }
  if (!okDup) break;
}
for (const s of d.statementLinks) {
  if (s.matchedTransactionId !== null && !ids.has(s.matchedTransactionId)) { okStmt = false; break; }
}
console.log(`reviewItem FK:    ${okReview ? 'PASS' : 'FAIL'}`);
console.log(`duplicateGroup FK: ${okDup ? 'PASS' : 'FAIL'}`);
console.log(`statementLink FK:  ${okStmt ? 'PASS' : 'FAIL'}`);
if (!okReview || !okDup || !okStmt) allPass = false;

// Check 6: Determinism
console.log(`\n=== Determinism ===`);
const result2 = toParsingPreviewResult(raw);
const ids2 = new Set(result2.details.transactions.map(t => t.id));
let stable = true;
for (const id of ids) if (!ids2.has(id)) { stable = false; break; }
console.log(`Same input → same ids: ${stable ? 'PASS' : 'FAIL'}`);
if (!stable) allPass = false;

// Check 7: id format
//
// New identity-first format: <sourceType>:<sourceIdentityKey>:<hashShort>:<sourceRow>
// (rev2 P1 #4 — file name removed from id)
console.log(`\n=== id format ===`);
const idPattern = /^(INVOICE|CRDR|AP):[^:]+:[a-f0-9]+:\d+$/;
const badIds = d.transactions.filter(t => !idPattern.test(t.id)).slice(0, 3);
console.log(`Matching format: ${d.transactions.length - badIds.length}/${d.transactions.length}`);
if (badIds.length) {
  console.error('  FAIL:');
  for (const b of badIds) console.error(`    ${b.id}`);
  allPass = false;
} else {
  console.log('  PASS');
}

// Check 7.5: id is independent of sourceFile (rev2 P1 #4)
//
// Re-running the projection on raw with files renamed should produce the
// same ids. Synthesize this by mutating sourceFile in a copy.
console.log(`\n=== id independence from sourceFile (rev2 P1 #4) ===`);
const rawCopy = JSON.parse(JSON.stringify(raw));
for (const tx of rawCopy.transactions) {
  tx.sourceFile = `RENAMED_${tx.sourceFile}`;
}
const renamedResult = toParsingPreviewResult(rawCopy);
const renamedIds = new Set(renamedResult.details.transactions.map(t => t.id));
let independentMatch = 0;
for (const id of ids) if (renamedIds.has(id)) independentMatch++;
console.log(`Original ids preserved after file rename: ${independentMatch}/${ids.size}`);
if (independentMatch !== ids.size) {
  console.error(`  FAIL: ids changed when sourceFile changed`);
  allPass = false;
} else {
  console.log('  PASS');
}

// Samples
console.log(`\n=== Sample LOCAL link (matched) ===`);
console.log(JSON.stringify(localLinks.find(l => l.matchedTransactionId !== null) ?? localLinks[0], null, 2));

console.log(`\n=== Sample AGENT link (matched) ===`);
console.log(JSON.stringify(agentLinks.find(l => l.matchedTransactionId !== null) ?? agentLinks[0], null, 2));

console.log(`\n=== Sample PreviewTransaction ===`);
console.log(JSON.stringify(d.transactions[0], null, 2));

const json = JSON.stringify(result);
console.log(`\nPayload size: ${(json.length / 1024).toFixed(1)} KB`);

console.log(`\n${'='.repeat(60)}`);
console.log(`OVERALL: ${allPass ? 'ALL CHECKS PASS' : 'FAILURES PRESENT'}`);
console.log(`${'='.repeat(60)}`);
process.exit(allPass ? 0 : 1);
