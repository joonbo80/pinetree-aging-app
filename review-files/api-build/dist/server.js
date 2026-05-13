import express from 'express';
import cors from 'cors';
import { healthHandler } from './routes/health.js';
import { parseDemoHandler, parseUploadHandler } from './routes/parse.js';
const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '127.0.0.1';
// CORS — keep it permissive in dev; tighten when deployed behind SharePoint/Teams.
app.use(cors({
    origin: true, // reflect Origin header
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
});
