import { useState } from 'react';
import type { Lang } from '../../i18n/strings';
import { strings } from '../../i18n/strings';
import type { ParseResult } from '../../parsing-engine/types';

interface ReviewQueueTabProps {
  lang: Lang;
  result: ParseResult;
}

function fmtNum(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface ReviewState {
  reviewedKeys: string[];
  notes: Record<string, string>;
}

const STORAGE_KEY = 'agingApp.reviewState';

function loadReviewState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reviewedKeys: [], notes: {} };
    const parsed = JSON.parse(raw);
    return {
      reviewedKeys: Array.isArray(parsed.reviewedKeys) ? parsed.reviewedKeys : [],
      notes: parsed.notes ?? {},
    };
  } catch {
    return { reviewedKeys: [], notes: {} };
  }
}

function saveReviewState(s: ReviewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function ReviewQueueTab({ lang, result }: ReviewQueueTabProps) {
  const t = strings[lang];
  const [reviewState, setReviewState] = useState<ReviewState>(loadReviewState);

  const candidates = result.reviewCandidates.local;
  const duplicates = result.duplicateReview;

  const toggleReviewed = (key: string) => {
    const next = { ...reviewState };
    if (next.reviewedKeys.includes(key)) {
      next.reviewedKeys = next.reviewedKeys.filter(k => k !== key);
    } else {
      next.reviewedKeys = [...next.reviewedKeys, key];
    }
    setReviewState(next);
    saveReviewState(next);
  };

  const exportCsv = () => {
    const headers = [
      'Party',
      'SourceFile',
      'SourceRow',
      'InvoiceDate',
      'OurRefNo',
      'InvoiceNo',
      'Currency',
      'Balance',
      'DifferenceType',
      'Reviewed',
    ];
    const rows = candidates.map(c => {
      const key = `${c.sourceFile}|${c.sourceRow}`;
      return [
        c.party,
        c.sourceFile,
        c.sourceRow,
        c.invoiceDate,
        c.ourRefNo,
        c.invoiceNo,
        c.currency,
        c.balance,
        c.differenceType,
        reviewState.reviewedKeys.includes(key) ? 'yes' : 'no',
      ];
    });
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phase1-local-review-candidates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Local Review Candidates */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t.reviewLocalCandidates}</span>
          <span className="panel-subtitle">
            {candidates.length} {t.rows.toLowerCase()}
          </span>
        </div>
        <div className="panel-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
            {t.reviewLocalDescription}
          </p>
          <button type="button" className="btn btn-mono" onClick={exportCsv}>
            ⇣ {t.exportCsv}
          </button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>{t.party}</th>
              <th>{t.date}</th>
              <th>{t.ref}</th>
              <th>{t.invoice}</th>
              <th>{t.currency}</th>
              <th className="num">{t.balance}</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map(c => {
              const key = `${c.sourceFile}|${c.sourceRow}`;
              const reviewed = reviewState.reviewedKeys.includes(key);
              return (
                <tr key={key} style={{ opacity: reviewed ? 0.5 : 1 }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={() => toggleReviewed(key)}
                      aria-label="mark reviewed"
                    />
                  </td>
                  <td><b>{c.party}</b></td>
                  <td className="mono" style={{ fontSize: 11 }}>{c.invoiceDate}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{c.ourRefNo}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{c.invoiceNo || '—'}</td>
                  <td>{c.currency}</td>
                  <td className={`num ${c.balance > 0 ? 'positive' : c.balance < 0 ? 'negative' : 'zero'}`}>
                    {fmtNum(c.balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Duplicate Candidates */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t.reviewDuplicates}</span>
          <span className="panel-subtitle">
            {duplicates.groupCount} {t.groups.toLowerCase()} · {duplicates.transactionCount} {t.transactions.toLowerCase()}
          </span>
        </div>
        <div className="panel-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
            {t.reviewDuplicatesDescription}
          </p>
          <div className="metric-grid" style={{ marginBottom: 0 }}>
            <div className="metric-item">
              <div className="metric-label">{t.groups}</div>
              <div className="metric-value">{duplicates.groupCount}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">{t.transactions}</div>
              <div className="metric-value">{duplicates.transactionCount}</div>
            </div>
            <div className="metric-item">
              <div className="metric-label">{t.impact}</div>
              <div className="metric-value warn">
                {fmtNum(duplicates.potentialSignedImpact)}
              </div>
            </div>
          </div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>{t.identityKey}</th>
              <th>{t.currency}</th>
              <th className="num">{t.count}</th>
              <th className="num">{t.impact}</th>
              <th>{t.rows}</th>
            </tr>
          </thead>
          <tbody>
            {duplicates.topGroups.map((g, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 11 }}>{g.identityKey}</td>
                <td>{g.currency}</td>
                <td className="num">{g.count}</td>
                <td className="num negative">{fmtNum(g.potentialSignedImpact)}</td>
                <td className="mono" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {g.rows.join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
