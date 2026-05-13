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

const allKeys = new Set(result.details.transactions.map(row => row.partyKey));
const sky = selectPartyDetail('skymaster-express', result);
const statementOnlyKey = [...new Set(result.details.statementLinks.map(row => row.partyKey))]
  .find(key => selectPartyDetail(key, result).transactions.length === 0);
const statementOnly = selectPartyDetail(statementOnlyKey ?? '', result);
const unknown = selectPartyDetail('totally-unknown-foo', result);

check('skymaster header name is display name', sky.partyName === 'SKYMASTER EXPRESS', `got ${sky.partyName}`);
check('skymaster header name is not key', sky.partyName !== sky.partyKey);
check('statement-only name from statement source', statementOnly.partyName !== statementOnly.partyKey);
check('unknown party humanized fallback', unknown.partyName === 'Totally Unknown Foo');

let dominantSet = 0;
let mixedSet = 0;
for (const key of allKeys) {
  const detail = selectPartyDetail(key, result);
  if (detail.transactions.length < 3) continue;
  if (detail.department.dominant) dominantSet += 1;
  else mixedSet += 1;
  if (detail.department.dominant) {
    const top = detail.department.breakdown[0];
    check(`${key} dominant department share >= 60%`, top.count / detail.transactions.length >= 0.6);
  }
}
check('department resolution has dominant examples', dominantSet > 0, `got ${dominantSet}`);
check('department resolution has mixed examples', mixedSet > 0, `got ${mixedSet}`);

check('skymaster status has issues', sky.status === 'Has issues', `got ${sky.status}`);
check('statement-only status', statementOnly.status === 'Statement only', `got ${statementOnly.status}`);

const clean = [...allKeys]
  .map(key => selectPartyDetail(key, result))
  .find(detail => detail.transactions.length > 0 && detail.reviewItems.length === 0 && detail.duplicateGroups.length === 0);
check('clean party exists', Boolean(clean));
if (clean) check('clean party status clean', clean.status === 'Clean', `got ${clean.status}`);

const mixedCurrency = [...allKeys]
  .map(key => selectPartyDetail(key, result))
  .find(detail => detail.currencyTotals.length === 2);
check('mixed currency party exists', Boolean(mixedCurrency));
if (mixedCurrency) {
  check('mixed currency has USD first', mixedCurrency.currencyTotals[0].currency === 'USD');
  check('mixed currency has CAD second', mixedCurrency.currencyTotals[1].currency === 'CAD');
  const manualUsd = mixedCurrency.transactions
    .filter(row => row.currency === 'USD' && row.direction !== 'settled')
    .reduce((sum, row) => sum + row.signedBalance, 0);
  const roundedUsd = Math.round((manualUsd + Number.EPSILON) * 100) / 100;
  check('USD net excludes settled', mixedCurrency.currencyTotals[0].netBalance === roundedUsd);
}
check('statement-only has no currency totals', statementOnly.currencyTotals.length === 0);

check('skymaster transaction card count', sky.summary.totalTransactions === 86);
check('skymaster statement card count', sky.summary.statementRows === 20);
check('skymaster ERP matched derivation', sky.summary.erpMatched === sky.statementLinks.filter(row => row.matchedTransactionId !== null).length);

const notInParty = result.details.reviewItems.find(row => row.category === 'NOT_IN_ERP_EXTRACT' && row.partyKey);
if (notInParty) {
  const detail = selectPartyDetail(notInParty.partyKey, result);
  check('not-in-ERP card count is strict review-row count', detail.summary.notInErpExtract === detail.reviewItems.filter(row => row.category === 'NOT_IN_ERP_EXTRACT').length);
}

const duplicateParty = [...allKeys]
  .map(key => selectPartyDetail(key, result))
  .find(detail => detail.summary.duplicateFlags > 0);
check('duplicate party exists', Boolean(duplicateParty));
if (duplicateParty) check('duplicate card count is group count', duplicateParty.summary.duplicateFlags === duplicateParty.duplicateGroups.length);

const routes = [
  ['totalTransactions', 'transactions'],
  ['statementRows', 'statements'],
  ['erpMatched', 'statements'],
  ['notInErpExtract', 'reviews'],
  ['duplicateFlags', 'duplicates'],
  ['warnings', 'reviews'],
];
check('six card-to-tab routes defined', routes.length === 6);
for (const [, tab] of routes) check(`card route target ${tab} is valid`, ['transactions', 'statements', 'reviews', 'duplicates'].includes(tab));

let collapse = 0;
for (const key of allKeys) {
  const detail = selectPartyDetail(key, result);
  if (detail.partyKey.includes('-') && detail.partyName === detail.partyKey) collapse += 1;
}
check('no party display name collapses to kebab key', collapse === 0, `got ${collapse}`);
check('determinism', JSON.stringify(selectPartyDetail('skymaster-express', result)) === JSON.stringify(selectPartyDetail('skymaster-express', result)));

console.log(`PASS: ${pass} FAIL: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
