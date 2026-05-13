import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../aging-app/src/baselines/phase1-v1.3.0.json');
const selectorPath = resolve(__dirname, '../aging-app/src/selectors/partyDetail.ts');

const result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const { selectPartyDetail } = await import(pathToFileURL(selectorPath).href);

let pass = 0;
let fail = 0;

function check(label, ok, evidence = '') {
  if (ok) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL ${label}${evidence ? ` - ${evidence}` : ''}`);
  }
}

function humanizeKey(key) {
  if (!key) return 'Unknown party';
  return key
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const allPartyKeys = new Set();
for (const row of result.details.transactions) allPartyKeys.add(row.partyKey);
for (const row of result.details.statementLinks) allPartyKeys.add(row.partyKey);
for (const row of result.details.reviewItems) if (row.partyKey) allPartyKeys.add(row.partyKey);

const sample = selectPartyDetail('skymaster-express', result);

check('sample returns object', typeof sample === 'object' && sample !== null);
check('sample partyKey matches input', sample.partyKey === 'skymaster-express');
check('sample partyName is display name', sample.partyName === 'SKYMASTER EXPRESS');
check('sample partyName does not collapse to partyKey', sample.partyName !== sample.partyKey);
check('sample partyNameVariants is array', Array.isArray(sample.partyNameVariants));
check('sample department object exists', typeof sample.department === 'object' && sample.department !== null);
check('sample department dominant key exists', 'dominant' in sample.department);
check('sample department breakdown is array', Array.isArray(sample.department.breakdown));
check('sample status is allowed value', ['Clean', 'Has issues', 'Statement only'].includes(sample.status));
check('sample currencyTotals is array', Array.isArray(sample.currencyTotals));
check('sample summary has six keys', Object.keys(sample.summary).length === 6);
check('sample transactions is array', Array.isArray(sample.transactions));
check('sample statementLinks is array', Array.isArray(sample.statementLinks));
check('sample reviewItems is array', Array.isArray(sample.reviewItems));
check('sample duplicateGroups is array', Array.isArray(sample.duplicateGroups));
check('sample transactions count', sample.transactions.length === 86, `got ${sample.transactions.length}`);
check('sample statement links count', sample.statementLinks.length === 20, `got ${sample.statementLinks.length}`);
check('sample review item count', sample.reviewItems.length === 1, `got ${sample.reviewItems.length}`);
check('sample has separate currency totals', sample.currencyTotals.length === 2);
check('sample currency order USD first', sample.currencyTotals[0]?.currency === 'USD');
check('sample status has issues', sample.status === 'Has issues', `got ${sample.status}`);

check('no transaction leakage', sample.transactions.every(row => row.partyKey === sample.partyKey));
check('no statement leakage', sample.statementLinks.every(row => row.partyKey === sample.partyKey));
check('no review leakage', sample.reviewItems.every(row => row.partyKey === sample.partyKey));
const sampleTxIds = new Set(sample.transactions.map(row => row.id));
check('duplicate groups touch party', sample.duplicateGroups.every(group => group.transactionIds.some(id => sampleTxIds.has(id))));

let txSum = 0;
let linkSum = 0;
let reviewSum = 0;
let notInSum = 0;
let warningSum = 0;
let collapseCount = 0;
const details = [];

for (const key of allPartyKeys) {
  const detail = selectPartyDetail(key, result);
  details.push(detail);
  txSum += detail.summary.totalTransactions;
  linkSum += detail.summary.statementRows;
  reviewSum += detail.reviewItems.length;
  notInSum += detail.summary.notInErpExtract;
  warningSum += detail.summary.warnings;
  if (detail.partyKey.includes('-') && detail.partyName === detail.partyKey) collapseCount += 1;
}

check('sum transactions equals global', txSum === result.details.transactions.length, `got ${txSum}`);
check('sum statement links equals global', linkSum === result.details.statementLinks.length, `got ${linkSum}`);
check('sum review items equals global', reviewSum === result.details.reviewItems.filter(row => row.partyKey).length, `got ${reviewSum}`);
check('sum strict not-in-ERP equals dashboard', notInSum === result.reviewCandidates.local.length, `got ${notInSum}`);
check('sum warnings equals global warnings', warningSum === result.details.reviewItems.filter(row => row.category === 'WARNINGS').length, `got ${warningSum}`);
check('no selector display name collapses to kebab partyKey', collapseCount === 0, `got ${collapseCount}`);
check('all selector statuses are allowed', details.every(detail => ['Clean', 'Has issues', 'Statement only'].includes(detail.status)));
check('all selector currency totals have USD/CAD only', details.every(detail => detail.currencyTotals.every(row => row.currency === 'USD' || row.currency === 'CAD')));
check('all selector currency totals are max two rows', details.every(detail => detail.currencyTotals.length <= 2));
check('all non-empty parties have display names', details.every(detail => detail.partyName.trim().length > 0));

const statementOnlyKeys = [...allPartyKeys].filter(key => {
  const detail = selectPartyDetail(key, result);
  return detail.transactions.length === 0 && detail.statementLinks.length > 0;
});
check('statement-only parties exist in baseline', statementOnlyKeys.length > 0, `got ${statementOnlyKeys.length}`);

if (statementOnlyKeys.length > 0) {
  const statementOnly = selectPartyDetail(statementOnlyKeys[0], result);
  check('statement-only status', statementOnly.status === 'Statement only', `got ${statementOnly.status}`);
  check('statement-only has no currency totals', statementOnly.currencyTotals.length === 0);
  check('statement-only display name comes from data', statementOnly.partyName !== humanizeKey(statementOnly.partyKey));
}

const unknown = selectPartyDetail('this-party-does-not-exist', result);
check('unknown party returns empty transactions', unknown.transactions.length === 0);
check('unknown party returns empty statement links', unknown.statementLinks.length === 0);
check('unknown party returns empty review items', unknown.reviewItems.length === 0);
check('unknown party returns empty duplicate groups', unknown.duplicateGroups.length === 0);
check('unknown party humanized name', unknown.partyName === 'This Party Does Not Exist', `got ${unknown.partyName}`);

const schema10 = selectPartyDetail('skymaster-express', { ...result, details: undefined });
check('schema 1.0 no details returns empty', schema10.transactions.length === 0 && schema10.summary.totalTransactions === 0);
check('null result returns empty', selectPartyDetail('skymaster-express', null).transactions.length === 0);

const duplicateTouched = details.reduce((sum, detail) => sum + detail.summary.duplicateFlags, 0);
check('duplicate per-party count is at least global groups', duplicateTouched >= result.details.duplicateGroups.length);
check('determinism', JSON.stringify(selectPartyDetail('skymaster-express', result)) === JSON.stringify(selectPartyDetail('skymaster-express', result)));

console.log(`PASS: ${pass} FAIL: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
