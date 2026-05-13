// components/aging/AgingTabs.tsx
//
// Three primary tabs: Current / Overdue / Cleared.
// Round 2 renders the tabs strip + per-tab placeholder with transaction
// counts and USD/CAD totals. The party rollup table itself is Round 3.
//
// Spec reference: v2.3 C2 micro-spec rev3
//   Section 3.1   Page structure (tab order)
//   Section 3.5   Tab classification
//   Decision 1    Read-only workbench (no edit affordance)

import { useState } from 'react';
import type {
  AgingReportData,
  AgingTabData,
} from '../../selectors/agingReport';

type TabKey = 'current' | 'overdue' | 'cleared';

interface AgingTabsProps {
  report: AgingReportData;
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

export function AgingTabs({ report }: AgingTabsProps) {
  // Default tab: Overdue is the most common starting point for a
  // collector ("what's past due today?"). Spec does not pin a default;
  // Overdue is a sensible default-on-load choice.
  const [activeTab, setActiveTab] = useState<TabKey>('overdue');

  const activeData: AgingTabData = report.tabs[activeTab];

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
          <span className="aging-tab-totals-cell">
            USD {money(activeData.totals.USD)}
          </span>
          <span className="aging-tab-totals-cell">
            CAD {money(activeData.totals.CAD)}
          </span>
          <span className="aging-tab-totals-cell aging-tab-totals-count">
            {activeData.transactionCount} transaction
            {activeData.transactionCount === 1 ? '' : 's'} in{' '}
            {activeData.parties.length} party row
            {activeData.parties.length === 1 ? '' : 's'}
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
          <div className="aging-tab-placeholder">
            <p>
              Party rollup table for the {activeTab} tab arrives in
              Round 3. {activeData.parties.length} rollup rows
              prepared. The Round 1 selector has already classified
              every transaction; only the table UI is pending.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
