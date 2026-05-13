import express from 'express';
import cors from 'cors';
import { healthHandler } from './routes/health.js';
import { parseDemoHandler, parseUploadHandler } from './routes/parse.js';
import { requireUploadToken } from './middleware/uploadAuth.js';
const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1';
// CORS is a browser integration constraint, not a security boundary.
// Real upload protection is authentication, limits, validation, worker
// isolation, cleanup, and rate limiting.
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
];
const configuredOrigins = (process.env.AGING_API_CORS_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const allowlist = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
app.use(cors({
    origin(origin, cb) {
        if (!origin || allowlist.includes(origin)) {
            return cb(null, true);
        }
        cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    exposedHeaders: ['X-Aging-Source'],
}));
app.use(express.json({ limit: '20mb' }));
app.get('/api/health', healthHandler);
app.get('/api/parse-demo', parseDemoHandler);
app.post('/api/parse-upload', requireUploadToken, parseUploadHandler);
app.get('/', (_req, res) => {
    res.json({
        service: 'aging-api',
        routes: [
            'GET  /api/health',
            'GET  /api/parse-demo',
            'POST /api/parse-upload',
        ],
    });
});
app.use((_req, res) => {
    res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND',
    });
});
app.listen(PORT, HOST, () => {
    console.log(`[aging-api] listening on http://${HOST}:${PORT}`);
    console.log(`            GET  /api/health`);
    console.log(`            GET  /api/parse-demo`);
    console.log(`            POST /api/parse-upload (requires X-Aging-Upload-Token)`);
    console.log(`            upload auth: ${process.env.AGING_UPLOAD_TOKEN ? 'configured' : 'NOT CONFIGURED'}`);
    console.log(`            CORS allowlist: ${allowlist.join(', ')}`);
});
