import express from 'express';
import cors from 'cors';
import { healthHandler } from './routes/health.js';
import { parseDemoHandler, parseUploadHandler } from './routes/parse.js';
const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1';
// CORS allowlist.
//
// Default allows the local UI dev server. Override with AGING_API_CORS_ORIGINS
// (comma-separated) for production deployments behind SharePoint or Teams.
//
// Once /api/parse-upload accepts real files (v1.2), this allowlist plus
// authentication is the only thing standing between the parser and the
// public internet — keep it tight.
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000', // python http.server used in QA
    'http://127.0.0.1:5000',
];
const allowedOrigins = (process.env.AGING_API_CORS_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const allowlist = allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
app.use(cors({
    origin(origin, cb) {
        // Allow same-origin / file:// (origin === undefined) and the explicit allowlist.
        if (!origin || allowlist.includes(origin)) {
            return cb(null, true);
        }
        cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    exposedHeaders: ['X-Aging-Source'],
}));
app.use(express.json({ limit: '20mb' }));
// --- Routes ---
app.get('/api/health', healthHandler);
app.get('/api/parse-demo', parseDemoHandler);
app.post('/api/parse-upload', parseUploadHandler);
// --- Root ---
app.get('/', (_req, res) => {
    res.json({
        service: 'aging-api',
        routes: [
            'GET  /api/health',
            'GET  /api/parse-demo',
            'POST /api/parse-upload (501 — coming in v1.2)',
        ],
    });
});
// --- 404 ---
app.use((_req, res) => {
    res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND',
    });
});
// --- Boot ---
app.listen(PORT, HOST, () => {
    console.log(`[aging-api] listening on http://${HOST}:${PORT}`);
    console.log(`            GET  /api/health`);
    console.log(`            GET  /api/parse-demo`);
    console.log(`            POST /api/parse-upload (501)`);
    console.log(`            CORS allowlist: ${allowlist.join(', ')}`);
});
