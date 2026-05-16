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

const specPath = 'docs/specs/v2.5-c13-inline-actions-lite-micro-spec.md';
const pagePath = 'aging-app/src/pages/WorkflowQueuePage.tsx';
const apiPath = 'aging-app/src/api/client.ts';
const cssPath = 'aging-app/src/styles/v2.3-aging-report.css';

check('C13 spec exists', existsSync(join(root, specPath)));
check('WorkflowQueuePage exists', existsSync(join(root, pagePath)));

const spec = text(specPath);
const page = text(pagePath);
const api = text(apiPath);
const css = text(cssPath);

check('spec marks C13 as Inline Actions Lite', spec.includes('C13 Inline Actions Lite'));
check('spec pins minimum scope', spec.includes('Quick memo save + promise status update'));
check('spec excludes bulk update', spec.includes('bulk update'));
check('spec excludes automatic email sending', spec.includes('automatic email sending'));
check('spec keeps C13 scoped to workflowKey', spec.includes('workspaceId + partyKey + currency + direction'));
check('spec preserves USD/CAD separation', spec.includes('USD and CAD remain separated'));
check('spec preserves AR/AP separation', spec.includes('AR and AP are never netted'));

check('api client exposes writeWorkflowItem', api.includes('async writeWorkflowItem'));
check('page keeps C12 /workflow queue', page.includes('Daily Collector Queue'));
check('page adds expandedKey state', page.includes('expandedKey'));
check('page adds draft state', page.includes('setDrafts'));
check('page adds action status state', page.includes('actionStatus'));
check('page renders Actions button', page.includes('Actions'));
check('page renders Inline Actions Lite panel', page.includes('Inline Actions Lite'));
check('page renders Quick memo textarea', page.includes('Quick memo'));
check('page renders Promise status select', page.includes('Promise status'));
check('page offers allowed promise statuses', ['None', 'Open', 'FollowUp', 'Kept', 'Broken', 'Settled'].every((value) => page.includes(value)));
check('page writes through apiClient.writeWorkflowItem', page.includes('apiClient.writeWorkflowItem'));
check('page writes same workflowKey', page.includes('workflowKey: row.workflowKey'));
check('page preserves party/currency/direction payload', page.includes('currency: row.party.currency') && page.includes('direction: row.party.direction'));
check('page uses C5 auth token for write', page.includes('if (!token)'));
check('page shows SharePoint save success', page.includes('Saved to SharePoint.'));
check('page keeps typed text on error', page.includes('setActionStatus') && page.includes('Workflow update failed.'));
check('page does not add bulk update', !page.toLowerCase().includes('bulk update'));
check('page does not send email automatically', !page.includes('Mail.Send'));
check('C12 owner default remains all', page.includes("searchParams.get('owner'), ['me', 'unassigned', 'all'] as const, 'all'"));
check('CSS has inline panel class', css.includes('.workflow-inline-panel'));
check('CSS has inline error class', css.includes('.workflow-inline-error'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
}

console.log(`\nC13 inline actions checks: PASS ${checks.length - failed.length} / FAIL ${failed.length}`);

if (failed.length > 0) {
  process.exitCode = 1;
}
