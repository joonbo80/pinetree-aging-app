// api/client.ts
// API client for the aging-api server.
// All calls are short-timed and return null/throw so callers can fall back to baseline.

import type { ParsingPreviewResult } from '../parsing-engine/types';
import type { AgingSnapshotV1 } from '../utils/snapshot';

export type DataSource = 'api' | 'fallback' | 'snapshot' | 'unknown';

export interface ApiHealth {
  status: 'ok';
  service: string;
  version: string;
  specVersion: string;
  parserVersion: string;
  uptime: number;
  timestamp: string;
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  uploadToken?: string;
}

export interface ServerSnapshotUploadResult {
  status: 'ok';
  source: 'sharepoint-snapshot-upload';
  filename: string;
  folder: string;
  site: {
    id: string;
    displayName: string | null;
    webUrl: string | null;
  };
  file: {
    id: string;
    name: string;
    size: number | null;
    webUrl: string | null;
  };
}

export interface ServerSnapshotReadResult {
  status: 'ok';
  source: 'sharepoint-snapshot-latest';
  filename: string;
  folder: string;
  site: {
    id: string;
    displayName: string | null;
    webUrl: string | null;
  };
  file: {
    id: string;
    name: string;
    size: number | null;
    webUrl: string | null;
    lastModifiedDateTime: string | null;
  };
  snapshot: AgingSnapshotV1;
}

const DEFAULT_BASE = (() => {
  // Allow override via Vite env, otherwise default to localhost:3001
  // (developer machine) — production deployments will inject via env.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env;
  return (
    env?.VITE_AGING_API_BASE ??
    env?.VITE_API_BASE ??
    'http://127.0.0.1:3001'
  );
})();

const DEFAULT_UPLOAD_TOKEN = (() => {
  // Dev-only gate for /api/parse-upload. Production should replace this
  // with Microsoft Entra / Teams SSO and remove token injection from the UI.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env;
  return env?.VITE_AGING_UPLOAD_TOKEN ?? '';
})();

const DEFAULT_TIMEOUT = 2500;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

function normalizePreviewSchema(result: ParsingPreviewResult, source: string): ParsingPreviewResult {
  if (!result.schemaVersion) {
    console.warn(`[aging-api] ${source} response is missing schemaVersion; treating as v1 summary-only payload.`);
    return result;
  }

  if (result.schemaVersion === '1.0') {
    console.warn(`[aging-api] ${source} returned schemaVersion 1.0; drill-down details are unavailable.`);
    return result;
  }

  if (result.schemaVersion === '1.1') {
    return result;
  }

  console.warn(`[aging-api] ${source} returned unknown schemaVersion ${result.schemaVersion}; treating it as a forward-compatible preview payload.`);
  return result;
}

export class AgingApiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private uploadToken: string;

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    this.uploadToken = opts.uploadToken ?? DEFAULT_UPLOAD_TOKEN;
  }

  /** Quick liveness check. Returns null if unreachable / non-OK. */
  async health(): Promise<ApiHealth | null> {
    const { signal, cancel } = withTimeout(this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as ApiHealth;
      return json;
    } catch {
      return null;
    } finally {
      cancel();
    }
  }

  /**
   * Fetch the demo parse result from the API.
   * Returns null if the API is unreachable, times out, or responds with a non-OK status.
   */
  async parseDemo(): Promise<ParsingPreviewResult | null> {
    const { signal, cancel } = withTimeout(this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/parse-demo`, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as ParsingPreviewResult;
      return normalizePreviewSchema(json, 'parse-demo');
    } catch {
      return null;
    } finally {
      cancel();
    }
  }

  async parseUpload(files: File[], asOfDate?: string): Promise<ParsingPreviewResult> {
    const { signal, cancel } = withTimeout(90_000);
    try {
      const body = new FormData();
      for (const file of files) {
        body.append('files', file, file.name);
      }

      const headers: Record<string, string> = {};
      if (asOfDate) headers['x-aging-as-of-date'] = asOfDate;
      if (this.uploadToken) headers['x-aging-upload-token'] = this.uploadToken;

      const res = await fetch(`${this.baseUrl}/api/parse-upload`, {
        method: 'POST',
        body,
        headers,
        signal,
      });

      if (!res.ok) {
        let message = `Upload failed (${res.status})`;
        try {
          const error = await res.json() as { error?: string; code?: string };
          message = error.error || error.code || message;
        } catch {
          // Keep the generic message.
        }
        throw new Error(message);
      }

      return normalizePreviewSchema((await res.json()) as ParsingPreviewResult, 'parse-upload');
    } finally {
      cancel();
    }
  }

  baseURL(): string {
    return this.baseUrl;
  }

  async uploadSnapshotToServer(
    snapshot: AgingSnapshotV1,
    filename: string,
    accessToken: string,
  ): Promise<ServerSnapshotUploadResult> {
    const { signal, cancel } = withTimeout(45_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/snapshot/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ snapshot, filename }),
        signal,
      });

      if (!res.ok) {
        let message = `Snapshot upload failed (${res.status})`;
        try {
          const error = await res.json() as { error?: string; code?: string };
          message = error.error || error.code || message;
        } catch {
          // Keep generic message.
        }
        throw new Error(message);
      }

      return res.json() as Promise<ServerSnapshotUploadResult>;
    } finally {
      cancel();
    }
  }

  async restoreLatestServerSnapshot(accessToken: string): Promise<ServerSnapshotReadResult> {
    const { signal, cancel } = withTimeout(45_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/snapshot/latest`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });

      if (!res.ok) {
        let message = `Latest snapshot read failed (${res.status})`;
        try {
          const error = await res.json() as { error?: string; code?: string };
          message = error.error || error.code || message;
        } catch {
          // Keep generic message.
        }
        throw new Error(message);
      }

      return res.json() as Promise<ServerSnapshotReadResult>;
    } finally {
      cancel();
    }
  }
}

export const apiClient = new AgingApiClient();
