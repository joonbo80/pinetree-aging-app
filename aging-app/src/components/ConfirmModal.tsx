import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';
import type { ParsingPreviewResult } from '../parsing-engine/types';

interface ConfirmModalProps {
  lang: Lang;
  open: boolean;
  result: ParsingPreviewResult;
  reviewCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({ lang, open, result, reviewCount, onCancel, onConfirm }: ConfirmModalProps) {
  if (!open) return null;
  const t = strings[lang];

  const fileTotal = result.classificationReport.length;
  const reconAllMatch = Object.values(result.reconciliationReport).every(r => r.match);
  const criticalCount = result.validationReport.critical.length;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{t.confirmTitle}</h3>
        </div>
        <div className="modal-body">
          <dl className="modal-summary">
            <dt>{t.confirmFiles}</dt>
            <dd>{fileTotal}/{fileTotal}</dd>
            <dt>{t.confirmReconciliation}</dt>
            <dd>
              <span className={`badge ${reconAllMatch ? 'pass' : 'fail'}`}>
                {reconAllMatch ? t.importPassed : t.fail}
              </span>
            </dd>
            <dt>{t.confirmCritical}</dt>
            <dd>{criticalCount}</dd>
            <dt>{t.confirmCandidates}</dt>
            <dd>{reviewCount}</dd>
          </dl>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {t.confirmBody}
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            {t.confirmImport}
          </button>
        </div>
      </div>
    </div>
  );
}
