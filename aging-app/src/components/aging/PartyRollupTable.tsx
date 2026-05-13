// components/aging/PartyRollupTable.tsx
//
// Party rollup table for the v2.3 Statement Collection Workbench.
// Round 3 scope: read-only party rows, expand/collapse transaction
// rows, and a link to the existing Party Detail page.

import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AgingTabData,
  PartyRollup,
  PriorityBand,
  StatementStatus,
  ActionReadiness,
  Direction,
} from '../../selectors/agingReport';
import { TransactionRows } from './TransactionRows';

interface PartyRollupTableProps {
  tabId: 'current' | 'overdue' | 'cleared';
  data: AgingTabData;
}

const PRIORITY_CLASS: Record<PriorityBand, string> = {
  ReviewFirst: 'priority-review-first',
  FollowUp: 'priority-follow-up',
  Monitor: 'priority-monitor',
  Cleared: 'priority-cleared',
};

const HIGH_AMOUNT_THRESHOLD = 10000;

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rollupId(row: PartyRollup) {
  return `${row.partyKey}__${row.currency}__${row.direction}`;
}

function isStatementDifference(value: StatementStatus) {
  return value === 'BalanceDifference' || value === 'SettledAfterStatement';
}

function rollupSignalClasses(row: PartyRollup) {
  const classes = ['aging-rollup-row', PRIORITY_CLASS[row.priorityBand]];

  if (isStatementDifference(row.statementStatus)) {
    classes.push('signal-statement-diff');
  }
  if (Math.abs(row.openAmount) >= HIGH_AMOUNT_THRESHOLD) {
    classes.push('signal-high-amount');
  }
  if (row.ninetyPlusCount > 0) {
    classes.push('signal-ninety-plus');
  }
  if (row.actionReadiness === 'CheckDuplicate') {
    classes.push('signal-duplicate');
  }
  if (row.actionReadiness === 'MissingDueDate') {
    classes.push('signal-missing-due-date');
  }

  return classes.join(' ');
}

function signalChips(row: PartyRollup) {
  const chips: Array<{ key: string; label: string; className: string }> = [];

  if (isStatementDifference(row.statementStatus)) {
    chips.push({
      key: 'statement-diff',
      label: 'Statement Diff',
      className: 'statement-diff',
    });
  }
  if (row.actionReadiness === 'CheckDuplicate') {
    chips.push({
      key: 'duplicate',
      label: 'Duplicate',
      className: 'duplicate',
    });
  }
  if (row.actionReadiness === 'MissingDueDate') {
    chips.push({
      key: 'missing-due-date',
      label: 'Missing Due Date',
      className: 'missing-due-date',
    });
  }
  if (row.ninetyPlusCount > 0) {
    chips.push({
      key: 'ninety-plus',
      label: `${row.ninetyPlusCount} 90+`,
      className: 'ninety-plus',
    });
  }
  if (Math.abs(row.openAmount) >= HIGH_AMOUNT_THRESHOLD) {
    chips.push({
      key: 'high-amount',
      label: 'High Amount',
      className: 'high-amount',
    });
  }

  return chips;
}

export function PartyRollupTable({ tabId, data }: PartyRollupTableProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => data.parties, [data.parties]);

  if (rows.length === 0) {
    return (
      <div className="aging-tab-empty">
        <p>No {tabId} party rollups in scope.</p>
      </div>
    );
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="aging-rollup-table-wrap">
      <table className="aging-rollup-table">
        <thead>
          <tr>
            <th className="aging-rollup-toggle-col">Details</th>
            <th>Party</th>
            <th>Currency</th>
            <th>Direction</th>
            <th className="num">Amount</th>
            <th className="num">Invoices</th>
            <th className="num">Oldest</th>
            <th>Statement</th>
            <th>Readiness</th>
            <th>Priority</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rollupId(row);
            const isExpanded = expanded.has(id);
            const detailId = `aging-rollup-detail-${id}`;
            const chips = signalChips(row);

            return (
              <Fragment key={id}>
                <tr className={rollupSignalClasses(row)}>
                  <td className="aging-rollup-toggle-col">
                    <button
                      type="button"
                      className="aging-row-toggle"
                      aria-expanded={isExpanded}
                      aria-controls={detailId}
                      onClick={() => toggle(id)}
                    >
                      <span aria-hidden="true">
                        {isExpanded ? 'v' : '>'}
                      </span>
                      <span className="sr-only">
                        {isExpanded ? 'Collapse' : 'Expand'} {row.partyName}
                      </span>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="aging-party-name-btn"
                      onClick={() => toggle(id)}
                    >
                      {row.partyName}
                    </button>
                    <div className="aging-party-key mono">
                      {row.partyKey}
                    </div>
                    {chips.length > 0 && (
                      <div
                        className="aging-signal-cluster"
                        aria-label={`Signals for ${row.partyName}`}
                      >
                        {chips.map((chip) => (
                          <span
                            key={chip.key}
                            className={`aging-signal-chip ${chip.className}`}
                          >
                            {chip.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="mono">{row.currency}</td>
                  <td>
                    <span className={`aging-direction-pill ${row.direction}`}>
                      {formatDirection(row.direction)}
                    </span>
                  </td>
                  <td className="num">
                    <span
                      className={
                        row.openAmount < 0
                          ? 'amount-neg'
                          : row.openAmount > 0
                            ? 'amount-pos'
                            : 'amount-zero'
                      }
                    >
                      {money(row.openAmount)}
                    </span>
                  </td>
                  <td className="num">{row.invoiceCount}</td>
                  <td className="num">
                    {row.oldestAgingDays}d
                    {row.ninetyPlusCount > 0 && (
                      <span className="aging-ninety-chip">
                        {row.ninetyPlusCount} 90+
                      </span>
                    )}
                  </td>
                  <td>{statementBadge(row.statementStatus)}</td>
                  <td>{readinessBadge(row.actionReadiness)}</td>
                  <td>{priorityBadge(row.priorityBand)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost aging-party-open-btn"
                      onClick={() => navigate(`/party/${row.partyKey}`)}
                    >
                      Open Party Detail
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr
                    id={detailId}
                    className="aging-rollup-detail-row"
                  >
                    <td colSpan={11}>
                      <TransactionRows rows={row.transactions} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDirection(value: Direction) {
  switch (value) {
    case 'receivable':
      return 'Receivable';
    case 'payable':
      return 'Payable';
    case 'settled':
      return 'Settled';
  }
}

function statementBadge(value: StatementStatus) {
  return (
    <span className={`aging-badge statement-${value}`}>
      {formatStatementStatus(value)}
    </span>
  );
}

function readinessBadge(value: ActionReadiness) {
  return (
    <span className={`aging-badge readiness-${value}`}>
      {formatActionReadiness(value)}
    </span>
  );
}

function priorityBadge(value: PriorityBand) {
  return (
    <span className={`aging-badge ${PRIORITY_CLASS[value]}`}>
      {formatPriorityBand(value)}
    </span>
  );
}

function formatStatementStatus(value: StatementStatus) {
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

function formatActionReadiness(value: ActionReadiness) {
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

function formatPriorityBand(value: PriorityBand) {
  switch (value) {
    case 'ReviewFirst':
      return 'Review First';
    case 'FollowUp':
      return 'Follow Up';
    case 'Monitor':
      return 'Monitor';
    case 'Cleared':
      return 'Cleared';
  }
}
