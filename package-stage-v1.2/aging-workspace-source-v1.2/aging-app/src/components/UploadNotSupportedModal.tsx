import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';

interface UploadNotSupportedModalProps {
  lang: Lang;
  open: boolean;
  files: File[];
  onClose: () => void;
  onLoadDemo: () => void;
}

export function UploadNotSupportedModal({
  lang,
  open,
  files,
  onClose,
  onLoadDemo,
}: UploadNotSupportedModalProps) {
  if (!open) return null;
  const t = strings[lang];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">{t.uploadDisabledTitle}</h3>
        </div>
        <div className="modal-body">
          <div
            className="notice warn"
            style={{ marginTop: 0, marginBottom: 16 }}
          >
            {t.uploadDisabledBody}
          </div>
          {files.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                }}
              >
                {t.uploadDisabledFiles} ({files.length})
              </div>
              <ul
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {files.map((f, i) => (
                  <li
                    key={i}
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            {t.close}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onLoadDemo();
            }}
          >
            {t.uploadDisabledLoadDemo}
          </button>
        </div>
      </div>
    </div>
  );
}
