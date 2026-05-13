// components/aging/NoDueDateCallout.tsx
//
// Pinned call-out above the workbench tabs. Spec Decision 4:
// only OPEN transactions without dueDate (isZeroBalance=false)
// surface here. Settled-but-no-dueDate rows route to Cleared.
//
// Round 2 renders the call-out as a static banner. Round 5 will
// wire up filter-chip toggling to highlight or filter the
// underlying rows; Round 3 surfaces the row-level navigation.

interface NoDueDateCalloutProps {
  openCount: number;
  totals: { USD: number; CAD: number };
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function NoDueDateCallout({
  openCount,
  totals,
}: NoDueDateCalloutProps) {
  // Hide call-out entirely when there are no open no-dueDate items
  // (spec Section 3.9 empty-state rule).
  if (openCount === 0) return null;

  return (
    <div
      className="aging-no-due-date-callout"
      role="region"
      aria-label="No Due Date open items"
    >
      <div className="aging-callout-title">
        No Due Date (open): {openCount} item{openCount === 1 ? '' : 's'}
      </div>
      <div className="aging-callout-totals">
        <span className="aging-callout-currency">
          USD {money(totals.USD)}
        </span>
        <span className="aging-callout-currency">
          CAD {money(totals.CAD)}
        </span>
      </div>
      <div className="aging-callout-hint">
        Review required before aging classification. These rows are
        not silently assigned to Current or Overdue.
      </div>
    </div>
  );
}
