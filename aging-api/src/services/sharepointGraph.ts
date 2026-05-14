export const SHAREPOINT_HOST = 'pinetreeexpress.sharepoint.com';
export const SHAREPOINT_SITE_COLLECTION_ID = '0b39ac5a-ed5c-40f7-bc40-60c30bd936b6';
export const SHAREPOINT_WEB_ID = '0fc32f15-b8b1-4c6e-9854-2eb04a096f04';
export const SHAREPOINT_SITE_ID = `${SHAREPOINT_HOST},${SHAREPOINT_SITE_COLLECTION_ID},${SHAREPOINT_WEB_ID}`;
export const SHAREPOINT_SITE_PATH = 'PinetreeExpressIntlfreightforwardingco-ACCOUNTING';
export const SNAPSHOT_FOLDER = 'AGING&STATEMENT APP';

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
