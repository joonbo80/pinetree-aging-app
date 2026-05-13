// pages/AgingReportPage.tsx
//
// v2.3 C2 Statement Collection Workbench MVP.
// Round 2 scope: page shell + tabs + No Due Date callout.
// Filters, CSV, party rollup expand detail land in later rounds.
//
// Spec reference: v2.3 C2 micro-spec rev3 (FROZEN)
//   Section 3.1   Page structure
//   Section 3.5   Tab classification formula
//   Decision 4    No Due Date pinned call-out
//
// The data backbone is the Round 1 selector. This page does NOT
// re-implement any classification logic; it only renders the
// AgingReportData projection.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ParsingPreviewResult } from '../parsing-engine/types';
import { selectAgingReport } from '../selectors/agingReport';
import { useAgingFilters } from '../hooks/useAgingFilters';
import { NoDueDateCallout } from '../components/aging/NoDueDateCallout';
import { AgingFilters } from '../components/aging/AgingFilters';
import { AgingExportButton } from '../components/aging/AgingExportButton';
import { AgingTabs } from '../components/aging/AgingTabs';
// Canonical CSS load path. Vite bundles this on import so the styles
// always ship with the page, regardless of whether index.html also
// registers the stylesheet via <link>. This eliminates the
// "stylesheet absent from production bundle" failure mode.
import '../styles/v2.3-aging-report.css';

interface AgingReportPageProps {
  result: ParsingPreviewResult | null;
  /**
   * Navigation callback to return to the dashboard. Provided by App.tsx
   * via navigate('/dashboard'). Round 2 receives it as a prop so the
   * page itself stays router-agnostic (mirroring the Dashboard pattern).
   */
  onBackToDashboard?: () => void;
}

export function AgingReportPage({
  result,
  onBackToDashboard,
}: AgingReportPageProps) {
  const navigate = useNavigate();
  const defaultAsOfDate = result?.uploadSession?.asOfDate ?? '';
  const filters = useAgingFilters(defaultAsOfDate);

  // Derive aging report from the parsing result. The selector is the
  // single source of truth for tab classification, statement status,
  // action readiness, priority band, and currency separation.
  const report = useMemo(
    () => selectAgingReport(result, filters.asOfDate),
    [filters.asOfDate, result],
  );

  // Empty state: no data loaded yet (user landed on /aging directly
  // without committing a baseline import).
  if (!result || !result.details) {
    return (
      <main className="app-content aging-report-page">
        <div className="app-subtitle">
          Statement Collection Workbench
        </div>
        <div className="empty">
          <h2 className="empty-title">No data loaded yet</h2>
          <p className="empty-sub">
            Load or upload data in Upload + Parsing Preview first, then
            commit the import. The Collection Workbench reads the same
            committed baseline as the Dashboard.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (onBackToDashboard) onBackToDashboard();
              else navigate('/');
            }}
          >
            Back to Upload
          </button>
        </div>
      </main>
    );
  }

  // Counts for the tabs summary line. These come straight from the
  // selector's transactionCount per tab, so they are the same numbers
  // the Round 1 invariants pin.
  const currentCount = report.tabs.current.transactionCount;
  const overdueCount = report.tabs.overdue.transactionCount;
  const clearedCount = report.tabs.cleared.transactionCount;
  const noDueOpenCount = report.noDueDate.openCount;

  return (
    <main className="app-content aging-report-page">
      <div className="aging-report-header">
        <div>
          <div className="app-subtitle">
            Statement Collection Workbench
          </div>
          <div className="aging-asof">
            As of {report.asOfDate || '(unknown)'}
          </div>
        </div>
        <div className="aging-report-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              if (onBackToDashboard) onBackToDashboard();
              else navigate('/dashboard');
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* No Due Date callout appears ABOVE the tabs (spec Decision 4). */}
      <NoDueDateCallout
        openCount={noDueOpenCount}
        totals={report.noDueDate.totals}
      />

      <AgingFilters
        filters={filters}
        defaultAsOfDate={defaultAsOfDate}
      />

      <AgingExportButton report={report} filters={filters} />

      {/* Summary strip: tab counts at a glance. Currency totals here are
          transaction-count summaries; the per-tab USD/CAD totals appear
          inside each tab in Round 3 once rollup tables land. */}
      <div className="aging-summary-strip">
        <div className="aging-summary-cell">
          <div className="aging-summary-label">Current</div>
          <div className="aging-summary-value">{currentCount}</div>
        </div>
        <div className="aging-summary-cell">
          <div className="aging-summary-label">Overdue</div>
          <div className="aging-summary-value">{overdueCount}</div>
        </div>
        <div className="aging-summary-cell">
          <div className="aging-summary-label">Cleared</div>
          <div className="aging-summary-value">{clearedCount}</div>
        </div>
      </div>

      <AgingTabs report={report} filters={filters} />
    </main>
  );
}
