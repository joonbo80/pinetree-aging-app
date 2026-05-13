import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const appPath = resolve(root, 'aging-app/src/App.tsx');
const dropZonePath = resolve(root, 'aging-app/src/components/DropZone.tsx');
const readinessPath = resolve(root, 'aging-app/src/components/Readiness.tsx');
const apiClientPath = resolve(root, 'aging-app/src/api/client.ts');
const snapshotPath = resolve(root, 'aging-app/src/utils/snapshot.ts');
const stringsPath = resolve(root, 'aging-app/src/i18n/strings.ts');
const cssPath = resolve(root, 'aging-app/src/styles/global.css');
const baselinePath = resolve(root, 'aging-app/src/baselines/phase1-v1.3.0.json');

let pass = 0;
let fail = 0;

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function check(name, condition) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}`);
  }
}

function read(path) {
  return readFileSync(path, 'utf8');
}

const app = read(appPath);
const dropZone = read(dropZonePath);
const readiness = read(readinessPath);
const apiClient = read(apiClientPath);
const snapshotSource = read(snapshotPath);
const strings = read(stringsPath);
const css = read(cssPath);
const baseline = JSON.parse(read(baselinePath));

section('c3-1: snapshot helper structure');
check('snapshot.ts exists and exports version', snapshotSource.includes("SNAPSHOT_VERSION = 'v2.3-c3-snapshot-v1'"));
check('snapshot storage key is committed snapshot v1', snapshotSource.includes("SNAPSHOT_STORAGE_KEY = 'agingApp.committedSnapshot.v1'"));
check('buildAgingSnapshot exported', snapshotSource.includes('export function buildAgingSnapshot'));
check('parseSnapshotText exported', snapshotSource.includes('export function parseSnapshotText'));
check('save/load/clear storage helpers exported',
  snapshotSource.includes('saveSnapshotToStorage') &&
  snapshotSource.includes('loadSnapshotFromStorage') &&
  snapshotSource.includes('clearSnapshotStorage'));
check('snapshot filename includes asOfDate and importBatchId',
  snapshotSource.includes('aging-snapshot-${asOfDate}-${batchId}.json'));

section('c3-2: App integration');
check('App imports snapshot helpers', app.includes("from './utils/snapshot'"));
check('App restores snapshot on mount', app.includes('loadSnapshotFromStorage()') && app.includes("setDataSource('snapshot')"));
check('Confirm Import saves full snapshot', app.includes('buildAgingSnapshot(result, dataSource, session.timestamp)') && app.includes('saveSnapshotToStorage(snapshot)'));
check('Clear removes snapshot storage', app.includes('clearSnapshotStorage()'));
check('App can export snapshot download', app.includes('handleExportSnapshot') && app.includes('snapshotFilename(snapshot)'));
check('App can import snapshot file', app.includes('handleImportSnapshot') && app.includes('parseSnapshotText(text)'));
check('Snapshot import navigates to dashboard', app.includes("navigate('/dashboard')"));
check('DropZone receives snapshot handlers', app.includes('onImportSnapshot={handleImportSnapshot}') && app.includes('onExportSnapshot={handleExportSnapshot}'));

section('c3-3: UI controls and source label');
check('DropZone has import snapshot prop', dropZone.includes('onImportSnapshot: (file: File) => void'));
check('DropZone has export snapshot prop', dropZone.includes('onExportSnapshot: () => void'));
check('DropZone accepts JSON snapshot files', dropZone.includes('accept="application/json,.json"'));
check('DropZone renders import/export labels', dropZone.includes('t.importSnapshot') && dropZone.includes('t.exportSnapshot'));
check('DataSource includes snapshot', apiClient.includes("export type DataSource = 'api' | 'fallback' | 'snapshot' | 'unknown'"));
check('Readiness maps snapshot source label', readiness.includes("dataSource === 'snapshot'") && readiness.includes('t.sourceSnapshot'));
check('strings define snapshot labels in both languages',
  (strings.match(/importSnapshot:/g) || []).length === 2 &&
  (strings.match(/exportSnapshot:/g) || []).length === 2 &&
  (strings.match(/sourceSnapshot:/g) || []).length === 2);
check('CSS styles snapshot source pill', css.includes('.source-pill.snapshot'));

section('c3-4: production helper runtime');
const snapshotModule = await import(`file://${snapshotPath}`);
const built = snapshotModule.buildAgingSnapshot(baseline, 'fallback', '2026-05-13T00:00:00.000Z');
const serialized = snapshotModule.serializeSnapshot(built);
const parsed = snapshotModule.parseSnapshotText(serialized);
const rawParsed = snapshotModule.parseSnapshotText(JSON.stringify(baseline));

check('buildAgingSnapshot preserves result payload', built.result.details.transactions.length === 1230);
check('snapshot summary pins transaction count 1230', built.summary.transactionCount === 1230);
check('snapshot summary pins statementLink count 439', built.summary.statementLinkCount === 439);
check('snapshot summary pins asOfDate 2026-05-01', built.summary.asOfDate === '2026-05-01');
check('serialized envelope parses back as snapshot-envelope', parsed.source === 'snapshot-envelope');
check('parsed envelope preserves transaction count', parsed.snapshot.result.details.transactions.length === 1230);
check('raw ParsingPreviewResult import is accepted', rawParsed.source === 'raw-parsing-preview-result');
check('raw ParsingPreviewResult import wraps as snapshot dataSource', rawParsed.snapshot.dataSource === 'snapshot');
check('snapshot filename is stable', snapshotModule.snapshotFilename(built).startsWith('aging-snapshot-2026-05-01-'));

section('c3-5: invalid snapshot rejection');
let rejectedBadJson = false;
let rejectedBadShape = false;
try {
  snapshotModule.parseSnapshotText('{not json');
} catch {
  rejectedBadJson = true;
}
try {
  snapshotModule.parseSnapshotText(JSON.stringify({ snapshotVersion: 'wrong', result: {} }));
} catch {
  rejectedBadShape = true;
}
check('invalid JSON is rejected', rejectedBadJson);
check('invalid snapshot shape is rejected', rejectedBadShape);

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) process.exit(1);
