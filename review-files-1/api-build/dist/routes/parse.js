import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../baselines/phase1-v1.3.0.json');
// Cache the baseline once at module load. The file is small (~8 KB) and
// changes only on redeploy.
let cachedBaseline = null;
function getBaseline() {
    if (cachedBaseline === null) {
        cachedBaseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    }
    return cachedBaseline;
}
export function parseDemoHandler(_req, res) {
    try {
        res.setHeader('X-Aging-Source', 'api-baseline');
        res.json(getBaseline());
    }
    catch (err) {
        const error = {
            error: 'Baseline not available',
            code: 'BASELINE_LOAD_FAILED',
            detail: err instanceof Error ? err.message : String(err),
        };
        res.status(500).json(error);
    }
}
export function parseUploadHandler(_req, res) {
    // Placeholder — wire SheetJS server-side parsing in v1.2.
    // See docs/api-contract.md for the v1.2 design.
    res.status(501).json({
        error: 'Upload parsing not implemented in this build',
        code: 'NOT_IMPLEMENTED',
        detail: 'Phase 2 v1.1 ships /api/parse-demo only. Live parsing of .xls/.xlsx is planned for v1.2.',
    });
}
