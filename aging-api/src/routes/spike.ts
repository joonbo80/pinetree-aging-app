import { Router } from 'express';
import { bearerToken, validateGraphDelegatedToken } from '../auth/entra.js';
import {
  createWorkflowItem,
  deleteWorkflowItem,
  graphHeaders,
  graphJson,
  graphNoContent,
  graphPath,
  graphProbe,
  GraphDriveItem,
  GraphSite,
  lookupSharePointSite,
  listWorkflowColumns,
  lookupWorkflowList,
  readWorkflowItem,
  SHAREPOINT_HOST,
  SHAREPOINT_SITE_ID,
  SHAREPOINT_SITE_PATH,
  SNAPSHOT_FOLDER,
  updateWorkflowItemFields,
  uploadSnapshotFile,
  workflowFieldNameMap,
  WORKFLOW_LIST_NAME,
} from '../services/sharepointGraph.js';

export const spikeRouter = Router();

spikeRouter.get('/whoami', async (req, res) => {
  try {
    const principal = await validateGraphDelegatedToken(req);
    res.json({
      status: 'ok',
      source: 'entra-graph-delegated-token',
      principal: {
        displayName: principal.name ?? principal.graphDisplayName ?? null,
        username: principal.preferred_username ?? principal.graphUsername ?? null,
        objectId: principal.oid ?? null,
        tenantId: principal.tid ?? null,
        audience: principal.aud,
        scopes: principal.scp ?? '',
      },
    });
  } catch (err) {
    res.status(401).json({
      status: 'error',
      code: 'ENTRA_TOKEN_INVALID',
      error: err instanceof Error ? err.message : 'Token validation failed.',
    });
  }
});

spikeRouter.post('/sharepoint-roundtrip', async (req, res) => {
  let uploaded: GraphDriveItem | null = null;
  let site: GraphSite | null = null;
  let cleanupStatus: 'not-started' | 'deleted' | 'failed' = 'not-started';

  try {
    const principal = await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    site = await lookupSharePointSite(token);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `c5-auth-spike-test-${timestamp}.json`;
    const payload = JSON.stringify({
      purpose: 'c5_entra_auth_spike',
      createdAt: new Date().toISOString(),
      createdBy: principal.graphUsername ?? principal.preferred_username ?? principal.oid ?? 'unknown',
      expectedAction: 'upload_then_delete',
    }, null, 2);

    uploaded = (await uploadSnapshotFile(token, filename, payload)).file;

    const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/items/${uploaded.id}`;
    await graphNoContent(deleteUrl, token, { method: 'DELETE' });
    cleanupStatus = 'deleted';

    res.json({
      status: 'ok',
      source: 'microsoft-graph-sharepoint-roundtrip',
      site: {
        id: site.id,
        displayName: site.displayName ?? null,
        webUrl: site.webUrl ?? null,
      },
      folder: SNAPSHOT_FOLDER,
      file: {
        name: uploaded.name,
        id: uploaded.id,
        size: uploaded.size ?? null,
        webUrl: uploaded.webUrl ?? null,
      },
      cleanupStatus,
    });
  } catch (err) {
    if (uploaded && site && cleanupStatus !== 'deleted') {
      try {
        const token = bearerToken(req);
        const deleteUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/items/${uploaded.id}`;
        await graphNoContent(deleteUrl, token, { method: 'DELETE' });
        cleanupStatus = 'deleted';
      } catch {
        cleanupStatus = 'failed';
      }
    }

    res.status(500).json({
      status: 'error',
      code: 'SHAREPOINT_ROUNDTRIP_FAILED',
      cleanupStatus,
      error: err instanceof Error ? err.message : 'SharePoint round-trip failed.',
    });
  }
});

spikeRouter.post('/workflow-roundtrip', async (req, res) => {
  let siteId: string | null = null;
  let listId: string | null = null;
  let itemId: string | null = null;
  let cleanupStatus: 'not-started' | 'deleted' | 'failed' = 'not-started';

  try {
    const principal = await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const workflowTarget = await lookupWorkflowList(token);
    siteId = workflowTarget.site.id;
    listId = workflowTarget.list.id;
    const columns = await listWorkflowColumns(token, siteId, listId);
    const fieldNames = workflowFieldNameMap(columns);
    const field = (displayName: string) => {
      const name = fieldNames[displayName];
      if (!name) {
        throw new Error(`Workflow list column not found: ${displayName}`);
      }
      return name;
    };

    const timestamp = new Date().toISOString();
    const workspaceId = `c8-workflow-smoke-${timestamp.slice(0, 10)}`;
    const workflowKey = `${workspaceId}__lemond-food-corp-new-addr__CAD__receivable`;

    const fields = {
      Title: 'C8 WORKFLOW ROUNDTRIP TEST',
      [field('workspaceId')]: workspaceId,
      [field('workflowKey')]: workflowKey,
      [field('partyKey')]: 'lemond-food-corp-new-addr',
      [field('partyName')]: 'LEMOND FOOD CORP NEW ADDR',
      [field('currency')]: 'CAD',
      [field('direction')]: 'Receivable',
      [field('ownerDisplayName')]: principal.graphDisplayName ?? principal.name ?? 'JOONBO YOO',
      [field('memoText')]: `C8 create proof ${timestamp}`,
      [field('promiseDate')]: '2026-05-20',
      [field('promiseAmount')]: 123.45,
      [field('promiseStatus')]: 'Open',
    };

    const created = await createWorkflowItem(token, fields);
    itemId = created.item.id;

    const readAfterCreate = await readWorkflowItem(token, siteId, listId, itemId);
    const updatedFields = await updateWorkflowItemFields(token, siteId, listId, itemId, {
      [field('memoText')]: `C8 update proof ${timestamp}`,
      [field('promiseStatus')]: 'FollowUp',
    });
    const readAfterUpdate = await readWorkflowItem(token, siteId, listId, itemId);

    await deleteWorkflowItem(token, siteId, listId, itemId);
    cleanupStatus = 'deleted';

    res.json({
      status: 'ok',
      source: 'microsoft-graph-workflow-list-roundtrip',
      site: {
        id: created.site.id,
        displayName: created.site.displayName ?? null,
        webUrl: created.site.webUrl ?? null,
      },
      list: {
        id: created.list.id,
        displayName: created.list.displayName,
        webUrl: created.list.webUrl ?? null,
      },
      item: {
        id: created.item.id,
        webUrl: created.item.webUrl ?? null,
      },
      fields: {
        createdTitle: readAfterCreate.fields?.Title ?? null,
        createdWorkflowKey: readAfterCreate.fields?.[field('workflowKey')] ?? null,
        updatedMemoText: readAfterUpdate.fields?.[field('memoText')] ?? updatedFields[field('memoText')] ?? null,
        updatedPromiseStatus: readAfterUpdate.fields?.[field('promiseStatus')] ?? updatedFields[field('promiseStatus')] ?? null,
        internalDirectionField: field('direction'),
      },
      cleanupStatus,
    });
  } catch (err) {
    if (siteId && listId && itemId && cleanupStatus !== 'deleted') {
      try {
        const token = bearerToken(req);
        await deleteWorkflowItem(token, siteId, listId, itemId);
        cleanupStatus = 'deleted';
      } catch {
        cleanupStatus = 'failed';
      }
    }

    res.status(500).json({
      status: 'error',
      code: 'WORKFLOW_ROUNDTRIP_FAILED',
      list: WORKFLOW_LIST_NAME,
      cleanupStatus,
      error: err instanceof Error ? err.message : 'Workflow list round-trip failed.',
    });
  }
});

spikeRouter.get('/sharepoint-diagnostics', async (req, res) => {
  try {
    await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const exactSiteUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:/sites/${SHAREPOINT_SITE_PATH}:`;
    const directSiteIdUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}`;
    const directDriveUrl = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}/drive`;
    const searchUrl = 'https://graph.microsoft.com/v1.0/sites?search=ACCOUNTING';

    res.json({
      status: 'ok',
      configuredSiteId: SHAREPOINT_SITE_ID,
      probes: {
        me: await graphProbe('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName', token),
        rootSite: await graphProbe(`https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}`, token),
        accountingSearch: await graphProbe(searchUrl, token),
        exactAccountingSite: await graphProbe(exactSiteUrl, token),
        directAccountingSiteId: await graphProbe(directSiteIdUrl, token),
        directAccountingDrive: await graphProbe(directDriveUrl, token),
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 'SHAREPOINT_DIAGNOSTICS_FAILED',
      error: err instanceof Error ? err.message : 'SharePoint diagnostics failed.',
    });
  }
});
