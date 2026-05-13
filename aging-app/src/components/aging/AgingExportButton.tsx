// components/aging/AgingExportButton.tsx
//
// Download buttons for the v2.3 Statement Collection Workbench CSV export.
// CSV content is produced by the pure exportCsv.ts helper; this component
// only handles Blob URL browser download mechanics.

import type { AgingFilterState } from '../../hooks/useAgingFilters';
import type { AgingReportData } from '../../selectors/agingReport';
import { buildAgingCsv, type AgingCsvScope } from './exportCsv';

interface AgingExportButtonProps {
  report: AgingReportData;
  filters: AgingFilterState;
}

export function AgingExportButton({
  report,
  filters,
}: AgingExportButtonProps) {
  return (
    <div className="aging-export-actions" aria-label="CSV export actions">
      <button
        type="button"
        className="btn btn-ghost aging-export-btn"
        onClick={() => downloadCsv(report, filters, 'filtered')}
      >
        Export filtered
      </button>
      <button
        type="button"
        className="btn btn-ghost aging-export-btn"
        onClick={() => downloadCsv(report, filters, 'all')}
      >
        Export all
      </button>
    </div>
  );
}

function downloadCsv(
  report: AgingReportData,
  filters: AgingFilterState,
  scope: AgingCsvScope,
) {
  const csv = buildAgingCsv({
    report,
    scope,
    filters: scope === 'filtered' ? filters : undefined,
  });
  const blob = new Blob([csv.content], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = csv.filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
