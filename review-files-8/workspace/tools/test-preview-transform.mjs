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

// Check 2: AGENT FK preservation — reviewer P0 #1
console.log(`\n=== AGENT FK preservation (P0 #1) ===`);
const agentLinks = d.statementLinks.filter(l => l.source === 'AGENT');
const agentSummaryMatched = result.statementMatchReport?.agent?.matchedRefCount ?? 0;
const agentLinksMatched = agentLinks.filter(l => l.matchedTransactionId !== null).length;
console.log(`AGENT total rows:           ${agentLinks.length}`);
console.log(`Summary matchedRefCount:    ${agentSummaryMatched}`);
console.log(`v2 matched FK count:        ${agentLinksMatched}`);
if (agentLinksMatched < agentSummaryMatched) {
  console.error(`  FAIL: AGENT FK regression — Phase 1 says ${agentSummaryMatched}, v2 says ${agentLinksMatched}`);
  const failing = agentLinks.filter(l => l.matchedTransactionId === null && l.crdrNo).slice(0, 3);
  if (failing.length) {
    console.error(`  Sample agent links with crdrNo but no FK:`);
    for (const f of failing) console.error(`    ${JSON.stringify(f)}`);
  }
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
console.log(`\n=== id format ===`);
const idPattern = /^(INVOICE|CRDR|AP):[^#]+#\d+:[a-f0-9]+$/;
const badIds = d.transactions.filter(t => !idPattern.test(t.id)).slice(0, 3);
console.log(`Matching format: ${d.transactions.length - badIds.length}/${d.transactions.length}`);
if (badIds.length) {
  console.error('  FAIL:');
  for (const b of badIds) console.error(`    ${b.id}`);
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
