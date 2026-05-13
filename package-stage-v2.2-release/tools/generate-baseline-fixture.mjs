// Generate the committed Phase 2 v2 baseline fixture.
//
// This script intentionally imports the compiled API projection from dist so
// it works without tsx/esbuild. Run `npm.cmd --prefix aging-api run build`
// first, or at least `tsc` + `node aging-api/scripts/copy-assets.mjs`.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const rawPath = resolve(root, 'baselines/phase1-v1.3.0/erp-all-parse-result.json');
const transformPath = resolve(root, 'aging-api/dist/services/previewTransform.js');
const appOut = resolve(root, 'aging-app/src/baselines/phase1-v1.3.0.json');
const apiOut = resolve(root, 'aging-api/src/baselines/phase1-v1.3.0.json');

const { toParsingPreviewResult } = await import(pathToFileURL(transformPath).href);

const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
const result = toParsingPreviewResult(raw);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateV2Baseline(json) {
  assert(json.schemaVersion === '1.1', `expected schemaVersion 1.1, got ${json.schemaVersion}`);
  assert(json.details, 'missing details block');

  const ids = new Set(json.details.transactions.map(t => t.id));
  assert(ids.size === json.details.transactions.length, 'transaction ids are not unique');

  for (const item of json.details.reviewItems) {
    if (item.transactionId !== null) {
      assert(ids.has(item.transactionId), `review item references missing tx ${item.transactionId}`);
    }
  }

  for (const group of json.details.duplicateGroups) {
    for (const id of group.transactionIds) {
      assert(ids.has(id), `duplicate group references missing tx ${id}`);
    }
  }

  for (const link of json.details.statementLinks) {
    if (link.matchedTransactionId !== null) {
      assert(ids.has(link.matchedTransactionId), `statement link references missing tx ${link.matchedTransactionId}`);
    }
  }

  const agentLinks = json.details.statementLinks.filter(l => l.source === 'AGENT');
  const agentMatched = agentLinks.filter(l => l.matchedTransactionId !== null).length;
  assert(agentLinks.length === 85, `expected 85 agent links, got ${agentLinks.length}`);
  assert(agentMatched === 85, `expected 85 matched agent links, got ${agentMatched}`);

  const localExact = json.details.statementLinks.filter(l => l.source === 'LOCAL' && l.matchType === 'EXACT_SIGNED');
  assert(localExact.length === 162, `expected 162 local exact links, got ${localExact.length}`);

  const strictNotInErp = json.details.reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT');
  assert(strictNotInErp.length === json.reviewCandidates.local.length, 'strict NOT_IN_ERP_EXTRACT count does not match reviewCandidates.local');

  return {
    transactions: json.details.transactions.length,
    reviewItems: json.details.reviewItems.length,
    duplicateGroups: json.details.duplicateGroups.length,
    statementLinks: json.details.statementLinks.length,
    agentMatched,
    localExact: localExact.length,
    strictNotInErp: strictNotInErp.length,
  };
}

const summary = validateV2Baseline(result);

mkdirSync(dirname(appOut), { recursive: true });
mkdirSync(dirname(apiOut), { recursive: true });

const body = `${JSON.stringify(result, null, 2)}\n`;
writeFileSync(appOut, body, 'utf8');
copyFileSync(appOut, apiOut);

console.log('[generate-baseline-fixture] wrote:');
console.log(`  ${appOut}`);
console.log(`  ${apiOut}`);
console.log('[generate-baseline-fixture] validation:', JSON.stringify(summary));
