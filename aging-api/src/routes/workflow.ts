import { Router } from 'express';
import { bearerToken, validateGraphDelegatedToken } from '../auth/entra.js';
import {
  createWorkflowItem,
  listWorkflowColumns,
  listWorkflowItems,
  lookupWorkflowList,
  readWorkflowItem,
  updateWorkflowItemFields,
  workflowFieldNameMap,
  WORKFLOW_LIST_NAME,
} from '../services/sharepointGraph.js';

export const workflowRouter = Router();

interface WorkflowItemBody {
  workspaceId?: unknown;
  workflowKey?: unknown;
  partyKey?: unknown;
  partyName?: unknown;
  currency?: unknown;
  direction?: unknown;
  ownerDisplayName?: unknown;
  memoText?: unknown;
  promiseDate?: unknown;
  promiseAmount?: unknown;
  promiseStatus?: unknown;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function workflowContext(token: string) {
  const target = await lookupWorkflowList(token);
  const columns = await listWorkflowColumns(token, target.site.id, target.list.id);
  const fieldNames = workflowFieldNameMap(columns);
  const field = (displayName: string) => {
    const name = fieldNames[displayName];
    if (!name) throw new Error(`Workflow list column not found: ${displayName}`);
    return name;
  };
  return { ...target, field };
}

async function findWorkflowItem(
  token: string,
  siteId: string,
  listId: string,
  workflowFieldName: string,
  workflowKey: string,
) {
  const items = await listWorkflowItems(token, siteId, listId);
  return items.find(item => item.fields?.[workflowFieldName] === workflowKey) ?? null;
}

workflowRouter.get('/item', async (req, res) => {
  try {
    await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const workflowKey = requiredString(req.query.workflowKey, 'workflowKey');
    const { site, list, field } = await workflowContext(token);
    const item = await findWorkflowItem(token, site.id, list.id, field('workflowKey'), workflowKey);

    res.json({
      status: 'ok',
      source: 'sharepoint-workflow-item-read',
      list: {
        id: list.id,
        displayName: list.displayName,
        webUrl: list.webUrl ?? null,
      },
      found: Boolean(item),
      item: item ? {
        id: item.id,
        webUrl: item.webUrl ?? null,
        fields: {
          workspaceId: item.fields?.[field('workspaceId')] ?? null,
          workflowKey: item.fields?.[field('workflowKey')] ?? null,
          partyKey: item.fields?.[field('partyKey')] ?? null,
          partyName: item.fields?.[field('partyName')] ?? null,
          currency: item.fields?.[field('currency')] ?? null,
          direction: item.fields?.[field('direction')] ?? null,
          ownerDisplayName: item.fields?.[field('ownerDisplayName')] ?? '',
          memoText: item.fields?.[field('memoText')] ?? '',
          promiseDate: item.fields?.[field('promiseDate')] ?? '',
          promiseAmount: item.fields?.[field('promiseAmount')] ?? null,
          promiseStatus: item.fields?.[field('promiseStatus')] ?? '',
        },
      } : null,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 'WORKFLOW_ITEM_READ_FAILED',
      error: err instanceof Error ? err.message : 'Workflow item read failed.',
    });
  }
});

workflowRouter.get('/items', async (req, res) => {
  try {
    await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const workspaceId = requiredString(req.query.workspaceId, 'workspaceId');
    const { site, list, field } = await workflowContext(token);
    const workflowField = field('workflowKey');
    const workspaceField = field('workspaceId');
    const items = await listWorkflowItems(token, site.id, list.id);
    const matchingItems = items
      .filter((item) => {
        const itemWorkspaceId = item.fields?.[workspaceField];
        const itemWorkflowKey = item.fields?.[workflowField];
        return itemWorkspaceId === workspaceId ||
          (typeof itemWorkflowKey === 'string' && itemWorkflowKey.startsWith(`${workspaceId}__`));
      })
      .map((item) => ({
        id: item.id,
        webUrl: item.webUrl ?? null,
        fields: {
          workspaceId: item.fields?.[workspaceField] ?? null,
          workflowKey: item.fields?.[workflowField] ?? null,
          partyKey: item.fields?.[field('partyKey')] ?? null,
          partyName: item.fields?.[field('partyName')] ?? null,
          currency: item.fields?.[field('currency')] ?? null,
          direction: item.fields?.[field('direction')] ?? null,
          ownerDisplayName: item.fields?.[field('ownerDisplayName')] ?? '',
          memoText: item.fields?.[field('memoText')] ?? '',
          promiseDate: item.fields?.[field('promiseDate')] ?? '',
          promiseAmount: item.fields?.[field('promiseAmount')] ?? null,
          promiseStatus: item.fields?.[field('promiseStatus')] ?? '',
        },
      }));

    res.json({
      status: 'ok',
      source: 'sharepoint-workflow-items-read',
      list: {
        id: list.id,
        displayName: list.displayName,
        webUrl: list.webUrl ?? null,
      },
      workspaceId,
      count: matchingItems.length,
      items: matchingItems,
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 'WORKFLOW_ITEMS_READ_FAILED',
      error: err instanceof Error ? err.message : 'Workflow items read failed.',
    });
  }
});

workflowRouter.post('/item', async (req, res) => {
  try {
    const principal = await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const body = req.body as WorkflowItemBody;
    const workspaceId = requiredString(body.workspaceId, 'workspaceId');
    const workflowKey = requiredString(body.workflowKey, 'workflowKey');
    const partyKey = requiredString(body.partyKey, 'partyKey');
    const partyName = requiredString(body.partyName, 'partyName');
    const currency = requiredString(body.currency, 'currency');
    const direction = requiredString(body.direction, 'direction');
    const ownerDisplayName = optionalString(body.ownerDisplayName);
    const memoText = optionalString(body.memoText);
    const promiseDate = optionalString(body.promiseDate);
    const promiseAmount = optionalNumber(body.promiseAmount);
    const promiseStatus = optionalString(body.promiseStatus);
    const { site, list, field } = await workflowContext(token);
    const existing = await findWorkflowItem(token, site.id, list.id, field('workflowKey'), workflowKey);

    const fields = {
      Title: partyName,
      [field('workspaceId')]: workspaceId,
      [field('workflowKey')]: workflowKey,
      [field('partyKey')]: partyKey,
      [field('partyName')]: partyName,
      [field('currency')]: currency,
      [field('direction')]: direction,
      [field('ownerDisplayName')]: ownerDisplayName || principal.graphDisplayName || principal.name || '',
      [field('memoText')]: memoText,
      [field('promiseDate')]: promiseDate || null,
      [field('promiseAmount')]: promiseAmount,
      [field('promiseStatus')]: promiseStatus,
    };

    const item = existing
      ? await updateWorkflowItemFields(token, site.id, list.id, existing.id, fields).then(() =>
          readWorkflowItem(token, site.id, list.id, existing.id),
        )
      : (await createWorkflowItem(token, fields)).item;

    const hydrated = item.fields ? item : await readWorkflowItem(token, site.id, list.id, item.id);

    res.json({
      status: 'ok',
      source: existing ? 'sharepoint-workflow-item-update' : 'sharepoint-workflow-item-create',
      list: {
        id: list.id,
        displayName: list.displayName,
        webUrl: list.webUrl ?? null,
      },
      item: {
        id: hydrated.id,
        webUrl: hydrated.webUrl ?? null,
        fields: {
          workspaceId: hydrated.fields?.[field('workspaceId')] ?? workspaceId,
          workflowKey: hydrated.fields?.[field('workflowKey')] ?? workflowKey,
          ownerDisplayName: hydrated.fields?.[field('ownerDisplayName')] ?? ownerDisplayName,
          memoText: hydrated.fields?.[field('memoText')] ?? memoText,
          promiseDate: hydrated.fields?.[field('promiseDate')] ?? promiseDate,
          promiseAmount: hydrated.fields?.[field('promiseAmount')] ?? promiseAmount,
          promiseStatus: hydrated.fields?.[field('promiseStatus')] ?? promiseStatus,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 'WORKFLOW_ITEM_WRITE_FAILED',
      error: err instanceof Error ? err.message : 'Workflow item write failed.',
    });
  }
});
