// Step 11 CSV export invariants.
// Catches the release blocker where PartyDetailPage existed but CSV
// export was never absorbed into the mainline.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pagePath = resolve(root, 'aging-app/src/components/party/PartyDetailPage.tsx');
const csvPath = resolve(root, 'aging-app/src/components/party/csvExport.ts');
const page = readFileSync(pagePath, 'utf8');
const csv = existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '';

let pass = 0;
let fail = 0;

function check(label, ok) {
  if (ok) {
    pass++;
    console.log(`PASS ${label}`);
  } else {
    fail++;
    console.error(`FAIL ${label}`);
  }
}

console.log('\n=== CSV module ===');
check('csvExport.ts exists', existsSync(csvPath));
check('exportPartyTabCsv exported', /export function exportPartyTabCsv/.test(csv));
check('UTF-8 BOM is written', /\\uFEFF/.test(csv));
check('download anchor is appended to DOM', /document\.body\.appendChild\(a\)/.test(csv));
check('object URL revoke is deferred', /setTimeout\(\(\)\s*=>\s*URL\.revokeObjectURL\(url\),\s*0\)/.test(csv));
check('object URL is NOT revoked synchronously after click', !/a\.click\(\);\s*URL\.revokeObjectURL\(url\)/.test(csv));

console.log('\n=== PartyDetailPage wiring ===');
check('PartyDetailPage imports exportPartyTabCsv', /import\s*\{\s*exportPartyTabCsv\s*\}\s*from\s*['"]\.\/csvExport['"]/.test(page));
for (const tab of ['transactions', 'statements', 'reviews', 'duplicates']) {
  check(`PartyDetailPage wires ${tab} export`, new RegExp(`exportPartyTabCsv\\(detail, ['"]${tab}['"]\\)`).test(page));
}
check('PartyDetailPage renders Export CSV label', (page.match(/Export CSV/g) ?? []).length >= 4);
check('PartyDetailPage uses export button class', /party-export-btn/.test(page));

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) process.exit(1);
