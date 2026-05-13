// types.ts — API response shapes

export interface HealthResponse {
  status: 'ok';
  service: 'aging-api';
  version: string;
  specVersion: string;
  parserVersion: string;
  uptime: number;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  detail?: string;
}

// ParseResult is intentionally not duplicated here — the baseline JSON itself
// carries the canonical shape (specVersion, schemaVersion, parserVersion, …)
// and is forwarded as-is to clients.
