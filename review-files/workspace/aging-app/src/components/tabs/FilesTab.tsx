import type { Lang } from '../../i18n/strings';
import { strings } from '../../i18n/strings';
import type { ParseResult } from '../../parsing-engine/types';

interface FilesTabProps {
  lang: Lang;
  result: ParseResult;
}

function getConfidenceClass(c: number) {
  if (c === 100) return 'high';
  if (c >= 70) return 'medium';
  return 'low';
}

export function FilesTab({ lang, result }: FilesTabProps) {
  const t = strings[lang];

  const fileMap = new Map(
    result.uploadSession.files.map(f => [f.name, f])
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{t.tabFiles}</span>
        <span className="panel-subtitle">
          {result.classificationReport.length} {t.files}
        </span>
      </div>
      <div className="panel-body no-pad">
        <table className="data">
          <thead>
            <tr>
              <th>{t.file}</th>
              <th>{t.detectedType}</th>
              <th className="num">{t.confidence}</th>
              <th>{t.rules}</th>
              <th>{t.sheet}</th>
              <th className="num">{t.rows}</th>
            </tr>
          </thead>
          <tbody>
            {result.classificationReport.map((c, i) => {
              const file = fileMap.get(c.file);
              return (
                <tr key={i}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.file}</div>
                    {file && (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                        }}
                      >
                        {(file.sizeBytes / 1024).toFixed(1)} KB
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge neutral">{c.detectedType}</span>
                  </td>
                  <td className="num">
                    <span className={`confidence ${getConfidenceClass(c.confidence)}`}>
                      {c.confidence}%
                    </span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {c.rulesPassed.map(r => (
                        <span
                          key={r}
                          className="badge pass"
                          style={{ fontSize: 9, padding: '1px 6px' }}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {c.sourceSheet || '—'}
                  </td>
                  <td className="num">{file?.recordCount.toLocaleString() ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
