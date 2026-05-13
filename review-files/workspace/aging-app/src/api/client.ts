// api/client.ts
// API client for the aging-api server.
// All calls are short-timed and return null/throw so callers can fall back to baseline.

import type { ParseResult } from '../parsing-engine/types';

export type DataSource = 'api' | 'fallback' | 'unknown';

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

const DEFAULT_TIMEOUT = 2500;

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

export class AgingApiClient {
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts: ApiClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
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
  async parseDemo(): Promise<ParseResult | null> {
    const { signal, cancel } = withTimeout(this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/parse-demo`, { signal });
      if (!res.ok) return null;
      const json = (await res.json()) as ParseResult;
      return json;
    } catch {
      return null;
    } finally {
      cancel();
    }
  }

  baseURL(): string {
    return this.baseUrl;
  }
}

export const apiClient = new AgingApiClient();
