// components/aging/agingFilterLogic.ts
//
// Pure filtering helpers for Round 5. Kept outside the TSX component so
// invariant tests can import the production filter logic directly.

import type { AgingFilterState } from '../../hooks/useAgingFilters';
import type { AgingTabData, PartyRollup } from '../../selectors/agingReport';

export function filterAgingTabData(
  data: AgingTabData,
  filters: AgingFilterState,
): AgingTabData {
  if (
    filters.currencies.length === 0 &&
    filters.directions.length === 0 &&
    filters.signals.length === 0
  ) {
    return data;
  }

  const parties = data.parties.filter((row) =>
    matchesAllFilters(row, filters),
  );

  return {
    ...data,
    parties,
    transactionCount: parties.reduce(
      (sum, row) => sum + row.transactions.length,
      0,
    ),
    totals: parties.reduce(
      (totals, row) => {
        if (row.direction === 'receivable') {
          totals[row.currency].receivable += row.openAmount;
        } else if (row.direction === 'payable') {
          totals[row.currency].payable += row.openAmount;
        }
        return totals;
      },
      {
        USD: { receivable: 0, payable: 0 },
        CAD: { receivable: 0, payable: 0 },
      },
    ),
  };
}

function matchesAllFilters(
  row: PartyRollup,
  filters: AgingFilterState,
) {
  if (
    filters.currencies.length > 0 &&
    !filters.currencies.includes(row.currency)
  ) {
    return false;
  }

  if (
    filters.directions.length > 0 &&
    !filters.directions.includes(row.direction)
  ) {
    return false;
  }

  return filters.signals.every((signal) => {
    switch (signal) {
      case 'statementDiff':
        return (
          row.statementStatus === 'BalanceDifference' ||
          row.statementStatus === 'SettledAfterStatement'
        );
      case 'highAmount':
        return Math.abs(row.openAmount) >= 10000;
      case 'ninetyPlus':
        return row.ninetyPlusCount > 0;
      case 'duplicate':
        return row.actionReadiness === 'CheckDuplicate';
      case 'missingDueDate':
        return row.actionReadiness === 'MissingDueDate';
    }
  });
}
