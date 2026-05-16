import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, loadC5AuthSpikeAccessToken } from '../api/client';
import type { WorkflowItemFields } from '../api/client';
import type { ParsingPreviewResult } from '../parsing-engine/types';
import type { Direction, PartyRollup } from '../selectors/agingReport';
import { selectAgingReport } from '../selectors/agingReport';
import '../styles/v2.3-aging-report.css';

type DueFilter = 'overdue' | 'today' | 'thisWeek' | 'hasPromise' | 'noPromise' | 'all';

interface WorkflowQueuePageProps {
  result: ParsingPreviewResult | null;
  onBackToDashboard?: () => void;
}

interface WorkflowQueueRow {
  workflowKey: string;
  party: PartyRollup;
  tab: 'current' | 'overdue' | 'cleared';
  workflow: WorkflowItemFields | null;
  dueBucket: DueFilter;
  isMine: boolean;
  isUnassigned: boolean;
  hasMemo: boolean;
  hasPromise: boolean;
}

interface TokenPayload {
  name?: string;
  preferred_username?: string;
}

const DUE_ORDER: Record<DueFilter, number> = {
  overdue: 0,
  today: 1,
  thisWeek: 2,
  hasPromise: 3,
  noPromise: 4,
  all: 5,
};

function decodeJwtPayload(token: string): TokenPayload {
  try {
    const [, payload] = token.split('.');
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as TokenPayload;
  } catch {
    return {};
  }
}

function dateOnly(value: string | null | undefined) {
  if (!value) return '';
  return value.includes('T') ? value.slice(0, 10) : value;
}

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function dueBucket(value: string | null | undefined): DueFilter {
  const promiseDate = dateOnly(value);
  if (!promiseDate) return 'noPromise';
  const diff = daysBetween(todayString(), promiseDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'thisWeek';
  return 'hasPromise';
}

function workflowKey(row: PartyRollup, workspaceId: string) {
  return `${workspaceId}__${row.partyKey}__${row.currency}__${row.direction}`;
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function directionLabel(value: Direction) {
  switch (value) {
    case 'receivable':
      return 'AR';
    case 'payable':
      return 'AP';
    case 'settled':
      return 'Settled';
  }
}

function normalizeOwner(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function filterValue<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

export function WorkflowQueuePage({ result, onBackToDashboard }: WorkflowQueuePageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workflowItems, setWorkflowItems] = useState<Record<string, WorkflowItemFields>>({});
  const [status, setStatus] = useState('Workflow metadata not loaded.');
  const [isStale, setIsStale] = useState(false);

  const workspaceId = result?.uploadSession?.importBatchId ?? '';
  const report = useMemo(
    () => selectAgingReport(result, result?.uploadSession?.asOfDate),
    [result],
  );
  const token = loadC5AuthSpikeAccessToken();
  const currentUserName = useMemo(() => {
    if (!token) return '';
    const payload = decodeJwtPayload(token);
    return payload.name ?? payload.preferred_username ?? '';
  }, [token]);

  const ownerFilter = filterValue(searchParams.get('owner'), ['me', 'unassigned', 'all'] as const, 'me');
  const dueFilter = filterValue(
    searchParams.get('due'),
    ['overdue', 'today', 'thisWeek', 'hasPromise', 'noPromise', 'all'] as const,
    'all',
  );
  const currencyFilter = filterValue(searchParams.get('currency'), ['USD', 'CAD', 'all'] as const, 'all');
  const directionFilter = filterValue(searchParams.get('direction'), ['receivable', 'payable', 'settled', 'all'] as const, 'all');
  const memoFilter = filterValue(searchParams.get('memo'), ['any', 'yes', 'no'] as const, 'any');
  const statusFilter = filterValue(searchParams.get('status'), ['active', 'all'] as const, 'active');

  useEffect(() => {
    if (!workspaceId) return;
    if (!token) {
      setStatus('Sign in on /spike/auth to load SharePoint workflow metadata.');
      return;
    }

    let cancelled = false;
    const cacheKey = `agingApp.workflowQueueCache.v1.${workspaceId}`;
    setStatus('Loading workflow metadata from SharePoint...');
    apiClient.readWorkflowItems(workspaceId, token)
      .then((result) => {
        if (cancelled) return;
        const next: Record<string, WorkflowItemFields> = {};
        for (const item of result.items) {
          if (item.fields.workflowKey) {
            next[item.fields.workflowKey] = item.fields;
          }
        }
        setWorkflowItems(next);
        setIsStale(false);
        setStatus(`Loaded ${result.count} workflow metadata rows from SharePoint.`);
        localStorage.setItem(cacheKey, JSON.stringify({
          fetchedAt: new Date().toISOString(),
          items: next,
        }));
      })
      .catch((err) => {
        if (cancelled) return;
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const cached = JSON.parse(raw) as { items?: Record<string, WorkflowItemFields>; fetchedAt?: string };
            setWorkflowItems(cached.items ?? {});
            setIsStale(true);
            setStatus(`Using cached workflow metadata from ${cached.fetchedAt ?? 'previous load'}.`);
            return;
          }
        } catch {
          // Keep original error below.
        }
        setStatus(err instanceof Error ? err.message : 'Workflow metadata load failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [token, workspaceId]);

  const allRows = useMemo<WorkflowQueueRow[]>(() => {
    const tabs: Array<WorkflowQueueRow['tab']> = ['overdue', 'current', 'cleared'];
    const currentOwner = normalizeOwner(currentUserName);
    return tabs.flatMap((tab) => report.tabs[tab].parties.map((party) => {
      const key = workflowKey(party, workspaceId);
      const workflow = workflowItems[key] ?? null;
      const owner = normalizeOwner(workflow?.ownerDisplayName);
      const promiseDate = dateOnly(workflow?.promiseDate);
      const promiseAmount = workflow?.promiseAmount ?? null;
      const promiseStatus = workflow?.promiseStatus ?? '';
      return {
        workflowKey: key,
        party,
        tab,
        workflow,
        dueBucket: dueBucket(promiseDate),
        isMine: Boolean(currentOwner && owner && owner === currentOwner),
        isUnassigned: !owner,
        hasMemo: Boolean(workflow?.memoText?.trim()),
        hasPromise: Boolean(promiseDate || promiseStatus || promiseAmount !== null),
      };
    }));
  }, [currentUserName, report.tabs, workflowItems, workspaceId]);

  const visibleRows = useMemo(() => allRows
    .filter((row) => {
      if (ownerFilter === 'me' && !row.isMine) return false;
      if (ownerFilter === 'unassigned' && !row.isUnassigned) return false;
      if (currencyFilter !== 'all' && row.party.currency !== currencyFilter) return false;
      if (directionFilter !== 'all' && row.party.direction !== directionFilter) return false;
      if (dueFilter !== 'all') {
        if (dueFilter === 'hasPromise' && !row.hasPromise) return false;
        else if (dueFilter !== 'hasPromise' && row.dueBucket !== dueFilter) return false;
      }
      if (memoFilter === 'yes' && !row.hasMemo) return false;
      if (memoFilter === 'no' && row.hasMemo) return false;
      if (statusFilter === 'active' && row.workflow?.promiseStatus === 'Settled') return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isMine !== b.isMine) return a.isMine ? -1 : 1;
      const dueDiff = DUE_ORDER[a.dueBucket] - DUE_ORDER[b.dueBucket];
      if (dueDiff !== 0) return dueDiff;
      return Math.abs(b.party.openAmount) - Math.abs(a.party.openAmount);
    }), [allRows, currencyFilter, directionFilter, dueFilter, memoFilter, ownerFilter, statusFilter]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    setSearchParams(next);
  }

  function resetFilters() {
    setSearchParams(new URLSearchParams({ owner: 'me', due: 'all', status: 'active' }));
  }

  if (!result || !result.details) {
    return (
      <main className="app-content workflow-queue-page">
        <div className="workflow-queue-empty">
          <div className="app-subtitle">Workflow Queue</div>
          <h2 className="empty-title">No data loaded yet</h2>
          <p className="empty-sub">
            Restore the latest server snapshot or load a local snapshot before opening the workflow queue.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Upload
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-content workflow-queue-page">
      <div className="workflow-queue-header">
        <div>
          <div className="app-subtitle">Workflow Queue</div>
          <h2 className="workflow-queue-title">Daily Collector Queue</h2>
          <div className="workflow-queue-meta">
            As of {report.asOfDate || '(unknown)'} / {workspaceId || 'no workspace'}
          </div>
        </div>
        <div className="workflow-queue-actions">
          <span className={`workflow-source-pill ${isStale ? 'stale' : 'server'}`}>
            {isStale ? 'Stale cache' : 'Server workflow'}
          </span>
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

      <section className="workflow-filter-panel">
        <div className="workflow-filter-head">
          <strong>Queue Filters</strong>
          <span>{status}</span>
        </div>
        <div className="workflow-filter-grid">
          <FilterGroup label="Owner" value={ownerFilter} options={[
            ['me', 'Me'],
            ['unassigned', 'Unassigned'],
            ['all', 'All'],
          ]} onChange={(value) => setFilter('owner', value)} />
          <FilterGroup label="Due" value={dueFilter} options={[
            ['all', 'All'],
            ['overdue', 'Overdue'],
            ['today', 'Today'],
            ['thisWeek', 'This week'],
            ['hasPromise', 'Has promise'],
            ['noPromise', 'No promise'],
          ]} onChange={(value) => setFilter('due', value)} />
          <FilterGroup label="Currency" value={currencyFilter} options={[
            ['all', 'All'],
            ['USD', 'USD'],
            ['CAD', 'CAD'],
          ]} onChange={(value) => setFilter('currency', value)} />
          <FilterGroup label="Direction" value={directionFilter} options={[
            ['all', 'All'],
            ['receivable', 'AR'],
            ['payable', 'AP'],
            ['settled', 'Settled'],
          ]} onChange={(value) => setFilter('direction', value)} />
          <FilterGroup label="Memo" value={memoFilter} options={[
            ['any', 'Any'],
            ['yes', 'Has memo'],
            ['no', 'No memo'],
          ]} onChange={(value) => setFilter('memo', value)} />
          <FilterGroup label="Status" value={statusFilter} options={[
            ['active', 'Active'],
            ['all', 'All'],
          ]} onChange={(value) => setFilter('status', value)} />
        </div>
        <button type="button" className="btn btn-ghost" onClick={resetFilters}>
          Reset filters
        </button>
      </section>

      <section className="workflow-queue-summary" aria-label="Workflow queue summary">
        <Metric label="Visible" value={visibleRows.length} />
        <Metric label="Owned by me" value={allRows.filter((row) => row.isMine).length} />
        <Metric label="Unassigned" value={allRows.filter((row) => row.isUnassigned).length} />
        <Metric label="Overdue promises" value={allRows.filter((row) => row.dueBucket === 'overdue').length} />
      </section>

      <section className="workflow-queue-table-wrap">
        <table className="workflow-queue-table">
          <thead>
            <tr>
              <th>Party</th>
              <th>Owner</th>
              <th>Promise</th>
              <th>Memo</th>
              <th>Currency</th>
              <th>Direction</th>
              <th className="num">Open Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.workflowKey}>
                <td>
                  <strong>{row.party.partyName}</strong>
                  <div className="mono muted">{row.party.partyKey}</div>
                  <div className="workflow-small-tags">
                    <span>{row.tab}</span>
                    <span>{row.party.statementStatus}</span>
                    <span>{row.party.priorityBand}</span>
                  </div>
                </td>
                <td>{row.workflow?.ownerDisplayName || <span className="muted">Unassigned</span>}</td>
                <td>
                  {row.hasPromise ? (
                    <div className="workflow-promise-cell">
                      {dateOnly(row.workflow?.promiseDate) && <strong>{dateOnly(row.workflow?.promiseDate)}</strong>}
                      {row.workflow?.promiseAmount !== null && row.workflow?.promiseAmount !== undefined && (
                        <span>{row.party.currency} {money(row.workflow.promiseAmount)}</span>
                      )}
                      {row.workflow?.promiseStatus && <span>{row.workflow.promiseStatus}</span>}
                    </div>
                  ) : (
                    <span className="muted">No promise</span>
                  )}
                </td>
                <td>{row.hasMemo ? <span className="workflow-memo-pill">Memo</span> : <span className="muted">-</span>}</td>
                <td className="mono">{row.party.currency}</td>
                <td>{directionLabel(row.party.direction)}</td>
                <td className="num">{money(row.party.openAmount)}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/party/${row.party.partyKey}`)}
                  >
                    Open Party
                  </button>
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="workflow-empty-cell">
                  No workflow queue rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="workflow-filter-group">
      <span>{label}</span>
      <div>
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            className={value === optionValue ? 'is-active' : ''}
            onClick={() => onChange(optionValue)}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="workflow-summary-cell">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}
