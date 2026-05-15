import { useEffect, useMemo, useState } from 'react';
import { apiClient, type ServerSnapshotReadResult, type ServerSnapshotUploadResult } from '../api/client';
import {
  loadSnapshotFromStorage,
  parseSnapshotText,
  saveSnapshotToStorage,
  snapshotFilename,
} from '../utils/snapshot';

const TENANT_ID = '16cca7b3-b733-44b6-a4a2-ad043eef5261';
const CLIENT_ID = '903b01b4-6742-4378-830c-fef9f057517b';
const REDIRECT_PATH = '/spike/auth';
const AUTH_STATE_KEY = 'agingApp.c5AuthSpike.state';
const AUTH_VERIFIER_KEY = 'agingApp.c5AuthSpike.codeVerifier';
const TOKEN_KEY = 'agingApp.c5AuthSpike.token';

const SCOPES = [
  'openid',
  'profile',
  'User.Read',
  'Sites.ReadWrite.All',
];

interface TokenPayload {
  aud?: string;
  exp?: number;
  iat?: number;
  name?: string;
  preferred_username?: string;
  oid?: string;
  tid?: string;
  scp?: string;
  iss?: string;
}

interface StoredToken {
  accessToken: string;
  idToken?: string;
  expiresAt: number;
  idPayload?: TokenPayload;
  accessPayload?: TokenPayload;
}

interface WhoamiResult {
  status: 'ok';
  source: string;
  principal: {
    displayName: string | null;
    username: string | null;
    objectId: string | null;
    tenantId: string | null;
    audience: string;
    scopes: string;
  };
}

interface SharePointRoundTripResult {
  status: 'ok';
  source: string;
  site: {
    id: string;
    displayName: string | null;
    webUrl: string | null;
  };
  folder: string;
  file: {
    name: string;
    id: string;
    size: number | null;
    webUrl: string | null;
  };
  cleanupStatus: 'not-started' | 'deleted' | 'failed';
}

interface SharePointDiagnosticsResult {
  status: 'ok';
  probes: Record<string, {
    ok: boolean;
    status: number;
    body: unknown;
  }>;
}

interface WorkflowRoundTripResult {
  status: 'ok';
  source: string;
  site: {
    id: string;
    displayName: string | null;
    webUrl: string | null;
  };
  list: {
    id: string;
    displayName: string;
    webUrl: string | null;
  };
  item: {
    id: string;
    webUrl: string | null;
  };
  fields: {
    createdTitle: unknown;
    createdWorkflowKey: unknown;
    updatedMemoText: unknown;
    updatedPromiseStatus: unknown;
  };
  cleanupStatus: 'not-started' | 'deleted' | 'failed';
}

function authEndpoint() {
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`;
}

function tokenEndpoint() {
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
}

function redirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`;
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Base64Url(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}

function decodeJwt(token: string): TokenPayload {
  const [, payload] = token.split('.');
  if (!payload) return {};
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const json = decodeURIComponent(
    atob(padded)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  );
  return JSON.parse(json) as TokenPayload;
}

function loadStoredToken(): StoredToken | null {
  const raw = sessionStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

async function exchangeCode(code: string) {
  const verifier = sessionStorage.getItem(AUTH_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('Missing PKCE verifier. Start sign-in again.');
  }

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
    scope: SCOPES.join(' '),
  });

  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await response.json() as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token exchange failed (${response.status})`);
  }

  const stored: StoredToken = {
    accessToken: data.access_token,
    idToken: data.id_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    idPayload: data.id_token ? decodeJwt(data.id_token) : undefined,
    accessPayload: decodeJwt(data.access_token),
  };

  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  sessionStorage.removeItem(AUTH_STATE_KEY);
  sessionStorage.removeItem(AUTH_VERIFIER_KEY);
  return stored;
}

export function AuthSpikePage() {
  const [token, setToken] = useState<StoredToken | null>(() => loadStoredToken());
  const [busy, setBusy] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [sharePointBusy, setSharePointBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [snapshotUploadBusy, setSnapshotUploadBusy] = useState(false);
  const [snapshotRestoreBusy, setSnapshotRestoreBusy] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [whoamiAttempted, setWhoamiAttempted] = useState(false);
  const [status, setStatus] = useState('C5 auth spike route mounted.');
  const [error, setError] = useState<string | null>(null);
  const [whoami, setWhoami] = useState<WhoamiResult | null>(null);
  const [roundTrip, setRoundTrip] = useState<SharePointRoundTripResult | null>(null);
  const [workflowRoundTrip, setWorkflowRoundTrip] = useState<WorkflowRoundTripResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<SharePointDiagnosticsResult | null>(null);
  const [snapshotUpload, setSnapshotUpload] = useState<ServerSnapshotUploadResult | null>(null);
  const [snapshotRestore, setSnapshotRestore] = useState<{
    result: ServerSnapshotReadResult;
    saved: boolean;
    transactionCount: number;
    asOfDate: string;
  } | null>(null);

  const search = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const code = search.get('code');
    const returnedState = search.get('state');
    const authError = search.get('error_description') || search.get('error');
    if (authError) {
      setError(authError);
      setStatus('Microsoft sign-in returned an error.');
      return;
    }
    if (!code) return;

    const expectedState = sessionStorage.getItem(AUTH_STATE_KEY);
    if (!expectedState || expectedState !== returnedState) {
      setError('State mismatch. Start sign-in again.');
      setStatus('Microsoft sign-in callback could not be trusted.');
      return;
    }

    setBusy(true);
    setStatus('Completing Microsoft sign-in...');
    exchangeCode(code)
      .then((stored) => {
        setToken(stored);
        setStatus('Microsoft sign-in completed.');
        window.history.replaceState({}, document.title, REDIRECT_PATH);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Token exchange failed.');
        setStatus('Microsoft sign-in could not complete.');
      })
      .finally(() => setBusy(false));
  }, [search]);

  const startSignIn = async () => {
    setBusy(true);
    setError(null);
    setStatus('Opening Microsoft sign-in...');
    const state = randomBase64Url(24);
    const verifier = randomBase64Url(64);
    const challenge = await sha256Base64Url(verifier);
    sessionStorage.setItem(AUTH_STATE_KEY, state);
    sessionStorage.setItem(AUTH_VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri(),
      response_mode: 'query',
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });

    window.location.assign(`${authEndpoint()}?${params.toString()}`);
  };

  const signOut = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setWhoami(null);
    setRoundTrip(null);
    setWorkflowRoundTrip(null);
    setDiagnostics(null);
    setSnapshotUpload(null);
    setSnapshotRestore(null);
    setWhoamiAttempted(false);
    setError(null);
    setStatus('Signed out locally.');
  };

  const uploadC3Snapshot = async () => {
    if (!token) return;
    setSnapshotUploadBusy(true);
    setError(null);
    setSnapshotUpload(null);
    setStatus('Uploading C3 snapshot envelope to SharePoint...');
    try {
      const snapshot = loadSnapshotFromStorage();
      if (!snapshot) {
        throw new Error('No browser-local C3 snapshot found. Load baseline or files, then Confirm Import first.');
      }
      const uploaded = await apiClient.uploadSnapshotToServer(
        snapshot,
        snapshotFilename(snapshot),
        token.accessToken,
      );
      setSnapshotUpload(uploaded);
      setStatus('C3 snapshot uploaded to SharePoint.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server snapshot upload failed.');
      setStatus('Server snapshot upload failed.');
    } finally {
      setSnapshotUploadBusy(false);
    }
  };

  const restoreLatestServerSnapshot = async () => {
    if (!token) return;
    setSnapshotRestoreBusy(true);
    setError(null);
    setSnapshotRestore(null);
    setStatus('Restoring latest server snapshot from SharePoint...');
    try {
      const result = await apiClient.restoreLatestServerSnapshot(token.accessToken);
      const parsed = parseSnapshotText(JSON.stringify(result.snapshot));
      const saved = saveSnapshotToStorage(parsed.snapshot);
      setSnapshotRestore({
        result,
        saved,
        transactionCount: parsed.snapshot.summary.transactionCount,
        asOfDate: parsed.snapshot.summary.asOfDate,
      });
      setStatus(saved
        ? 'Latest server snapshot restored to browser storage.'
        : 'Latest server snapshot downloaded, but browser storage could not be updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Latest server snapshot restore failed.');
      setStatus('Latest server snapshot restore failed.');
    } finally {
      setSnapshotRestoreBusy(false);
    }
  };

  const callSharePointDiagnostics = async () => {
    if (!token) return;
    setDiagnosticsBusy(true);
    setError(null);
    setDiagnostics(null);
    setStatus('Calling SharePoint diagnostics...');
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25_000);
      const response = await fetch(`${apiClient.baseURL()}/api/spike/sharepoint-diagnostics`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const body = await response.json() as SharePointDiagnosticsResult | { error?: string; code?: string };
      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : `diagnostics failed (${response.status})`);
      }
      setDiagnostics(body as SharePointDiagnosticsResult);
      setStatus('SharePoint diagnostics completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SharePoint diagnostics failed.');
      setStatus('SharePoint diagnostics failed.');
    } finally {
      setDiagnosticsBusy(false);
    }
  };

  const callSharePointRoundTrip = async () => {
    if (!token) return;
    setSharePointBusy(true);
    setError(null);
    setRoundTrip(null);
    setStatus('Calling SharePoint upload/delete round-trip...');
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25_000);
      const response = await fetch(`${apiClient.baseURL()}/api/spike/sharepoint-roundtrip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const body = await response.json() as SharePointRoundTripResult | { error?: string; code?: string; cleanupStatus?: string };
      if (!response.ok) {
        const cleanup = 'cleanupStatus' in body && body.cleanupStatus ? ` Cleanup: ${body.cleanupStatus}.` : '';
        throw new Error(`${'error' in body && body.error ? body.error : `round-trip failed (${response.status})`}${cleanup}`);
      }
      setRoundTrip(body as SharePointRoundTripResult);
      setStatus('SharePoint upload/delete round-trip completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SharePoint round-trip failed.');
      setStatus('SharePoint round-trip failed.');
    } finally {
      setSharePointBusy(false);
    }
  };

  const callWorkflowRoundTrip = async () => {
    if (!token) return;
    setWorkflowBusy(true);
    setError(null);
    setWorkflowRoundTrip(null);
    setStatus('Calling workflow metadata list round-trip...');
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 25_000);
      const response = await fetch(`${apiClient.baseURL()}/api/spike/workflow-roundtrip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const body = await response.json() as WorkflowRoundTripResult | { error?: string; code?: string; cleanupStatus?: string };
      if (!response.ok) {
        const cleanup = 'cleanupStatus' in body && body.cleanupStatus ? ` Cleanup: ${body.cleanupStatus}.` : '';
        throw new Error(`${'error' in body && body.error ? body.error : `workflow round-trip failed (${response.status})`}${cleanup}`);
      }
      setWorkflowRoundTrip(body as WorkflowRoundTripResult);
      setStatus('Workflow metadata list round-trip completed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow metadata list round-trip failed.');
      setStatus('Workflow metadata list round-trip failed.');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const callWhoami = async () => {
    if (!token) return;
    setApiBusy(true);
    setWhoamiAttempted(true);
    setError(null);
    setWhoami(null);
    setStatus('Calling aging-api token validation route...');
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12_000);
      const response = await fetch(`${apiClient.baseURL()}/api/spike/whoami`, {
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
        },
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      const body = await response.json() as WhoamiResult | { error?: string; code?: string };
      if (!response.ok) {
        throw new Error('error' in body && body.error ? body.error : `whoami failed (${response.status})`);
      }
      setWhoami(body as WhoamiResult);
      setStatus('aging-api validated the delegated Microsoft Graph token.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'whoami request failed.');
      setStatus('aging-api token validation failed.');
    } finally {
      setApiBusy(false);
    }
  };

  const identity = token?.idPayload ?? token?.accessPayload;
  const expiresAt = token ? new Date(token.expiresAt).toLocaleString() : null;

  useEffect(() => {
    if (!token || whoami || apiBusy || whoamiAttempted) return;
    void callWhoami();
    // callWhoami is intentionally excluded because it closes over UI state.
    // This spike route auto-validates once per signed-in token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, whoami, apiBusy, whoamiAttempted]);

  return (
    <main className="app-content auth-spike-page">
      <section className="panel auth-spike-panel">
        <div className="panel-header">
          <div>
            <div className="panel-title">C5 Entra Auth Spike</div>
            <div className="panel-subtitle">Microsoft Entra delegated sign-in proof for Phase 3.</div>
          </div>
          <span className={`badge ${token ? 'pass' : 'warn'}`}>
            {token ? 'SIGNED IN' : 'SPIKE'}
          </span>
        </div>

        <div className="panel-body auth-spike-body">
          <div className="auth-spike-actions">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={startSignIn}>
              {token ? 'Sign in again' : 'Sign in with Microsoft'}
            </button>
            <button type="button" className="btn" disabled={busy || !token} onClick={signOut}>
              Clear local token
            </button>
            <button type="button" className="btn" disabled={apiBusy || !token} onClick={callWhoami}>
              Call API whoami
            </button>
            <button type="button" className="btn" disabled={sharePointBusy || !token} onClick={callSharePointRoundTrip}>
              Call SharePoint round-trip
            </button>
            <button type="button" className="btn" disabled={workflowBusy || !token} onClick={callWorkflowRoundTrip}>
              Call Workflow list round-trip
            </button>
            <button type="button" className="btn" disabled={diagnosticsBusy || !token} onClick={callSharePointDiagnostics}>
              Diagnose SharePoint
            </button>
            <button type="button" className="btn" disabled={snapshotUploadBusy || !token} onClick={uploadC3Snapshot}>
              Upload C3 snapshot
            </button>
            <button type="button" className="btn" disabled={snapshotRestoreBusy || !token} onClick={restoreLatestServerSnapshot}>
              Restore latest server snapshot
            </button>
          </div>

          <div className="notice auth-spike-status">
            {status}
          </div>

          {error && (
            <div className="notice fail auth-spike-status">
              {error}
            </div>
          )}

          <div className="auth-spike-grid">
            <div>
              <span>Tenant ID</span>
              <code>{TENANT_ID}</code>
            </div>
            <div>
              <span>Client ID</span>
              <code>{CLIENT_ID}</code>
            </div>
            <div>
              <span>Redirect URI</span>
              <code>{redirectUri()}</code>
            </div>
            <div>
              <span>Scopes</span>
              <code>{SCOPES.join(' ')}</code>
            </div>
          </div>

          {token && (
            <div className="auth-spike-result">
              <h2>Signed-in user</h2>
              <dl>
                <div>
                  <dt>Display name</dt>
                  <dd>{identity?.name || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Email / username</dt>
                  <dd>{identity?.preferred_username || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Object ID</dt>
                  <dd>{identity?.oid || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Tenant ID</dt>
                  <dd>{identity?.tid || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Granted scopes</dt>
                  <dd>{token.accessPayload?.scp || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Access token issuer</dt>
                  <dd>{token.accessPayload?.iss || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Access token audience</dt>
                  <dd>{token.accessPayload?.aud || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{expiresAt}</dd>
                </div>
              </dl>
            </div>
          )}

          {whoami && (
            <div className="auth-spike-result">
              <h2>API token validation</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{whoami.status}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{whoami.source}</dd>
                </div>
                <div>
                  <dt>Display name</dt>
                  <dd>{whoami.principal.displayName || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Username</dt>
                  <dd>{whoami.principal.username || '(not provided)'}</dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>{whoami.principal.audience}</dd>
                </div>
                <div>
                  <dt>Scopes</dt>
                  <dd>{whoami.principal.scopes}</dd>
                </div>
              </dl>
            </div>
          )}

          {roundTrip && (
            <div className="auth-spike-result">
              <h2>SharePoint round-trip</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{roundTrip.status}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{roundTrip.source}</dd>
                </div>
                <div>
                  <dt>Folder</dt>
                  <dd>{roundTrip.folder}</dd>
                </div>
                <div>
                  <dt>Cleanup</dt>
                  <dd>{roundTrip.cleanupStatus}</dd>
                </div>
                <div>
                  <dt>Test file</dt>
                  <dd>{roundTrip.file.name}</dd>
                </div>
                <div>
                  <dt>Site</dt>
                  <dd>{roundTrip.site.displayName || roundTrip.site.webUrl || roundTrip.site.id}</dd>
                </div>
              </dl>
            </div>
          )}

          {workflowRoundTrip && (
            <div className="auth-spike-result">
              <h2>Workflow list round-trip</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{workflowRoundTrip.status}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{workflowRoundTrip.source}</dd>
                </div>
                <div>
                  <dt>List</dt>
                  <dd>{workflowRoundTrip.list.displayName}</dd>
                </div>
                <div>
                  <dt>Created item ID</dt>
                  <dd>{workflowRoundTrip.item.id}</dd>
                </div>
                <div>
                  <dt>Created workflow key</dt>
                  <dd>{String(workflowRoundTrip.fields.createdWorkflowKey ?? '(not provided)')}</dd>
                </div>
                <div>
                  <dt>Updated memo</dt>
                  <dd>{String(workflowRoundTrip.fields.updatedMemoText ?? '(not provided)')}</dd>
                </div>
                <div>
                  <dt>Updated status</dt>
                  <dd>{String(workflowRoundTrip.fields.updatedPromiseStatus ?? '(not provided)')}</dd>
                </div>
                <div>
                  <dt>Cleanup</dt>
                  <dd>{workflowRoundTrip.cleanupStatus}</dd>
                </div>
              </dl>
            </div>
          )}

          {diagnostics && (
            <div className="auth-spike-result">
              <h2>SharePoint diagnostics</h2>
              <dl>
                {Object.entries(diagnostics.probes).map(([key, probe]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>
                      {probe.ok ? 'ok' : 'failed'} / {probe.status}
                      <br />
                      {JSON.stringify(probe.body).slice(0, 420)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {snapshotUpload && (
            <div className="auth-spike-result">
              <h2>Server snapshot upload</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{snapshotUpload.status}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{snapshotUpload.source}</dd>
                </div>
                <div>
                  <dt>Filename</dt>
                  <dd>{snapshotUpload.filename}</dd>
                </div>
                <div>
                  <dt>Folder</dt>
                  <dd>{snapshotUpload.folder}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{snapshotUpload.file.size ?? '(not provided)'}</dd>
                </div>
                <div>
                  <dt>SharePoint URL</dt>
                  <dd>{snapshotUpload.file.webUrl || '(not provided)'}</dd>
                </div>
              </dl>
            </div>
          )}

          {snapshotRestore && (
            <div className="auth-spike-result">
              <h2>Server snapshot restore</h2>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>{snapshotRestore.result.status}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{snapshotRestore.result.source}</dd>
                </div>
                <div>
                  <dt>Filename</dt>
                  <dd>{snapshotRestore.result.filename}</dd>
                </div>
                <div>
                  <dt>Folder</dt>
                  <dd>{snapshotRestore.result.folder}</dd>
                </div>
                <div>
                  <dt>Transactions</dt>
                  <dd>{snapshotRestore.transactionCount}</dd>
                </div>
                <div>
                  <dt>As of date</dt>
                  <dd>{snapshotRestore.asOfDate}</dd>
                </div>
                <div>
                  <dt>Local storage saved</dt>
                  <dd>{snapshotRestore.saved ? 'yes' : 'no'}</dd>
                </div>
                <div>
                  <dt>SharePoint URL</dt>
                  <dd>{snapshotRestore.result.file.webUrl || '(not provided)'}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
