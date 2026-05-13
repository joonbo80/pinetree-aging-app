// components/aging/TransactionRows.tsx
//
// Expanded transaction rows for the v2.3 Statement Collection Workbench.
// Round 3 scope: read-only row details under a party rollup. No edit
// affordances, no persistence, no collection notes yet.

import type { TransactionRow } from '../../selectors/agingReport';

interface TransactionRowsProps {
  rows: TransactionRow[];
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function displayDate(row: TransactionRow) {
  return row.dueDate ?? row.invoiceDate ?? '';
}

function isStatementDifference(row: TransactionRow) {
  return (
    row.statementStatus === 'BalanceDifference' ||
    row.statementStatus === 'SettledAfterStatement'
  );
}

function transactionSignalClass(row: TransactionRow) {
  const classes = ['aging-transaction-row'];

  if (isStatementDifference(row)) {
    classes.push('signal-statement-diff');
  }
  if (row.actionReadiness === 'CheckDuplicate') {
    classes.push('signal-duplicate');
  }
  if (row.actionReadiness === 'MissingDueDate') {
    classes.push('signal-missing-due-date');
  }
  if (row.agingDays >= 90) {
    classes.push('signal-ninety-plus');
  }

  return classes.join(' ');
}

export function TransactionRows({ rows }: TransactionRowsProps) {
  if (rows.length === 0) {
    return (
      <div className="aging-rollup-empty">
        No transactions in this rollup row.
      </div>
    );
  }

  return (
    <div className="aging-transaction-panel">
      <table className="aging-transaction-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Invoice</th>
            <th>Date</th>
            <th>Aging</th>
            <th className="num">Amount</th>
            <th>Statement</th>
            <th>Readiness</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={transactionSignalClass(row)}>
              <td className="mono">
                {row.ourRefNo || row.invoiceNo || row.id}
              </td>
              <td className="mono">{row.invoiceNo || '-'}</td>
              <td className="mono">{displayDate(row) || '-'}</td>
              <td>
                <span className="aging-transaction-aging">
                  <span>{row.agingDays}d</span>
                  <small>{row.agingBucket || '-'}</small>
                </span>
              </td>
              <td className="num">
                <span
                  className={
                    row.signedBalance < 0
                      ? 'amount-neg'
                      : row.signedBalance > 0
                        ? 'amount-pos'
                        : 'amount-zero'
                  }
                >
                  {money(row.signedBalance)}
                </span>
              </td>
              <td>
                <span className={`aging-mini-badge statement-${row.statementStatus}`}>
                  {formatStatementStatus(row.statementStatus)}
                </span>
              </td>
              <td>
                <span className={`aging-mini-badge readiness-${row.actionReadiness}`}>
                  {formatActionReadiness(row.actionReadiness)}
                </span>
              </td>
              <td className="aging-transaction-source">
                {row.sourceFile}:{row.sourceRow}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatStatementStatus(value: TransactionRow['statementStatus']) {
  switch (value) {
    case 'ExactMatch':
      return 'Exact Match';
    case 'BalanceDifference':
      return 'Balance Difference';
    case 'SettledAfterStatement':
      return 'Settled After Statement';
    case 'NoStatement':
      return 'No Statement';
  }
}

function formatActionReadiness(value: TransactionRow['actionReadiness']) {
  switch (value) {
    case 'ReadyToFollowUp':
      return 'Ready to Follow Up';
    case 'ReviewStatementDifference':
      return 'Review Statement Difference';
    case 'MissingDueDate':
      return 'Missing Due Date';
    case 'CheckDuplicate':
      return 'Check Duplicate';
    case 'Cleared':
      return 'Cleared';
  }
}
