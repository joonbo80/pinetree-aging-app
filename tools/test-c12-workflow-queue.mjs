import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
}

function text(path) {
  return readFileSync(join(root, path), 'utf8');
}

const specPath = 'docs/specs/v2.5-c12-workflow-queue-micro-spec.md';
const pagePath = 'aging-app/src/pages/WorkflowQueuePage.tsx';
const appPath = 'aging-app/src/App.tsx';
const dashboardPath = 'aging-app/src/components/dashboard/Dashboard.tsx';
const cssPath = 'aging-app/src/styles/v2.3-aging-report.css';

check('C12 spec exists', existsSync(join(root, specPath)));
check('WorkflowQueuePage exists', existsSync(join(root, pagePath)));

const spec = text(specPath);
const page = text(pagePath);
const app = text(appPath);
const dashboard = text(dashboardPath);
const css = text(cssPath);

check('spec marks C12 as Workflow Queue', spec.includes('C12 Workflow Queue'));
check('spec says read-only', spec.includes('read-only daily work queue'));
check('spec defers inline actions to C13', spec.includes('C13 Inline Actions'));
check('spec pins /workflow route', spec.includes('/workflow'));
check('spec preserves AR/AP separation', spec.includes('AR/AP separation') || spec.includes('AR and AP must not be netted'));
check('spec preserves USD/CAD separation', spec.includes('USD and CAD must not be merged'));

check('App imports WorkflowQueuePage', app.includes("import { WorkflowQueuePage }"));
check('App registers /workflow route', app.includes('path="/workflow"'));
check('Dashboard exposes onOpenWorkflow prop', dashboard.includes('onOpenWorkflow'));
check('Dashboard renders Open Workflow Queue', dashboard.includes('Open Workflow Queue'));

check('page imports selectAgingReport', page.includes('selectAgingReport'));
check('page reads SharePoint workflow items', page.includes('readWorkflowItems'));
check('page uses C5 auth token', page.includes('loadC5AuthSpikeAccessToken'));
check('page builds workflowKey with party/currency/direction', page.includes('${workspaceId}__${row.partyKey}__${row.currency}__${row.direction}'));
check('page computes dueBucket', page.includes('function dueBucket'));
check('page defaults owner filter to all', page.includes("searchParams.get('owner'), ['me', 'unassigned', 'all'] as const, 'all'"));
check('page keeps read-only action as Open Party', page.includes('Open Party'));
check('page has stale cache indicator', page.includes('Stale cache'));
check('page has no workflow write call', !page.includes('writeWorkflowItem'));

check('CSS defines workflow queue page', css.includes('.workflow-queue-page'));
check('CSS defines workflow filter panel', css.includes('.workflow-filter-panel'));
check('CSS defines workflow queue table', css.includes('.workflow-queue-table'));
check('CSS defines stale source pill', css.includes('.workflow-source-pill.stale'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
}

console.log(`\nC12 workflow queue checks: PASS ${checks.length - failed.length} / FAIL ${failed.length}`);

if (failed.length > 0) {
  process.exitCode = 1;
}
