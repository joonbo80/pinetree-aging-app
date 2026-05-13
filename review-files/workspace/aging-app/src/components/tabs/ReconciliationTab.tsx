import type { Lang } from '../../i18n/strings';
import { strings } from '../../i18n/strings';
import type { ParseResult, DirectionTotal } from '../../parsing-engine/types';

interface ReconciliationTabProps {
  lang: Lang;
  result: ParseResult;
}

function fmtNum(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function groupDirections(totals: DirectionTotal[]) {
  const map = new Map<string, DirectionTotal[]>();
  for (const t of totals) {
    const list = map.get(t.currency) ?? [];
    list.push(t);
    map.set(t.currency, list);
  }
  return map;
}

export function ReconciliationTab({ lang, result }: ReconciliationTabProps) {
  const t = strings[lang];
  const recon = result.reconciliationReport;
  const directions = groupDirections(result.directionTotals);

  return (
    <>
      {/* Summary cards */}
      <div className="recon-cards">
        {(['INVOICE', 'CRDR', 'AP'] as const).map(type => {
          const r = recon[type];
          if (!r) return null;
          const variant = !r.match
            ? 'fail'
            : r.rejectedRowCount > 0
              ? 'fail'
              : r.skippedRowCount > 0
                ? 'warn'
                : '';
          return (
            <div key={type} className={`recon-card ${variant}`}>
              <div className="recon-card-type">{type}</div>
              <div className="recon-card-amount">
                ${fmtNum(r.parsedTotal)}
              </div>
              <div className="recon-card-meta">
                <span><b>{r.parsedRowCount}</b> / {r.sourceRowCount} {t.rows.toLowerCase()}</span>
                <span className={`badge ${r.match ? 'pass' : 'fail'} dot`}>
                  {r.match ? t.pass : t.fail}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direction strip */}
      <div className="section-heading">
        <h3>{t.direction} {t.signedBalance}</h3>
        <span className="section-meta">USD / CAD · never combined</span>
      </div>

      <div className="direction-strip">
        {Array.from(directions.entries()).flatMap(([currency, list]) =>
          list.map(d => (
            <div key={`${currency}-${d.direction}`} className="direction-cell">
              <div className="direction-cell-head">
                <span>{(t as any)[d.direction]}</span>
                <b>{currency}</b>
              </div>
              <div className={`direction-cell-amount ${d.direction}`}>
                {d.signedBalance >= 0 ? '+' : ''}
                {fmtNum(d.signedBalance)}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                {d.count.toLocaleString()} tx
              </div>
            </div>
          )),
        )}
      </div>

      {/* Detail table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t.tabReconciliation}</span>
          <span className="panel-subtitle">{t.diffStatusZero}</span>
        </div>
        <div className="panel-body no-pad">
          <table className="data">
            <thead>
              <tr>
                <th>{t.type}</th>
                <th className="num">{t.sourceRows}</th>
                <th className="num">{t.parsed}</th>
                <th className="num">{t.skipped}</th>
                <th className="num">{t.rejected}</th>
                <th className="num">{t.sourceTotal}</th>
                <th className="num">{t.parsedTotal}</th>
                <th className="num">{t.diff}</th>
                <th>{t.match}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(recon).map(([type, r]) => (
                <tr key={type}>
                  <td><b>{type}</b></td>
                  <td className="num">{r.sourceRowCount}</td>
                  <td className="num">{r.parsedRowCount}</td>
                  <td className="num">{r.skippedRowCount > 0 ? r.skippedRowCount : '—'}</td>
                  <td className="num">{r.rejectedRowCount > 0 ? r.rejectedRowCount : '—'}</td>
                  <td className="num">${fmtNum(r.sourceComputedTotal)}</td>
                  <td className="num">${fmtNum(r.parsedTotal)}</td>
                  <td className={`num ${r.diff === 0 ? 'zero' : 'negative'}`}>
                    {fmtNum(r.diff)}
                  </td>
                  <td>
                    <span className={`badge ${r.match ? 'pass' : 'fail'}`}>
                      {r.match ? t.pass : t.fail}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-currency breakdown */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{t.currency} {t.parsedTotal}</span>
          <span className="panel-subtitle">USD / CAD</span>
        </div>
        <div className="panel-body no-pad">
          <table className="data">
            <thead>
              <tr>
                <th>{t.type}</th>
                <th>{t.currency}</th>
                <th className="num">{t.count}</th>
                <th className="num">{t.sourceTotal}</th>
                <th className="num">{t.parsedTotal}</th>
                <th className="num">{t.diff}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(recon).flatMap(([type, r]) =>
                Object.entries(r.currencies).map(([cur, c]) => (
                  <tr key={`${type}-${cur}`}>
                    <td><b>{type}</b></td>
                    <td>{cur}</td>
                    <td className="num">{c.count}</td>
                    <td className="num">${fmtNum(c.source)}</td>
                    <td className="num">${fmtNum(c.parsed)}</td>
                    <td className={`num ${c.diff === 0 ? 'zero' : 'negative'}`}>
                      {fmtNum(c.diff)}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Skipped rows */}
      {result.skippedRows.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{t.skipped} {t.rows}</span>
            <span className="panel-subtitle">
              {result.skippedRows.reduce((s, r) => s + r.count, 0)} total
            </span>
          </div>
          <div className="panel-body no-pad">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.type}</th>
                  <th>Reason</th>
                  <th className="num">{t.count}</th>
                </tr>
              </thead>
              <tbody>
                {result.skippedRows.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r.sourceType}</b></td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.reason}</td>
                    <td className="num">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
