// components/aging/PartyRollupTable.tsx
//
// Party rollup table for the v2.3 Statement Collection Workbench.
// Round 3 scope: read-only party rows, expand/collapse transaction
// rows, and a link to the existing Party Detail page.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, loadC5AuthSpikeAccessToken } from '../../api/client';
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
  workspaceId: string;
}

interface WorkflowMetadataSummary {
  ownerDisplayName: string;
  memoText: string;
  promiseDate: string;
  promiseAmount: number | null;
  promiseStatus: string;
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

function signedMoney(value: number, currency: string) {
  const sign = value < 0 ? '-' : '';
  return `${currency} ${sign}${money(Math.abs(value))}`;
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

export function PartyRollupTable({ tabId, data, workspaceId }: PartyRollupTableProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [workflowSummaries, setWorkflowSummaries] = useState<Record<string, WorkflowMetadataSummary>>({});

  const rows = useMemo(() => data.parties, [data.parties]);

  useEffect(() => {
    const token = loadC5AuthSpikeAccessToken();
    if (!token || !workspaceId) return;

    let cancelled = false;
    apiClient.readWorkflowItems(workspaceId, token)
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, WorkflowMetadataSummary> = {};
        for (const item of result.items) {
          const key = item.fields.workflowKey;
          if (!key) continue;
          next[key] = {
            ownerDisplayName: item.fields.ownerDisplayName ?? '',
            memoText: item.fields.memoText ?? '',
            promiseDate: item.fields.promiseDate ?? '',
            promiseAmount: item.fields.promiseAmount ?? null,
            promiseStatus: item.fields.promiseStatus ?? '',
          };
        }
        setWorkflowSummaries((prev) => ({ ...prev, ...next }));
      })
      .catch(() => {
        // Keep the table usable when workflow metadata is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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

  function updateWorkflowSummary(key: string, summary: WorkflowMetadataSummary) {
    setWorkflowSummaries((prev) => ({
      ...prev,
      [key]: summary,
    }));
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
            const key = workflowKey(row, workspaceId);
            const isExpanded = expanded.has(id);
            const detailId = `aging-rollup-detail-${id}`;
            const chips = signalChips(row);
            const workflowSummary = workflowSummaries[key];
            const hasOwner = Boolean(workflowSummary?.ownerDisplayName.trim());
            const hasMemo = Boolean(workflowSummary?.memoText.trim());
            const hasPromise = Boolean(
              workflowSummary?.promiseDate.trim() ||
              workflowSummary?.promiseStatus.trim() ||
              workflowSummary?.promiseAmount !== null && workflowSummary?.promiseAmount !== undefined,
            );

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
                    {(hasOwner || hasMemo) && (
                      <div
                        className="aging-workflow-chip-cluster"
                        aria-label={`Workflow notes for ${row.partyName}`}
                      >
                        {hasOwner && (
                          <span className="aging-workflow-chip owner">
                            Owner: {workflowSummary.ownerDisplayName}
                          </span>
                        )}
                        {hasMemo && (
                          <span className="aging-workflow-chip memo">
                            Memo
                          </span>
                        )}
                        {hasPromise && (
                          <span className="aging-workflow-chip promise">
                            {promiseBadgeLabel(workflowSummary)}
                          </span>
                        )}
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
                      <WorkflowLitePanel
                        row={row}
                        workspaceId={workspaceId}
                        onMetadataChange={(summary) => updateWorkflowSummary(key, summary)}
                      />
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

function workflowKey(row: PartyRollup, workspaceId: string) {
  return `${workspaceId}__${row.partyKey}__${row.currency}__${row.direction}`;
}

function promiseBadgeLabel(summary: WorkflowMetadataSummary) {
  if (summary.promiseDate) {
    return `Promise: ${summary.promiseDate}`;
  }
  if (summary.promiseStatus) {
    return `Promise: ${summary.promiseStatus}`;
  }
  if (summary.promiseAmount !== null && summary.promiseAmount !== undefined) {
    return `Promise: ${money(summary.promiseAmount)}`;
  }
  return 'Promise';
}

function emailSubject(row: PartyRollup) {
  return `Statement follow-up - ${row.partyName} - ${row.currency} ${formatDirection(row.direction)}`;
}

function emailBody(row: PartyRollup, summary: WorkflowMetadataSummary) {
  const lines = [
    `Hello ${row.partyName},`,
    '',
    'I am following up on the open statement balance below.',
    '',
    `Party: ${row.partyName}`,
    `Currency: ${row.currency}`,
    `Direction: ${formatDirection(row.direction)}`,
    `Open amount: ${signedMoney(row.openAmount, row.currency)}`,
    `Invoice count: ${row.invoiceCount}`,
    `Oldest aging: ${row.oldestAgingDays} days`,
    `Statement status: ${formatStatementStatus(row.statementStatus)}`,
  ];

  if (summary.promiseDate || summary.promiseAmount !== null || summary.promiseStatus) {
    lines.push('', 'Promise tracking:');
    if (summary.promiseDate) lines.push(`- Date: ${summary.promiseDate}`);
    if (summary.promiseAmount !== null) lines.push(`- Amount: ${signedMoney(summary.promiseAmount, row.currency)}`);
    if (summary.promiseStatus) lines.push(`- Status: ${summary.promiseStatus}`);
  }

  if (summary.memoText.trim()) {
    lines.push('', 'Internal memo context:', summary.memoText.trim());
  }

  lines.push('', 'Please confirm the expected payment or advise if your records differ.', '', 'Thank you,');
  return lines.join('\n');
}

function mailtoUrl(subject: string, body: string) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function WorkflowLitePanel({
  row,
  workspaceId,
  onMetadataChange,
}: {
  row: PartyRollup;
  workspaceId: string;
  onMetadataChange: (summary: WorkflowMetadataSummary) => void;
}) {
  const key = workflowKey(row, workspaceId);
  const [owner, setOwner] = useState('');
  const [memo, setMemo] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [promiseStatus, setPromiseStatus] = useState('');
  const [status, setStatus] = useState('Not loaded');
  const [draftStatus, setDraftStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const workflowSummary: WorkflowMetadataSummary = {
    ownerDisplayName: owner,
    memoText: memo,
    promiseDate,
    promiseAmount: promiseAmount.trim() ? Number(promiseAmount) : null,
    promiseStatus,
  };
  const draftSubject = emailSubject(row);
  const draftBody = emailBody(row, workflowSummary);

  useEffect(() => {
    const token = loadC5AuthSpikeAccessToken();
    if (!token || !workspaceId) {
      setStatus('Sign in on /spike/auth to sync owner and memo.');
      return;
    }
    let cancelled = false;
    setStatus('Loading workflow metadata...');
    apiClient.readWorkflowItem(key, token)
      .then((result) => {
        if (cancelled) return;
        const nextOwner = result.item?.fields.ownerDisplayName ?? '';
        const nextMemo = result.item?.fields.memoText ?? '';
        const nextPromiseDate = result.item?.fields.promiseDate ?? '';
        const nextPromiseAmount = result.item?.fields.promiseAmount ?? null;
        const nextPromiseStatus = result.item?.fields.promiseStatus ?? '';
        setOwner(nextOwner);
        setMemo(nextMemo);
        setPromiseDate(nextPromiseDate);
        setPromiseAmount(nextPromiseAmount === null ? '' : String(nextPromiseAmount));
        setPromiseStatus(nextPromiseStatus);
        onMetadataChange({
          ownerDisplayName: nextOwner,
          memoText: nextMemo,
          promiseDate: nextPromiseDate,
          promiseAmount: nextPromiseAmount,
          promiseStatus: nextPromiseStatus,
        });
        setStatus(result.found ? 'Loaded from SharePoint.' : 'No workflow note yet.');
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : 'Workflow metadata load failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [key, workspaceId]);

  const save = async () => {
    const token = loadC5AuthSpikeAccessToken();
    if (!token) {
      setStatus('Sign in on /spike/auth first.');
      return;
    }
    setBusy(true);
    setStatus('Saving workflow metadata...');
    try {
      const result = await apiClient.writeWorkflowItem({
        workspaceId,
        workflowKey: key,
        partyKey: row.partyKey,
        partyName: row.partyName,
        currency: row.currency,
        direction: formatDirection(row.direction),
        ownerDisplayName: owner,
        memoText: memo,
        promiseDate,
        promiseAmount: promiseAmount.trim() ? Number(promiseAmount) : null,
        promiseStatus,
      }, token);
      const nextOwner = result.item?.fields.ownerDisplayName ?? owner;
      const nextMemo = result.item?.fields.memoText ?? memo;
      const nextPromiseDate = result.item?.fields.promiseDate ?? promiseDate;
      const nextPromiseAmount = result.item?.fields.promiseAmount ?? (promiseAmount.trim() ? Number(promiseAmount) : null);
      const nextPromiseStatus = result.item?.fields.promiseStatus ?? promiseStatus;
      setOwner(nextOwner);
      setMemo(nextMemo);
      setPromiseDate(nextPromiseDate);
      setPromiseAmount(nextPromiseAmount === null ? '' : String(nextPromiseAmount));
      setPromiseStatus(nextPromiseStatus);
      onMetadataChange({
        ownerDisplayName: nextOwner,
        memoText: nextMemo,
        promiseDate: nextPromiseDate,
        promiseAmount: nextPromiseAmount,
        promiseStatus: nextPromiseStatus,
      });
      setStatus('Saved to SharePoint.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Workflow metadata save failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyDraft = async () => {
    const content = `Subject: ${draftSubject}\n\n${draftBody}`;
    try {
      await navigator.clipboard.writeText(content);
      setDraftStatus('Draft copied.');
    } catch {
      setDraftStatus('Copy failed. Select and copy the draft manually.');
    }
  };

  const openEmailDraft = () => {
    window.location.href = mailtoUrl(draftSubject, draftBody);
    setDraftStatus('Email draft opened.');
  };

  return (
    <div className="aging-workflow-lite">
      <div className="aging-workflow-lite-header">
        <strong>Owner / Memo / Promise</strong>
        <span>{status}</span>
      </div>
      <div className="aging-workflow-lite-fields">
        <label>
          <span>Owner</span>
          <input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner name" />
        </label>
        <label>
          <span>Promise Date</span>
          <input type="date" value={promiseDate} onChange={(event) => setPromiseDate(event.target.value)} />
        </label>
        <label>
          <span>Promise Amount</span>
          <input
            type="number"
            step="0.01"
            value={promiseAmount}
            onChange={(event) => setPromiseAmount(event.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          <span>Promise Status</span>
          <select value={promiseStatus} onChange={(event) => setPromiseStatus(event.target.value)}>
            <option value="">None</option>
            <option value="Open">Open</option>
            <option value="FollowUp">Follow Up</option>
            <option value="Paid">Paid</option>
            <option value="Broken">Broken</option>
          </select>
        </label>
        <label className="aging-workflow-memo-field">
          <span>Memo</span>
          <textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Collection note" rows={2} />
        </label>
        <button type="button" className="btn btn-secondary" disabled={busy || !workspaceId} onClick={save}>
          Save
        </button>
      </div>
      <div className="aging-email-draft-lite">
        <div className="aging-email-draft-head">
          <strong>Email Draft</strong>
          <span>{draftStatus || 'Review before sending. No automatic email is sent.'}</span>
        </div>
        <label>
          <span>Subject</span>
          <input value={draftSubject} readOnly />
        </label>
        <label>
          <span>Body</span>
          <textarea value={draftBody} readOnly rows={9} />
        </label>
        <div className="aging-email-draft-actions">
          <button type="button" className="btn btn-ghost" onClick={copyDraft}>
            Copy Draft
          </button>
          <button type="button" className="btn btn-secondary" onClick={openEmailDraft}>
            Open Email Draft
          </button>
        </div>
      </div>
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
