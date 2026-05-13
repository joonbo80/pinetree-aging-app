import type { Request, Response } from 'express';
import type { HealthResponse } from '../types.js';
import baseline from '../baselines/phase1-v1.3.0.json' with { type: 'json' };

const startedAt = Date.now();
const SERVICE_VERSION = '1.1.0';

export function healthHandler(_req: Request, res: Response<HealthResponse>) {
  res.json({
    status: 'ok',
    service: 'aging-api',
    version: SERVICE_VERSION,
    specVersion: baseline.specVersion ?? '1.3.0',
    parserVersion: baseline.parserVersion ?? '1.3.0',
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
}
