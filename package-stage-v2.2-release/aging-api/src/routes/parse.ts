import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '../types.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseWorkbookMultipart } from '../services/uploadParser.js';
import { UploadError } from '../services/uploadErrors.js';
import { runPhase1Worker } from '../services/phase1Runner.js';
import { toParsingPreviewResult } from '../services/previewTransform.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../baselines/phase1-v1.3.0.json');

let cachedBaseline: unknown = null;
function getBaseline(): unknown {
  if (cachedBaseline === null) {
    cachedBaseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  }
  return cachedBaseline;
}

export function parseDemoHandler(_req: Request, res: Response) {
  try {
    res.setHeader('X-Aging-Source', 'api-baseline');
    res.json(getBaseline());
  } catch (err) {
    console.error('[parse-demo] baseline load failed:', err);
    const error: ApiErrorResponse = {
      error: 'Baseline not available',
      code: 'BASELINE_LOAD_FAILED',
    };
    res.status(500).json(error);
  }
}

export async function parseUploadHandler(req: Request, res: Response) {
  let cleanup: (() => Promise<void>) | null = null;
  try {
    const upload = await parseWorkbookMultipart(req);
    cleanup = upload.cleanup;
    const raw = await runPhase1Worker(upload.tempDir, upload.manifest);
    res.setHeader('X-Aging-Source', 'api-upload');
    res.json(toParsingPreviewResult(raw as Record<string, unknown>));
  } catch (err) {
    if (err instanceof UploadError) {
      const error: ApiErrorResponse = {
        error: err.message,
        code: err.code,
      };
      res.status(err.status).json(error);
      return;
    }
    console.error('[parse-upload] failed:', err);
    const error: ApiErrorResponse = {
      error: 'Upload parsing failed',
      code: 'PARSE_UPLOAD_FAILED',
    };
    res.status(500).json(error);
  } finally {
    if (cleanup) {
      try {
        await cleanup();
      } catch (err) {
        console.error('[parse-upload] temp cleanup failed:', err);
      }
    }
  }
}
