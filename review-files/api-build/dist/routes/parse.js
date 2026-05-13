import baseline from '../baselines/phase1-v1.3.0.json' with { type: 'json' };
export function parseDemoHandler(_req, res) {
    // Mark the response with a header so the UI can show "data source = api".
    res.setHeader('X-Aging-Source', 'api-baseline');
    res.json(baseline);
}
export function parseUploadHandler(_req, res) {
    // Placeholder — wire SheetJS server-side parsing in v1.2 / v1.3
    res.status(501).json({
        error: 'Upload parsing not implemented in this build',
        code: 'NOT_IMPLEMENTED',
        detail: 'Phase 2 v1.1 ships /api/parse-demo only. Live parsing of .xls/.xlsx is planned for v1.2.',
    });
}
