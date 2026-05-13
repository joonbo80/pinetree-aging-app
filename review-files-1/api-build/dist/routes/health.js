import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// JSON import attributes (`import x from './x.json' with { type: 'json' }`)
// are still flagged experimental on some Node 20.x lines and break under
// `node dist/...` without `--experimental-json-modules` on older releases.
// fs.readFileSync is universally supported and lets us also re-read after edits
// in long-running dev servers if we ever want to.
const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../baselines/phase1-v1.3.0.json');
let baselineSpec = '1.3.0';
let baselineParser = '1.3.0';
try {
    const parsed = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    baselineSpec = parsed.specVersion ?? baselineSpec;
    baselineParser = parsed.parserVersion ?? baselineParser;
}
catch {
    /* keep defaults */
}
const startedAt = Date.now();
const SERVICE_VERSION = '1.1.0';
export function healthHandler(_req, res) {
    res.json({
        status: 'ok',
        service: 'aging-api',
        version: SERVICE_VERSION,
        specVersion: baselineSpec,
        parserVersion: baselineParser,
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        timestamp: new Date().toISOString(),
    });
}
