// components/aging/AgingTabs.tsx
//
// Three primary tabs: Current / Overdue / Cleared.
// Round 3 renders the party rollup table and expandable transaction rows.
//
// Spec reference: v2.3 C2 micro-spec rev3
//   Section 3.1   Page structure (tab order)
//   Section 3.5   Tab classification
//   Decision 1    Read-only workbench (no edit affordance)

import { useMemo, useState } from 'react';
import type { AgingFilterController } from '../../hooks/useAgingFilters';
import type {
  AgingReportData,
  AgingTabData,
} from '../../selectors/agingReport';
import { AgingBucketBreakdown } from './AgingBucketBreakdown';
import { PartyRollupTable } from './PartyRollupTable';
import { filterAgingTabData } from './agingFilterLogic.ts';

type TabKey = 'current' | 'overdue' | 'cleared';

interface AgingTabsProps {
  report: AgingReportData;
  filters: AgingFilterController;
}

const TAB_DEFINITIONS: { key: TabKey; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cleared', label: 'Cleared' },
];

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AgingTabs({ report, filters }: AgingTabsProps) {
  // Default tab: Overdue is the most common starting point for a
  // collector ("what's past due today?"). Spec does not pin a default;
  // Overdue is a sensible default-on-load choice.
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');

  const unfilteredActiveData: AgingTabData = report.tabs[activeTab];
  const activeData = useFilteredTabData(unfilteredActiveData, filters);

  return (
    <div className="aging-tabs-container">
      <div className="aging-tabs-strip" role="tablist">
        {TAB_DEFINITIONS.map((t) => {
          const tabData = report.tabs[t.key];
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`aging-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              <span className="aging-tab-label">{t.label}</span>
              <span className="aging-tab-count">
                {tabData.transactionCount}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="aging-tab-panel"
        role="tabpanel"
        aria-label={`${activeTab} tab content`}
      >
        <div className="aging-tab-totals">
          <span className="aging-tab-totals-label">Totals:</span>

          <span className="aging-tab-totals-group">
            <span className="aging-tab-totals-currency">USD</span>
            <span
              className="aging-tab-totals-cell aging-totals-receivable"
              title="Receivable: amounts owed to Pinetree (positive)"
            >
              AR {money(activeData.totals.USD.receivable)}
            </span>
            <span
              className="aging-tab-totals-cell aging-totals-payable"
              title="Payable: amounts Pinetree owes (negative)"
            >
              AP {money(activeData.totals.USD.payable)}
            </span>
          </span>

          <span className="aging-tab-totals-group">
            <span className="aging-tab-totals-currency">CAD</span>
            <span
              className="aging-tab-totals-cell aging-totals-receivable"
              title="Receivable: amounts owed to Pinetree (positive)"
            >
              AR {money(activeData.totals.CAD.receivable)}
            </span>
            <span
              className="aging-tab-totals-cell aging-totals-payable"
              title="Payable: amounts Pinetree owes (negative)"
            >
              AP {money(activeData.totals.CAD.payable)}
            </span>
          </span>

          <span className="aging-tab-totals-cell aging-tab-totals-count">
            {activeData.transactionCount} transaction
            {activeData.transactionCount === 1 ? '' : 's'} in{' '}
            {activeData.parties.length} party row
            {activeData.parties.length === 1 ? '' : 's'}
            {filters.activeFilterCount > 0 && (
              <>
                {' '}
                shown from {unfilteredActiveData.transactionCount}
              </>
            )}
          </span>
        </div>

        {activeData.parties.length === 0 ? (
          <div className="aging-tab-empty">
            <p>
              No {activeTab} items in scope.
              {activeTab === 'cleared' && (
                <>
                  {' '}
                  Adjust retention filter in Round 5 to expand the range.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'overdue' && (
              <AgingBucketBreakdown tabData={activeData} />
            )}
            <PartyRollupTable tabId={activeTab} data={activeData} />
          </>
        )}
      </div>
    </div>
  );
}

function useFilteredTabData(
  data: AgingTabData,
  filters: AgingFilterController,
): AgingTabData {
  return useMemo(() => {
    return filterAgingTabData(data, filters);
  }, [data, filters]);
}
