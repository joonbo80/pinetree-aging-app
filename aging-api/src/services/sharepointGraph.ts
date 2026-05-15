export const SHAREPOINT_HOST = 'pinetreeexpress.sharepoint.com';
export const SHAREPOINT_SITE_COLLECTION_ID = '0b39ac5a-ed5c-40f7-bc40-60c30bd936b6';
export const SHAREPOINT_WEB_ID = '0fc32f15-b8b1-4c6e-9854-2eb04a096f04';
export const SHAREPOINT_SITE_ID = `${SHAREPOINT_HOST},${SHAREPOINT_SITE_COLLECTION_ID},${SHAREPOINT_WEB_ID}`;
export const SHAREPOINT_SITE_PATH = 'PinetreeExpressIntlfreightforwardingco-ACCOUNTING';
export const SNAPSHOT_FOLDER = 'AGING&STATEMENT APP';
export const WORKFLOW_LIST_NAME = 'PE Aging&Statement Workflow';

export interface GraphSite {
  id: string;
  webUrl?: string;
  displayName?: string;
}

export interface GraphDriveItem {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  lastModifiedDateTime?: string;
  file?: unknown;
}

export interface GraphList {
  id: string;
  displayName: string;
  webUrl?: string;
}

export interface GraphListItem {
  id: string;
  webUrl?: string;
  fields?: Record<string, unknown>;
}

export interface GraphColumn {
  id: string;
  name: string;
  displayName: string;
}

export function graphHeaders(token: string, contentType?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

export function graphPath(...segments: string[]) {
  return segments.map(segment => encodeURIComponent(segment)).join('/');
}

export async function graphJson<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...graphHeaders(token),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph request failed (${response.status}): ${body.slice(0, 360)}`);
  }

  return response.json() as Promise<T>;
}

export async function graphNoContent(url: string, token: string, init: RequestInit = {}): Promise<void> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...graphHeaders(token),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok && response.status !== 204) {
    const body = await response.text();
    throw new Error(`Graph request failed (${response.status}): ${body.slice(0, 360)}`);
  }
}

export async function graphProbe(url: string, token: string) {
  try {
    const response = await fetch(url, {
      headers: graphHeaders(token),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // Keep text body.
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: err instanceof Error ? err.message : 'fetch failed',
    };
  }
}

export async function lookupSharePointSite(token: string): Promise<GraphSite> {
  const url = `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_SITE_ID}`;
  return graphJson<GraphSite>(url, token);
}

export async function uploadSnapshotFile(token: string, filename: string, content: string): Promise<{
  site: GraphSite;
  file: GraphDriveItem;
}> {
  const site = await lookupSharePointSite(token);
  const uploadPath = graphPath(SNAPSHOT_FOLDER, filename);
  const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root:/${uploadPath}:/content`;
  const file = await graphJson<GraphDriveItem>(uploadUrl, token, {
    method: 'PUT',
    headers: graphHeaders(token, 'application/json'),
    body: content,
  });
  return { site, file };
}

export async function listSnapshotFiles(token: string): Promise<{
  site: GraphSite;
  files: GraphDriveItem[];
}> {
  const site = await lookupSharePointSite(token);
  const folderPath = graphPath(SNAPSHOT_FOLDER);
  const url = `https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root:/${folderPath}:/children?$select=id,name,size,webUrl,lastModifiedDateTime,file`;
  const body = await graphJson<{ value?: GraphDriveItem[] }>(url, token);
  const files = (body.value ?? [])
    .filter(item => item.file)
    .filter(item => item.name.startsWith('aging-snapshot-') && item.name.endsWith('.json'))
    .sort((a, b) => String(b.lastModifiedDateTime ?? '').localeCompare(String(a.lastModifiedDateTime ?? '')));
  return { site, files };
}

export async function downloadDriveItemText(token: string, siteId: string, itemId: string): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/items/${itemId}/content`;
  const response = await fetch(url, {
    headers: graphHeaders(token),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Graph request failed (${response.status}): ${body.slice(0, 360)}`);
  }

  return response.text();
}

export async function lookupWorkflowList(token: string): Promise<{
  site: GraphSite;
  list: GraphList;
}> {
  const site = await lookupSharePointSite(token);
  const url = `https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$select=id,displayName,webUrl`;
  const body = await graphJson<{ value?: GraphList[] }>(url, token);
  const list = (body.value ?? []).find(item => item.displayName === WORKFLOW_LIST_NAME);

  if (!list) {
    throw new Error(`SharePoint list not found: ${WORKFLOW_LIST_NAME}`);
  }

  return { site, list };
}

export async function listWorkflowColumns(
  token: string,
  siteId: string,
  listId: string,
): Promise<GraphColumn[]> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/columns?$select=id,name,displayName`;
  const body = await graphJson<{ value?: GraphColumn[] }>(url, token);
  return body.value ?? [];
}

export function workflowFieldNameMap(columns: GraphColumn[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const column of columns) {
    map[column.displayName] = column.name;
  }
  return map;
}

export async function createWorkflowItem(
  token: string,
  fields: Record<string, unknown>,
): Promise<{
  site: GraphSite;
  list: GraphList;
  item: GraphListItem;
}> {
  const { site, list } = await lookupWorkflowList(token);
  const url = `https://graph.microsoft.com/v1.0/sites/${site.id}/lists/${list.id}/items`;
  const item = await graphJson<GraphListItem>(url, token, {
    method: 'POST',
    headers: graphHeaders(token, 'application/json'),
    body: JSON.stringify({ fields }),
  });
  return { site, list, item };
}

export async function readWorkflowItem(
  token: string,
  siteId: string,
  listId: string,
  itemId: string,
): Promise<GraphListItem> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}?expand=fields`;
  return graphJson<GraphListItem>(url, token);
}

export async function updateWorkflowItemFields(
  token: string,
  siteId: string,
  listId: string,
  itemId: string,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/fields`;
  return graphJson<Record<string, unknown>>(url, token, {
    method: 'PATCH',
    headers: graphHeaders(token, 'application/json'),
    body: JSON.stringify(fields),
  });
}

export async function deleteWorkflowItem(
  token: string,
  siteId: string,
  listId: string,
  itemId: string,
): Promise<void> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}`;
  await graphNoContent(url, token, { method: 'DELETE' });
}
