// components/aging/AgingFilters.tsx
//
// Round 5 quick filters for the Statement Collection Workbench.
// URL-backed state lives in useAgingFilters; this component only renders
// calm, read-only workbench controls.

import type {
  AgingFilterController,
  AgingSignalFilter,
} from '../../hooks/useAgingFilters';
import type { ReactNode } from 'react';
import type { Currency, Direction } from '../../selectors/agingReport';

interface AgingFiltersProps {
  filters: AgingFilterController;
  defaultAsOfDate: string;
}

const CURRENCY_OPTIONS: Array<{ value: Currency; label: string }> = [
  { value: 'USD', label: 'USD' },
  { value: 'CAD', label: 'CAD' },
];

const DIRECTION_OPTIONS: Array<{ value: Direction; label: string }> = [
  { value: 'receivable', label: 'AR Receivable' },
  { value: 'payable', label: 'AP Payable' },
  { value: 'settled', label: 'Settled' },
];

const SIGNAL_OPTIONS: Array<{ value: AgingSignalFilter; label: string }> = [
  { value: 'statementDiff', label: 'Statement Diff' },
  { value: 'highAmount', label: 'High Amount' },
  { value: 'ninetyPlus', label: '90+' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'missingDueDate', label: 'Missing Due Date' },
];

export function AgingFilters({
  filters,
  defaultAsOfDate,
}: AgingFiltersProps) {
  return (
    <section
      className="aging-filter-panel"
      aria-label="Collection workbench filters"
    >
      <div className="aging-filter-panel-head">
        <div>
          <div className="aging-filter-title">Quick Filters</div>
          <div className="aging-filter-subtitle">
            Multi-AND filters. URL keeps the current view shareable.
          </div>
        </div>
        <label className="aging-asof-control">
          <span>As of</span>
          <input
            type="date"
            value={filters.asOfDate}
            onChange={(event) => filters.setAsOfDate(event.target.value)}
          />
        </label>
      </div>

      <div className="aging-filter-groups">
        <FilterGroup label="Currency">
          {CURRENCY_OPTIONS.map((option) => (
            <FilterButton
              key={option.value}
              label={option.label}
              active={filters.currencies.includes(option.value)}
              onClick={() => filters.toggleCurrency(option.value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Direction">
          {DIRECTION_OPTIONS.map((option) => (
            <FilterButton
              key={option.value}
              label={option.label}
              active={filters.directions.includes(option.value)}
              onClick={() => filters.toggleDirection(option.value)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="Signals">
          {SIGNAL_OPTIONS.map((option) => (
            <FilterButton
              key={option.value}
              label={option.label}
              active={filters.signals.includes(option.value)}
              onClick={() => filters.toggleSignal(option.value)}
            />
          ))}
        </FilterGroup>
      </div>

      <div className="aging-active-filter-row">
        <div className="aging-active-filter-chips">
          {filters.asOfDate !== defaultAsOfDate && (
            <button
              type="button"
              className="aging-active-filter-chip"
              onClick={() => filters.setAsOfDate(defaultAsOfDate)}
            >
              As of {filters.asOfDate} x
            </button>
          )}

          {filters.currencies.map((value) => (
            <button
              key={value}
              type="button"
              className="aging-active-filter-chip"
              onClick={() => filters.clearCurrency(value)}
            >
              {value} x
            </button>
          ))}

          {filters.directions.map((value) => (
            <button
              key={value}
              type="button"
              className="aging-active-filter-chip"
              onClick={() => filters.clearDirection(value)}
            >
              {formatDirection(value)} x
            </button>
          ))}

          {filters.signals.map((value) => (
            <button
              key={value}
              type="button"
              className="aging-active-filter-chip"
              onClick={() => filters.clearSignal(value)}
            >
              {formatSignal(value)} x
            </button>
          ))}

          {filters.activeFilterCount === 0 && (
            <span className="aging-active-filter-empty">
              No quick filters active
            </span>
          )}
        </div>

        {filters.activeFilterCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost aging-clear-filters-btn"
            onClick={filters.clearAll}
          >
            Clear all filters
          </button>
        )}
      </div>
    </section>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="aging-filter-group">
      <div className="aging-filter-group-label">{label}</div>
      <div className="aging-filter-options">{children}</div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`aging-filter-chip ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="aging-filter-chip-dot" aria-hidden="true" />
      {label}
    </button>
  );
}

function formatDirection(value: Direction) {
  switch (value) {
    case 'receivable':
      return 'AR Receivable';
    case 'payable':
      return 'AP Payable';
    case 'settled':
      return 'Settled';
  }
}

function formatSignal(value: AgingSignalFilter) {
  switch (value) {
    case 'statementDiff':
      return 'Statement Diff';
    case 'highAmount':
      return 'High Amount';
    case 'ninetyPlus':
      return '90+';
    case 'duplicate':
      return 'Duplicate';
    case 'missingDueDate':
      return 'Missing Due Date';
  }
}
