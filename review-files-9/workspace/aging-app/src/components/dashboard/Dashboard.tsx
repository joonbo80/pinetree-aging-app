import type { ParsingPreviewResult } from '../../parsing-engine/types';
import type { Lang } from '../../i18n/strings';

interface DashboardProps {
  lang: Lang;
  result: ParsingPreviewResult | null;
  onBackToUpload: () => void;
  onOpenReview: () => void;
}

const CURRENCIES = ['USD', 'CAD'] as const;
const BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sumDirection(result: ParsingPreviewResult, direction: string, currency: string) {
  return result.directionTotals
    .filter(row => row.direction === direction && row.currency === currency)
    .reduce((sum, row) => sum + row.absoluteBalance, 0);
}

function countDirection(result: ParsingPreviewResult, direction: string, currency: string) {
  return result.directionTotals
    .filter(row => row.direction === direction && row.currency === currency)
    .reduce((sum, row) => sum + row.count, 0);
}

export function Dashboard({ result, onBackToUpload, onOpenReview }: DashboardProps) {
  if (!result) {
    return (
      <main className="app-content">
        <div className="app-subtitle">Phase 2 · Dashboard</div>
        <div className="empty">
          <h2 className="empty-title">Dashboard placeholder</h2>
          <p className="empty-sub">Load or upload data in Upload + Parsing Preview first.</p>
          <button type="button" className="btn btn-primary" onClick={onBackToUpload}>
            Back to Upload
          </button>
        </div>
      </main>
    );
  }

  const warningCount = result.validationReport.warnings.reduce((sum, item) => sum + item.count, 0);
  const infoCount = result.validationReport.info.reduce((sum, item) => sum + item.count, 0);
  const reviewCount = result.reviewCandidates.local.length;
  const ninetyPlusCount = (result.agingBuckets ?? [])
    .filter(row => row.bucket === '90+')
    .reduce((sum, row) => sum + row.count, 0);
  const unknownDepartments = (result.departmentSummary ?? [])
    .filter(row => row.department === 'UNKNOWN' || row.departmentLabel === 'UNKNOWN');
  const receivableParties = (result.topParties ?? []).filter(row => row.direction === 'receivable');
  const payableParties = (result.topParties ?? []).filter(row => row.direction === 'payable');
  const activeParties = new Set((result.topParties ?? []).map(row => row.partyName)).size;

  return (
    <main className="app-content dashboard-page">
      <div className="dashboard-topline">
        <div>
          <div className="app-subtitle">Phase 2 · Dashboard</div>
          <h2 className="dashboard-title">Upload Analysis Dashboard</h2>
        </div>
        <button type="button" className="btn" onClick={onBackToUpload}>
          Upload Preview
        </button>
      </div>

      <section className="dashboard-grid kpi-grid">
        {CURRENCIES.map(currency => {
          const receivable = sumDirection(result, 'receivable', currency);
          const payable = sumDirection(result, 'payable', currency);
          const settled = countDirection(result, 'settled', currency);
          return (
            <div className="dash-card" key={currency}>
              <div className="dash-card-title">{currency}</div>
              <div className="dash-money positive">{money(receivable)}</div>
              <div className="dash-row"><span>Receivable</span><b>{money(receivable)}</b></div>
              <div className="dash-row"><span>Payable</span><b>{money(payable)}</b></div>
              <div className="dash-row strong"><span>Net</span><b>{money(receivable - payable)}</b></div>
              <div className="dash-foot">Settled {settled.toLocaleString()}</div>
            </div>
          );
        })}

        <div className="dash-card">
          <div className="dash-card-title">Review State</div>
          <div className="dash-money warn">{reviewCount}</div>
          <div className="dash-row"><span>Critical</span><b>{result.validationReport.critical.length}</b></div>
          <div className="dash-row"><span>Warnings</span><b>{warningCount.toLocaleString()}</b></div>
          <div className="dash-row"><span>Info</span><b>{infoCount.toLocaleString()}</b></div>
          <button type="button" className="btn btn-mono dash-action" onClick={onOpenReview}>
            Open Review Queue
          </button>
        </div>

        <div className="dash-card">
          <div className="dash-card-title">Risk Signals</div>
          <div className="dash-money">{ninetyPlusCount.toLocaleString()}</div>
          <div className="dash-row"><span>90+</span><b>{ninetyPlusCount.toLocaleString()}</b></div>
          <div className="dash-row"><span>Active parties</span><b>{activeParties || '-'}</b></div>
          <div className="dash-row"><span>Duplicate groups</span><b>{result.duplicateReview.groupCount}</b></div>
          <div className="dash-row"><span>Unknown dept</span><b>{unknownDepartments.length}</b></div>
          <div className="dash-foot">{result.uploadSession.files.length} files · API parser {result.parserVersion}</div>
        </div>
      </section>

      {unknownDepartments.length > 0 && (
        <div className="notice warn">
          Unknown department rows detected. Review the Department Summary below before using department-level totals.
        </div>
      )}

      <section className="dashboard-grid two-col">
        <div className="dash-panel">
          <div className="panel-header">
            <span className="panel-title">Aging Bucket</span>
          </div>
          <div className="bucket-list">
            {BUCKETS.map(bucket => (
              <div className="bucket-row" key={bucket}>
                <div className="bucket-label">{bucket}</div>
                {CURRENCIES.map(currency => {
                  const row = (result.agingBuckets ?? []).find(item => item.bucket === bucket && item.currency === currency);
                  return (
                    <div className="bucket-cell" key={currency}>
                      <span>{currency}</span>
                      <b>{row ? money(row.absoluteBalance) : '0.00'}</b>
                      <small>{row?.count ?? 0}</small>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="panel-header">
            <span className="panel-title">Statement Match</span>
          </div>
          <div className="statement-summary-grid">
            <Metric label="Agent statements" value={result.statementMatchReport.agent.statementCount} />
            <Metric label="Agent matched" value={result.statementMatchReport.agent.matchedCRDRRefs} />
            <Metric label="Agent unmatched" value={result.statementMatchReport.agent.unmatchedCRDRRefs} warn={result.statementMatchReport.agent.unmatchedCRDRRefs > 0} />
            <Metric label="Local statements" value={result.statementMatchReport.local.statementCount} />
            <Metric label="Local exact matches" value={result.statementMatchReport.local.exactSignedBalanceMatches} />
            <Metric label="Not in ERP extract" value={result.statementMatchReport.local.notInUploadedErpExtract} warn={result.statementMatchReport.local.notInUploadedErpExtract > 0} />
          </div>
        </div>
      </section>

      <section className="dashboard-grid two-col">
        <div className="dash-panel">
          <div className="panel-header">
            <span className="panel-title">Department Summary</span>
            <span className="panel-subtitle">receivable / payable only</span>
          </div>
          <table className="data compact">
            <thead>
              <tr>
                <th>Dept</th>
                <th>Currency</th>
                <th>Direction</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(result.departmentSummary ?? [])
                .filter(row => row.direction !== 'settled')
                .slice(0, 12)
                .map((row, index) => (
                  <tr key={`${row.department}-${row.currency}-${row.direction}-${index}`} className={row.department === 'UNKNOWN' ? 'warn-row' : ''}>
                    <td><b>{row.department}</b> <span className="muted">{row.departmentLabel}</span></td>
                    <td>{row.currency}</td>
                    <td>{row.direction}</td>
                    <td className="num">{money(row.absoluteBalance)}</td>
                  </tr>
                ))}
              {(result.departmentSummary ?? []).length === 0 && (
                <tr><td colSpan={4} className="muted">Available after live upload.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dash-panel">
          <div className="panel-header">
            <span className="panel-title">Top Parties</span>
            <span className="panel-subtitle">receivable first, payable second</span>
          </div>
          <TopPartyTable title="Top Receivable" rows={receivableParties.slice(0, 6)} />
          <TopPartyTable title="Top Payable" rows={payableParties.slice(0, 6)} />
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`statement-metric ${warn ? 'warn' : ''}`}>
      <span>{label}</span>
      <b>{value.toLocaleString()}</b>
    </div>
  );
}

function TopPartyTable({ title, rows }: { title: string; rows: NonNullable<ParsingPreviewResult['topParties']> }) {
  return (
    <div className="top-party-section">
      <div className="top-party-title">{title}</div>
      <table className="data compact">
        <thead>
          <tr>
            <th>Party</th>
            <th>Currency</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.partyName}-${row.currency}-${row.direction}`}>
              <td><b>{row.partyName}</b><br /><span className="muted">Max aging {row.maxAgingDays}</span></td>
              <td>{row.currency}</td>
              <td className="num">{money(row.absoluteBalance)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="muted">No rows.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

