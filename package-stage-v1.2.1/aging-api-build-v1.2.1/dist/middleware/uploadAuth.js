import { timingSafeEqual } from 'node:crypto';
const HEADER_NAME = 'x-aging-upload-token';
function tokensMatch(provided, expected) {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
}
export function requireUploadToken(req, res, next) {
    const expected = process.env.AGING_UPLOAD_TOKEN;
    if (!expected) {
        console.error('[upload-auth] AGING_UPLOAD_TOKEN is not configured');
        res.status(503).json({
            error: 'Upload endpoint is not configured',
            code: 'UPLOAD_AUTH_NOT_CONFIGURED',
        });
        return;
    }
    const provided = req.header(HEADER_NAME);
    if (!provided || !tokensMatch(provided, expected)) {
        res.status(401).json({
            error: 'Upload authorization required',
            code: 'UPLOAD_UNAUTHORIZED',
        });
        return;
    }
    next();
}
