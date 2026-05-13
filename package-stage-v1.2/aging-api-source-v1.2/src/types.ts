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

/**
 * Standard error response shape.
 *
 * `error`  Human-readable summary, safe to show in UI. Generic.
 * `code`   Stable machine-readable identifier the UI can switch on.
 * `detail` OPTIONAL. Use ONLY for information that is part of the public
 *          contract (e.g. "this endpoint ships in v1.2"). NEVER include
 *          err.message, stack traces, file paths, or any runtime detail —
 *          those are server-log-only.
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  detail?: string;
}

export interface UploadedWorkbookFile {
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  mimeType: string;
  extension: '.xls' | '.xlsx';
}

export interface UploadManifest {
  importBatchId: string;
  asOfDate: string;
  user: string | null;
  files: UploadedWorkbookFile[];
}

// ParsingPreviewResult is intentionally not duplicated here — the baseline
// JSON itself carries the canonical shape (specVersion, schemaVersion,
// parserVersion, …) and is forwarded as-is to clients. The full TypeScript
// shape lives in aging-app/src/parsing-engine/types.ts.
