import type { Request } from 'express';

const TENANT_ID = '16cca7b3-b733-44b6-a4a2-ad043eef5261';
const GRAPH_AUDIENCE = '00000003-0000-0000-c000-000000000000';
const ACCEPTED_ISSUERS = new Set([
  `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
  `https://login.microsoftonline.com/${TENANT_ID}/`,
  `https://sts.windows.net/${TENANT_ID}/`,
]);
interface JwtHeader {
  alg?: string;
  kid?: string;
}

export interface EntraPrincipal {
  aud: string;
  iss: string;
  exp: number;
  iat?: number;
  name?: string;
  oid?: string;
  preferred_username?: string;
  scp?: string;
  tid?: string;
  graphDisplayName?: string;
  graphUsername?: string;
}

interface GraphMe {
  id?: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
}

function base64UrlToBuffer(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function decodeJson<T>(value: string): T {
  return JSON.parse(base64UrlToBuffer(value).toString('utf8')) as T;
}

export function bearerToken(req: Request): string {
  const auth = req.header('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new Error('Missing Bearer token.');
  }
  return match[1];
}

async function graphMe(token: string): Promise<GraphMe> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft Graph /me rejected token (${response.status}): ${body.slice(0, 240)}`);
  }

  return response.json() as Promise<GraphMe>;
}

export async function validateGraphDelegatedToken(req: Request): Promise<EntraPrincipal> {
  const token = bearerToken(req);
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Bearer token is not a JWT.');
  }

  const [encodedHeader, encodedPayload] = parts;
  const header = decodeJson<JwtHeader>(encodedHeader);
  const payload = decodeJson<EntraPrincipal>(encodedPayload);

  if (header.alg !== 'RS256') {
    throw new Error(`Unsupported token algorithm: ${header.alg ?? 'missing'}.`);
  }
  if (!header.kid) {
    throw new Error('Token is missing key id.');
  }
  if (payload.tid !== TENANT_ID) {
    throw new Error('Token tenant mismatch.');
  }
  if (!payload.iss || !ACCEPTED_ISSUERS.has(payload.iss)) {
    throw new Error(`Token issuer mismatch: ${payload.iss}`);
  }
  if (payload.aud !== GRAPH_AUDIENCE) {
    throw new Error('Token audience is not Microsoft Graph.');
  }
  if (!payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error('Token is expired.');
  }

  const scopes = new Set((payload.scp ?? '').split(' ').filter(Boolean));
  if (!scopes.has('User.Read') || !scopes.has('Sites.ReadWrite.All')) {
    throw new Error('Token is missing required delegated scopes.');
  }

  // C5 is an auth spike, not a production JWT library. After local
  // tenant/audience/scope checks, Microsoft Graph /me is the authority
  // that proves this delegated Graph token is live and accepted.
  const me = await graphMe(token);
  if (me.id && payload.oid && me.id.toLowerCase() !== payload.oid.toLowerCase()) {
    throw new Error('Microsoft Graph /me identity does not match token object id.');
  }

  payload.graphDisplayName = me.displayName;
  payload.graphUsername = me.userPrincipalName ?? me.mail;

  return payload;
}
