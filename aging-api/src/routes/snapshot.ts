import { Router } from 'express';
import { bearerToken, validateGraphDelegatedToken } from '../auth/entra.js';
import {
  downloadDriveItemText,
  listSnapshotFiles,
  SNAPSHOT_FOLDER,
  uploadSnapshotFile,
} from '../services/sharepointGraph.js';

export const snapshotRouter = Router();

const SNAPSHOT_VERSION = 'v2.3-c3-snapshot-v1';

interface SnapshotUploadBody {
  filename?: unknown;
  snapshot?: unknown;
}

interface SnapshotLike {
  snapshotVersion?: unknown;
  summary?: {
    importBatchId?: unknown;
    asOfDate?: unknown;
  };
  result?: {
    uploadSession?: unknown;
  };
}

function assertSafeFilename(filename: unknown): asserts filename is string {
  if (typeof filename !== 'string' || filename.trim() !== filename || filename.length === 0) {
    throw new Error('Snapshot filename is required.');
  }
  if (!filename.endsWith('.json')) {
    throw new Error('Snapshot filename must end with .json.');
  }
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Snapshot filename contains an unsafe path segment.');
  }
}

function assertSnapshot(value: unknown): asserts value is SnapshotLike {
  const snapshot = value as SnapshotLike | null;
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Snapshot body must contain a snapshot object.');
  }
  if (snapshot.snapshotVersion !== SNAPSHOT_VERSION) {
    throw new Error(`Snapshot version must be ${SNAPSHOT_VERSION}.`);
  }
  if (typeof snapshot.summary?.importBatchId !== 'string' || snapshot.summary.importBatchId.length === 0) {
    throw new Error('Snapshot summary.importBatchId is required.');
  }
  if (typeof snapshot.summary?.asOfDate !== 'string' || snapshot.summary.asOfDate.length === 0) {
    throw new Error('Snapshot summary.asOfDate is required.');
  }
  if (!snapshot.result?.uploadSession) {
    throw new Error('Snapshot result.uploadSession is required.');
  }
}

snapshotRouter.post('/upload', async (req, res) => {
  try {
    await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const body = req.body as SnapshotUploadBody;

    assertSafeFilename(body.filename);
    assertSnapshot(body.snapshot);

    const content = `${JSON.stringify(body.snapshot, null, 2)}\n`;
    const { site, file } = await uploadSnapshotFile(token, body.filename, content);

    res.json({
      status: 'ok',
      source: 'sharepoint-snapshot-upload',
      filename: body.filename,
      folder: SNAPSHOT_FOLDER,
      site: {
        id: site.id,
        displayName: site.displayName ?? null,
        webUrl: site.webUrl ?? null,
      },
      file: {
        id: file.id,
        name: file.name,
        size: file.size ?? null,
        webUrl: file.webUrl ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Snapshot upload failed.';
    const status = message.includes('Bearer') || message.includes('Token') ? 401 : 400;
    res.status(status).json({
      status: 'error',
      code: 'SNAPSHOT_UPLOAD_FAILED',
      error: message,
    });
  }
});

snapshotRouter.get('/latest', async (req, res) => {
  try {
    await validateGraphDelegatedToken(req);
    const token = bearerToken(req);
    const { site, files } = await listSnapshotFiles(token);
    const latest = files[0];

    if (!latest) {
      res.status(404).json({
        status: 'error',
        code: 'SNAPSHOT_NOT_FOUND',
        error: 'No server snapshot found in SharePoint.',
      });
      return;
    }

    const text = await downloadDriveItemText(token, site.id, latest.id);
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(text);
    } catch {
      throw new Error(`Server snapshot ${latest.name} is not valid JSON.`);
    }

    assertSnapshot(snapshot);

    res.json({
      status: 'ok',
      source: 'sharepoint-snapshot-latest',
      filename: latest.name,
      folder: SNAPSHOT_FOLDER,
      site: {
        id: site.id,
        displayName: site.displayName ?? null,
        webUrl: site.webUrl ?? null,
      },
      file: {
        id: latest.id,
        name: latest.name,
        size: latest.size ?? null,
        webUrl: latest.webUrl ?? null,
        lastModifiedDateTime: latest.lastModifiedDateTime ?? null,
      },
      snapshot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Latest snapshot read failed.';
    const status = message.includes('Bearer') || message.includes('Token') ? 401 : 500;
    res.status(status).json({
      status: 'error',
      code: 'SNAPSHOT_LATEST_FAILED',
      error: message,
    });
  }
});
