// tools/test-preview-transform.mjs
// Runs the v2 previewTransform on the frozen Phase 1 baseline raw output
// and verifies the details block is well-formed.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Run via tsx so we can import the .ts directly
const { toParsingPreviewResult } = await import(
  resolve(__dirname, '../aging-api/src/services/previewTransform.ts')
);

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

// Cross-checks: numbers must match summary
const summaryReviewLocal = result.reviewCandidates.local.length;
const detailNotInErp = d.reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT').length;
console.log(`\n=== Cross-check: NOT_IN_ERP_EXTRACT ===`);
console.log(`summary reviewCandidates.local:           ${summaryReviewLocal}`);
console.log(`details NOT_IN_ERP_EXTRACT review items: ${detailNotInErp}`);

const summaryDupGroups = result.duplicateReview.groupCount;
console.log(`\n=== Cross-check: duplicates ===`);
console.log(`summary duplicateReview.groupCount: ${summaryDupGroups}`);
console.log(`details duplicateGroups.length:     ${d.duplicateGroups.length}`);

const summaryDupTx = result.duplicateReview.transactionCount;
const detailDupTxIds = new Set(d.duplicateGroups.flatMap(g => g.transactionIds));
console.log(`summary duplicateReview.transactionCount: ${summaryDupTx}`);
console.log(`details duplicateGroups unique tx count:  ${detailDupTxIds.size}`);

// Sample transaction
console.log(`\n=== Sample PreviewTransaction [0] ===`);
console.log(JSON.stringify(d.transactions[0], null, 2));

// Sample review item per category
console.log(`\n=== Sample ReviewItem per category ===`);
for (const cat of ['WARNINGS', 'AGING_90_PLUS', 'DUPLICATES', 'NOT_IN_ERP_EXTRACT', 'UNKNOWN_DEPARTMENT']) {
  const samples = d.reviewItems.filter(r => r.category === cat);
  console.log(`\n[${cat}] count=${samples.length}`);
  if (samples.length > 0) {
    console.log(JSON.stringify(samples[0], null, 2));
  }
}

// Validator from spec §4.3
console.log(`\n=== Validator (spec §4.3) ===`);
const ids = new Set(d.transactions.map(t => t.id));
let okReview = true, okDup = true, okStmt = true;
for (const r of d.reviewItems) {
  if (r.transactionId !== null && !ids.has(r.transactionId)) {
    console.error(`FAIL: review item ${r.id} references missing tx ${r.transactionId}`);
    okReview = false;
    break;
  }
}
for (const g of d.duplicateGroups) {
  if (!g.transactionIds.every(id => ids.has(id))) {
    console.error(`FAIL: duplicate group ${g.identityKey} references missing tx`);
    okDup = false;
    break;
  }
}
for (const s of d.statementLinks) {
  if (s.matchedTransactionId !== null && !ids.has(s.matchedTransactionId)) {
    console.error(`FAIL: statement link references missing tx ${s.matchedTransactionId}`);
    okStmt = false;
    break;
  }
}

console.log(`reviewItem FK integrity:    ${okReview ? 'PASS' : 'FAIL'}`);
console.log(`duplicateGroup FK integrity: ${okDup ? 'PASS' : 'FAIL'}`);
console.log(`statementLink FK integrity:  ${okStmt ? 'PASS' : 'FAIL'}`);

// Payload size
const json = JSON.stringify(result);
console.log(`\n=== Payload size ===`);
console.log(`uncompressed: ${(json.length / 1024).toFixed(1)} KB`);

// Expected per spec §1.8: ~960 KB
const ratio = (json.length / 1024 / 960);
console.log(`vs spec estimate of 960 KB: ${(ratio * 100).toFixed(0)}%`);

const allPass = okReview && okDup && okStmt;
process.exit(allPass ? 0 : 1);
