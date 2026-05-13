import { randomUUID } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type { UploadManifest } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, '../..');
const DIST_WORKER_PATH = resolve(__dirname, '../scripts/phase1-worker.mjs');
const SOURCE_WORKER_PATH = resolve(API_ROOT, 'scripts/phase1-worker.mjs');
const WORKER_PATH = existsSync(DIST_WORKER_PATH) ? DIST_WORKER_PATH : SOURCE_WORKER_PATH;
const WORKER_TIMEOUT_MS = 90_000;
const MAX_STDERR_BYTES = 64 * 1024;

export async function runPhase1Worker(tempDir: string, manifest: UploadManifest): Promise<unknown> {
  const manifestPath = resolve(tempDir, `manifest-${randomUUID()}.json`);
  const outputPath = resolve(tempDir, `raw-result-${randomUUID()}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest), 'utf-8');

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [
      '--max-old-space-size=512',
      WORKER_PATH,
      manifestPath,
      outputPath,
    ], {
      cwd: API_ROOT,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('Phase 1 worker timed out'));
    }, WORKER_TIMEOUT_MS);

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8');
      if (stderr.length > MAX_STDERR_BYTES) {
        stderr = stderr.slice(-MAX_STDERR_BYTES);
      }
    });

    child.on('error', err => {
      clearTimeout(timeout);
      rejectPromise(err);
    });

    child.on('exit', code => {
      clearTimeout(timeout);
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`Phase 1 worker exited with code ${code}. ${stderr}`.trim()));
      }
    });
  });

  const text = await readFile(outputPath, 'utf-8');
  return JSON.parse(text);
}
