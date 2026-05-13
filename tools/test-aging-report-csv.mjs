// tools/test-aging-report-csv.mjs
//
// Round 6 invariant test for Statement Collection Workbench CSV export.
// Imports the production CSV helper directly.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const exportPath = resolve(
  root,
  'aging-app/src/components/aging/exportCsv.ts',
);
const buttonPath = resolve(
  root,
  'aging-app/src/components/aging/AgingExportButton.tsx',
);
const pagePath = resolve(root, 'aging-app/src/pages/AgingReportPage.tsx');
const cssPath = resolve(root, 'aging-app/src/styles/v2.3-aging-report.css');
const selectorPath = resolve(root, 'aging-app/src/selectors/agingReport.ts');
const baselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);

const exportSource = readFileSync(exportPath, 'utf8');
const buttonSource = readFileSync(buttonPath, 'utf8');
const pageSource = readFileSync(pagePath, 'utf8');
const cssSource = readFileSync(cssPath, 'utf8');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}`);
  }
}

function rowsFromCsv(content) {
  return content.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
}

function headerFrom(content) {
  return rowsFromCsv(content)[0].split(',');
}

console.log('=== Round 6 source invariants ===');

check(
  'exportCsv.ts exports buildAgingCsv',
  exportSource.includes('export function buildAgingCsv'),
);
check(
  'exportCsv.ts exports collectCsvRows',
  exportSource.includes('export function collectCsvRows'),
);
check(
  'exportCsv.ts exports escapeCsvField',
  exportSource.includes('export function escapeCsvField'),
);
check(
  'export helper imports production filter helper with .ts extension',
  exportSource.includes("from './agingFilterLogic.ts'"),
);
check(
  'AgingExportButton renders Export filtered',
  buttonSource.includes('Export filtered'),
);
check(
  'AgingExportButton renders Export all',
  buttonSource.includes('Export all'),
);
check(
  'AgingExportButton uses Blob URL download',
  buttonSource.includes('URL.createObjectURL') &&
    buttonSource.includes('document.createElement') &&
    buttonSource.includes('anchor.download'),
);
check(
  'AgingExportButton appends anchor to DOM',
  buttonSource.includes('document.body.appendChild(anchor)'),
);
check(
  'AgingExportButton defers object URL revoke',
  buttonSource.includes('setTimeout') &&
    buttonSource.includes('URL.revokeObjectURL(url)'),
);
check(
  'AgingReportPage renders AgingExportButton',
  pageSource.includes('<AgingExportButton report={report} filters={filters} />'),
);
check(
  'CSV export button CSS exists',
  cssSource.includes('.aging-export-actions') &&
    cssSource.includes('.aging-export-btn'),
);

console.log('=== Round 6 format invariants ===');

const { selectAgingReport } = await import(`file://${selectorPath}`);
const {
  buildAgingCsv,
  buildFilterSummary,
  escapeCsvField,
} = await import(`file://${exportPath}`);
const report = selectAgingReport(baseline);
const baseFilters = {
  asOfDate: '2026-05-01',
  currencies: [],
  directions: [],
  signals: [],
};

const allCsv = buildAgingCsv({
  report,
  scope: 'all',
});

const expectedHeader = [
  'Tab',
  'PartyKey',
  'PartyName',
  'Currency',
  'Direction',
  'OpenAmount',
  'OldestAgingDays',
  'InvoiceCount',
  'StatementStatus',
  'ActionReadiness',
  'PriorityBand',
  'HighAmount',
  'NinetyPlus',
  'HasDuplicate',
  'MissingDueDate',
];

check('CSV content starts with UTF-8 BOM', allCsv.content.charCodeAt(0) === 0xfeff);
check(
  'CSV header has 15 columns in exact order',
  JSON.stringify(headerFrom(allCsv.content)) === JSON.stringify(expectedHeader),
);
check(
  'RFC 4180 escapes comma',
  escapeCsvField('A,B') === '"A,B"',
);
check(
  'RFC 4180 escapes quote',
  escapeCsvField('A "B"') === '"A ""B"""',
);
check(
  'RFC 4180 escapes newline',
  escapeCsvField('A\nB') === '"A\nB"',
);
check(
  'All CSV filename is asOfDate-all',
  allCsv.filename === 'aging-2026-05-01-all.csv',
);
check('All CSV has 268 party rollup rows', allCsv.rowCount === 268);
check(
  'All CSV line count equals header + rowCount',
  rowsFromCsv(allCsv.content).length === allCsv.rowCount + 1,
);
check(
  'All CSV includes only valid tab names',
  rowsFromCsv(allCsv.content)
    .slice(1)
    .every((line) => ['Current', 'Overdue', 'Cleared'].includes(line.split(',')[0])),
);
check(
  'All CSV direction values are AR/AP/Settled',
  rowsFromCsv(allCsv.content)
    .slice(1)
    .every((line) => ['AR', 'AP', 'Settled'].includes(line.split(',')[4])),
);
check(
  'NotInErpExtract is excluded from party rollup CSV',
  !allCsv.content.includes('NOT_IN_ERP_EXTRACT') &&
    !allCsv.content.includes('NotInERP'),
);

console.log('=== Round 6 filtered output invariants ===');

const cadCsv = buildAgingCsv({
  report,
  scope: 'filtered',
  filters: { ...baseFilters, currencies: ['CAD'] },
});
check('CAD filtered filename is stable', cadCsv.filename === 'aging-2026-05-01-CAD.csv');
check('CAD filtered CSV has 159 party rows', cadCsv.rowCount === 159);
check(
  'CAD filtered CSV contains only CAD rows',
  rowsFromCsv(cadCsv.content)
    .slice(1)
    .every((line) => line.split(',')[3] === 'CAD'),
);

const statementDiffCsv = buildAgingCsv({
  report,
  scope: 'filtered',
  filters: { ...baseFilters, signals: ['statementDiff'] },
});
check(
  'Statement Diff filtered CSV has 21 party rows',
  statementDiffCsv.rowCount === 21,
);
check(
  'Statement Diff filtered CSV includes IATA',
  statementDiffCsv.content.includes('iata-cargo-accounts'),
);
check(
  'Statement Diff filtered CSV contains only statement-diff statuses',
  rowsFromCsv(statementDiffCsv.content)
    .slice(1)
    .every((line) =>
      ['BalanceDifference', 'SettledAfterStatement'].includes(
        line.split(',')[8],
      ),
    ),
);

const comboCsv = buildAgingCsv({
  report,
  scope: 'filtered',
  filters: {
    ...baseFilters,
    currencies: ['CAD'],
    directions: ['receivable'],
    signals: ['statementDiff'],
  },
});
check(
  'CAD + AR + statementDiff filename is stable',
  comboCsv.filename === 'aging-2026-05-01-CAD-AR-statementDiff.csv',
);
check(
  'CAD + AR + statementDiff CSV has 3 party rows',
  comboCsv.rowCount === 3,
);
check(
  'CAD + AR + statementDiff rows are CAD AR only',
  rowsFromCsv(comboCsv.content)
    .slice(1)
    .every((line) => {
      const cols = line.split(',');
      return cols[3] === 'CAD' && cols[4] === 'AR';
    }),
);

check(
  'filter summary joins currencies directions signals',
  buildFilterSummary('filtered', {
    ...baseFilters,
    currencies: ['CAD', 'USD'],
    directions: ['payable'],
    signals: ['statementDiff'],
  }) === 'CAD-USD-AP-statementDiff',
);

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  process.exit(1);
}
