import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';
import type { ParsingPreviewResult } from '../parsing-engine/types';
import type { DataSource } from '../api/client';

export type ReadinessStatus = 'ready' | 'review' | 'blocked' | 'empty';

interface ReadinessProps {
  lang: Lang;
  status: ReadinessStatus;
  result: ParsingPreviewResult | null;
  reviewCount: number;
  dataSource?: DataSource;
}

export function Readiness({ lang, status, result, reviewCount, dataSource }: ReadinessProps) {
  const t = strings[lang];

  const statusLabel = {
    ready: t.statusReady,
    review: t.statusNeedsReview,
    blocked: t.statusBlocked,
    empty: t.statusEmpty,
  }[status];

  const sourceLabel = !dataSource || dataSource === 'unknown'
    ? null
    : dataSource === 'api'
      ? t.sourceApi
      : t.sourceFallback;

  const fileCount = result?.classificationReport.length ?? 0;
  const criticalCount = result?.validationReport.critical.length ?? 0;
  const warningTotal =
    result?.validationReport.warnings.reduce((s, w) => s + w.count, 0) ?? 0;
  const infoTotal = result?.validationReport.info.reduce((s, i) => s + i.count, 0) ?? 0;

  return (
    <div className="readiness">
      <div className="readiness-header">
        <div>
          <div className="readiness-label">{t.importReadiness}</div>
          <div className={`readiness-status ${status}`}>{statusLabel}</div>
        </div>
        {sourceLabel && (
          <span className={`source-pill ${dataSource}`} title={sourceLabel}>
            {sourceLabel}
          </span>
        )}
      </div>

      <div className="readiness-grid">
        <div className="readiness-cell">
          <span className="readiness-cell-label">{t.files}</span>
          <span className="readiness-cell-value">{fileCount}</span>
        </div>
        <div className="readiness-cell">
          <span className="readiness-cell-label">{t.critical}</span>
          <span className={`readiness-cell-value ${criticalCount > 0 ? 'fail' : ''}`}>
            {criticalCount}
          </span>
        </div>
        <div className="readiness-cell">
          <span className="readiness-cell-label">{t.warnings}</span>
          <span className={`readiness-cell-value ${warningTotal > 0 ? 'warn' : ''}`}>
            {warningTotal}
          </span>
        </div>
        <div className="readiness-cell">
          <span className="readiness-cell-label">{t.info}</span>
          <span className="readiness-cell-value">{infoTotal}</span>
        </div>
        <div className="readiness-cell">
          <span className="readiness-cell-label">{t.reviewItems}</span>
          <span className={`readiness-cell-value ${reviewCount > 0 ? 'warn' : ''}`}>
            {reviewCount}
          </span>
        </div>
        {result && (
          <div className="readiness-cell">
            <span className="readiness-cell-label">{t.parser}</span>
            <span
              className="readiness-cell-value"
              style={{ fontSize: 13, lineHeight: 1.4 }}
            >
              v{result.parserVersion}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
