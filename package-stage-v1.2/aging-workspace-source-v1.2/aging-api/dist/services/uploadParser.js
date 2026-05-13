import Busboy from 'busboy';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { assertWorkbookMagic, workbookExtension } from './magicBytes.js';
import { UploadError } from './uploadErrors.js';
import { UPLOAD_LIMITS } from './uploadLimits.js';
function requestAsOfDate(req) {
    const header = req.header('x-aging-as-of-date');
    if (header && /^\d{4}-\d{2}-\d{2}$/.test(header))
        return header;
    return new Date().toISOString().slice(0, 10);
}
function requestUser(req) {
    const header = req.header('x-aging-user');
    return header ? header.slice(0, 120) : null;
}
export async function parseWorkbookMultipart(req) {
    const contentType = req.header('content-type') ?? '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
        throw new UploadError('UNSUPPORTED_CONTENT_TYPE', 'Expected multipart/form-data', 415);
    }
    const importBatchId = randomUUID();
    const tempDir = await mkdtemp(join(tmpdir(), `aging-upload-${importBatchId}-`));
    const files = [];
    const pending = [];
    let totalBytes = 0;
    let rejected = null;
    const cleanup = async () => {
        await rm(tempDir, { recursive: true, force: true });
    };
    const rejectOnce = (err) => {
        if (!rejected)
            rejected = err;
    };
    await new Promise((resolvePromise, rejectPromise) => {
        const bb = Busboy({
            headers: req.headers,
            limits: {
                files: UPLOAD_LIMITS.maxFiles,
                fileSize: UPLOAD_LIMITS.maxFileBytes,
            },
        });
        bb.on('file', (_fieldName, file, info) => {
            if (rejected) {
                file.resume();
                return;
            }
            const originalName = basename(info.filename || 'upload.xls');
            const extension = workbookExtension(originalName);
            const mimeType = info.mimeType || '';
            if (!extension) {
                rejectOnce(new UploadError('UNSUPPORTED_FILE_TYPE', `${originalName} is not .xls or .xlsx`, 415));
                file.resume();
                return;
            }
            if (!UPLOAD_LIMITS.allowedMimeTypes.has(mimeType)) {
                rejectOnce(new UploadError('UNSUPPORTED_MIME_TYPE', `${originalName} has unsupported MIME type`, 415));
                file.resume();
                return;
            }
            const storedPath = join(tempDir, `${randomUUID()}${extension}`);
            const out = createWriteStream(storedPath, { flags: 'wx', mode: 0o600 });
            let sizeBytes = 0;
            let firstBytes = Buffer.alloc(0);
            let truncated = false;
            file.on('limit', () => {
                truncated = true;
                rejectOnce(new UploadError('UPLOAD_FILE_TOO_LARGE', `${originalName} exceeds 25 MB`, 413));
            });
            file.on('data', chunk => {
                sizeBytes += chunk.length;
                totalBytes += chunk.length;
                if (firstBytes.length < 8) {
                    firstBytes = Buffer.concat([firstBytes, chunk]).subarray(0, 8);
                }
                if (totalBytes > UPLOAD_LIMITS.maxRequestBytes) {
                    rejectOnce(new UploadError('UPLOAD_REQUEST_TOO_LARGE', 'Upload request exceeds 100 MB', 413));
                    file.unpipe(out);
                    file.resume();
                    out.destroy();
                }
            });
            file.pipe(out);
            pending.push(new Promise((resolveFile, rejectFile) => {
                out.on('error', rejectFile);
                file.on('error', rejectFile);
                out.on('close', () => {
                    if (truncated || rejected) {
                        resolveFile();
                        return;
                    }
                    try {
                        assertWorkbookMagic(extension, firstBytes, originalName);
                        files.push({
                            originalName,
                            storedPath,
                            sizeBytes,
                            mimeType,
                            extension,
                        });
                        resolveFile();
                    }
                    catch (err) {
                        rejectFile(err);
                    }
                });
            }));
        });
        bb.on('filesLimit', () => {
            rejectOnce(new UploadError('TOO_MANY_FILES', `Upload accepts at most ${UPLOAD_LIMITS.maxFiles} files`, 413));
        });
        bb.on('error', err => {
            rejectPromise(err);
        });
        bb.on('close', () => {
            resolvePromise();
        });
        req.pipe(bb);
    });
    try {
        if (rejected)
            throw rejected;
        await Promise.all(pending);
        if (files.length === 0)
            throw new UploadError('NO_FILES', 'No workbook files were uploaded', 400);
        return {
            tempDir,
            manifest: {
                importBatchId,
                asOfDate: requestAsOfDate(req),
                user: requestUser(req),
                files,
            },
            cleanup,
        };
    }
    catch (err) {
        await cleanup();
        throw err;
    }
}
