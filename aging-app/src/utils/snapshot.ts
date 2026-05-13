import type { DataSource } from '../api/client';
import type { ParsingPreviewResult } from '../parsing-engine/types';

export const SNAPSHOT_STORAGE_KEY = 'agingApp.committedSnapshot.v1';
export const SNAPSHOT_VERSION = 'v2.3-c3-snapshot-v1';
export const SNAPSHOT_APP_VERSION = 'v2.3.0';

export interface AgingSnapshotSummary {
  importBatchId: string;
  asOfDate: string;
  fileCount: number;
  transactionCount: number;
  statementLinkCount: number;
  reviewItemCount: number;
  duplicateGroupCount: number;
}

export interface AgingSnapshotV1 {
  snapshotVersion: typeof SNAPSHOT_VERSION;
  appVersion: typeof SNAPSHOT_APP_VERSION;
  exportedAt: string;
  dataSource: DataSource;
  summary: AgingSnapshotSummary;
  result: ParsingPreviewResult;
}

export interface ParsedSnapshot {
  snapshot: AgingSnapshotV1;
  source: 'snapshot-envelope' | 'raw-parsing-preview-result';
}

function summarizeResult(result: ParsingPreviewResult): AgingSnapshotSummary {
  return {
    importBatchId: result.uploadSession.importBatchId,
    asOfDate: result.uploadSession.asOfDate,
    fileCount: result.uploadSession.files.length,
    transactionCount: result.details?.transactions.length ?? 0,
    statementLinkCount: result.details?.statementLinks.length ?? 0,
    reviewItemCount: result.details?.reviewItems.length ?? 0,
    duplicateGroupCount: result.details?.duplicateGroups.length ?? 0,
  };
}

function assertParsingPreviewResult(value: unknown): asserts value is ParsingPreviewResult {
  const result = value as Partial<ParsingPreviewResult> | null;
  if (!result || typeof result !== 'object') {
    throw new Error('Snapshot JSON must contain an object payload.');
  }
  if (!result.specVersion || !result.parserVersion || !result.uploadSession) {
    throw new Error('Snapshot JSON is missing ParsingPreviewResult metadata.');
  }
  if (!Array.isArray(result.classificationReport) || !result.validationReport) {
    throw new Error('Snapshot JSON is missing preview report sections.');
  }
}

export function buildAgingSnapshot(
  result: ParsingPreviewResult,
  dataSource: DataSource,
  exportedAt = new Date().toISOString(),
): AgingSnapshotV1 {
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    appVersion: SNAPSHOT_APP_VERSION,
    exportedAt,
    dataSource,
    summary: summarizeResult(result),
    result,
  };
}

export function snapshotFilename(snapshot: AgingSnapshotV1): string {
  const asOfDate = snapshot.summary.asOfDate || 'unknown-date';
  const batchId = snapshot.summary.importBatchId || 'unknown-batch';
  return `aging-snapshot-${asOfDate}-${batchId}.json`;
}

export function serializeSnapshot(snapshot: AgingSnapshotV1): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function parseSnapshotText(text: string): ParsedSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Snapshot file is not valid JSON.');
  }

  const maybeEnvelope = parsed as Partial<AgingSnapshotV1> | null;
  if (maybeEnvelope?.snapshotVersion === SNAPSHOT_VERSION) {
    assertParsingPreviewResult(maybeEnvelope.result);
    return {
      source: 'snapshot-envelope',
      snapshot: {
        snapshotVersion: SNAPSHOT_VERSION,
        appVersion: SNAPSHOT_APP_VERSION,
        exportedAt: String(maybeEnvelope.exportedAt || new Date().toISOString()),
        dataSource: maybeEnvelope.dataSource ?? 'snapshot',
        summary: summarizeResult(maybeEnvelope.result),
        result: maybeEnvelope.result,
      },
    };
  }

  assertParsingPreviewResult(parsed);
  const result = parsed;
  return {
    source: 'raw-parsing-preview-result',
    snapshot: buildAgingSnapshot(result, 'snapshot'),
  };
}

export function saveSnapshotToStorage(snapshot: AgingSnapshotV1): boolean {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, serializeSnapshot(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadSnapshotFromStorage(): AgingSnapshotV1 | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    return parseSnapshotText(raw).snapshot;
  } catch {
    return null;
  }
}

export function clearSnapshotStorage() {
  try {
    localStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
