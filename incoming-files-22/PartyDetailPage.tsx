// components/party/PartyDetailPage.tsx
//
// Phase 2 v2.2 Step 4-5 — header + summary cards + tab scaffolding.
// Tab content arrives in Steps 6-9. This file is the landing shell
// users see when they click a /party/:partyKey link.
//
// Architecture: PartyDetailPage is a pure render of selectPartyDetail()
// output plus minimal local UI state (active tab, filters). No data
// shaping happens here.
//
// Spec references:
//   §"Header"             — title, key, dept, status, currency totals
//   §"Summary Cards"      — 6 cards, each clickable to switch tab
//   §"Tabs"               — 4 tabs scaffolded; content in Steps 6-9
//   §"Empty States"       — unknown party + statement-only + null result
//   §"Schema 1.0"         — graceful "details unavailable" notice
//   §"Accessibility"      — Tab/Enter/Esc + ArrowLeft/Right tablist
//   §D1                   — default tab is Transactions
//   §D5                   — USD/CAD never summed

import type React from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  ParsingPreviewResult,
  PartyDetail,
  PartyStatus,
  PreviewTransaction,
  DuplicateGroupDetail,
} from '../../parsing-engine/types';
import { selectPartyDetail } from '../../selectors/partyDetail';

interface PartyDetailPageProps {
  result: ParsingPreviewResult | null;
}

type ActiveTab = 'transactions' | 'statements' | 'reviews' | 'duplicates';

// Spec D1: default tab is Transactions, not context-aware.
const DEFAULT_TAB: ActiveTab = 'transactions';

// ============================================================
// Formatting helpers
// ============================================================

function formatMoney(value: number): string {
  // Same formatting style as Dashboard: 2 decimal places, thousands sep
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedMoney(value: number): string {
  // Negative numbers keep their sign visible; positive numbers don't
  // get a "+" prefix (accounting convention).
  return formatMoney(value);
}

// Department code → human label, mirroring Dashboard's existing convention.
const DEPT_LABELS: Record<string, string> = {
  OI: 'OI Ocean Import',
  OO: 'OO Ocean Export',
  AI: 'AI Air Import',
  AO: 'AO Air Export',
  GE: 'GE General',
  UNKNOWN: 'Unknown',
};

function deptLabel(code: string | null): string {
  if (!code) return 'Unknown';
  return DEPT_LABELS[code] ?? code;
}

// ============================================================
// Page component
// ============================================================

export function PartyDetailPage({ result }: PartyDetailPageProps) {
  const navigate = useNavigate();
  const { partyKey: rawPartyKey } = useParams<{ partyKey: string }>();
  const partyKey = rawPartyKey ?? '';

  const [activeTab, setActiveTab] = useState<ActiveTab>(DEFAULT_TAB);
  // Step 7: cross-tab focus state.
  // When user clicks an "ERP match" cell in Statements tab, we record
  // the matched transaction id here AND switch tab. The Transactions
  // tab observes this and:
  //   1. Temporarily relaxes the OPEN filter to ALL (so a settled tx
  //      target row is not hidden — reviewer P1 #3)
  //   2. Scrolls focused row into view
  //   3. Flashes a highlight class for ~1.5s
  //   4. After expiry the focus state clears but the user-visible
  //      Direction filter remains at the value the user explicitly
  //      had set, so a single focus action doesn't permanently change
  //      their filter selection.
  const [focusedTxId, setFocusedTxId] = useState<string | null>(null);
  const focusTransaction = (txId: string | null) => {
    setFocusedTxId(txId);
    if (txId) setActiveTab('transactions');
  };

  // Compute selector output once per render. The selector is fast
  // (<10ms even on the largest party) so memoization is mostly for
  // referential stability of the returned arrays.
  const detail = useMemo(
    () => selectPartyDetail(partyKey, result),
    [partyKey, result],
  );

  // ----------------------------------------------------------
  // No data loaded yet (result === null)
  // ----------------------------------------------------------
  // Per mainline absorption boundary fix: a null result is semantically
  // distinct from "unknown party". User came to /party/X without
  // loading the upload first.
  if (!result) {
    return (
      <main className="app-content">
        <div className="app-subtitle">Phase 2 v2.2 · Party Detail</div>
        <section className="placeholder-panel">
          <h2 className="dashboard-title">No data loaded yet</h2>
          <p className="empty-sub">
            Open a parsing preview before viewing party details. Use the
            Upload Preview screen or load the bundled baseline demo.
          </p>
          <div className="placeholder-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              Upload Preview
            </button>
            <button type="button" className="btn" onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // Schema 1.0 / details unavailable
  // ----------------------------------------------------------
  // Result loaded but lacks `details` — this is a v1.0 schema payload.
  // Distinct from "no data loaded" above, distinct from "unknown party"
  // below.
  if (!result.details) {
    return (
      <main className="app-content">
        <div className="app-subtitle">Phase 2 v2.2 · Party Detail</div>
        <section className="placeholder-panel">
          <h2 className="dashboard-title">{partyKey || 'Party'}</h2>
          <p className="empty-sub">
            Drill-down details are unavailable on this server&rsquo;s payload (schema 1.0).
            The summary dashboard is available; per-party detail requires a schema 1.1 payload.
          </p>
          <div className="placeholder-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // Unknown party (selector returns empty arrays for any reason)
  // ----------------------------------------------------------
  // Per spec D6 + §"Empty States":
  //   Truly unknown:        all 4 collections empty.
  //   Statement-only:       transactions empty BUT statementLinks non-empty.
  // We render unknown only for the truly empty case.
  const isUnknown =
    detail.transactions.length === 0 &&
    detail.statementLinks.length === 0 &&
    detail.reviewItems.length === 0 &&
    detail.duplicateGroups.length === 0;

  if (isUnknown) {
    return (
      <main className="app-content">
        <div className="app-subtitle">Phase 2 v2.2 · Party Detail</div>
        <section className="placeholder-panel">
          <h2 className="dashboard-title">{detail.partyName}</h2>
          <p className="empty-sub">
            <span className="party-key-mono">{partyKey}</span>
          </p>
          <p className="empty-sub">
            No data for this party. It does not appear in any transactions,
            statements, or review items.
          </p>
          <div className="placeholder-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
            <button type="button" className="btn" onClick={() => navigate('/')}>
              Upload Preview
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ----------------------------------------------------------
  // Real party render
  // ----------------------------------------------------------
  return (
    <main className="app-content">
      <div className="app-subtitle">Phase 2 v2.2 · Party Detail</div>

      <PartyHeader detail={detail} onBack={() => navigate(-1)} />

      <PartySummaryCards detail={detail} onCardClick={setActiveTab} />

      <PartyTabs
        detail={detail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        focusedTxId={focusedTxId}
        onFocusTransaction={focusTransaction}
      />
    </main>
  );
}

// ============================================================
// Tabs sub-component (Step 5 — scaffolding only)
// ============================================================
//
// Renders the tab navigation strip + the active panel shell. Each panel
// is a TabPanel placeholder until Steps 6-9 fill them in.
//
// Spec references:
//   §"Tabs"   — 4 tabs (Transactions / Statements / Reviews / Duplicates)
//   §D1       — default tab is Transactions (handled by parent)
//   §"Empty States" — Duplicates tab still shown when 0 groups
//   §"Accessibility" — Tab/Enter/Esc, real button elements

interface TabSpec {
  key: ActiveTab;
  label: string;
  count: number;          // shown next to label as "Reviews (12)"
}

function PartyTabs({
  detail,
  activeTab,
  onTabChange,
  focusedTxId,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  focusedTxId: string | null;
  onFocusTransaction: (txId: string | null) => void;
}) {
  // Tab order is fixed and must match spec §"Tabs" listing order.
  // Counts come straight from selector (single source of truth).
  const tabs: TabSpec[] = [
    { key: 'transactions', label: 'Transactions', count: detail.transactions.length },
    { key: 'statements',   label: 'Statements',   count: detail.statementLinks.length },
    { key: 'reviews',      label: 'Reviews',      count: detail.reviewItems.length },
    { key: 'duplicates',   label: 'Duplicates',   count: detail.duplicateGroups.length },
  ];

  return (
    <section className="party-tabs">
      <PartyTabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <PartyTabPanel
        detail={detail}
        activeTab={activeTab}
        focusedTxId={focusedTxId}
        onFocusTransaction={onFocusTransaction}
      />
    </section>
  );
}

function PartyTabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabSpec[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}) {
  // Keyboard: Tab navigates between buttons, Enter/Space activates,
  // ArrowLeft/Right cycles within the tablist (WAI-ARIA pattern).
  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + dir + tabs.length) % tabs.length;
      onTabChange(tabs[next].key);
      // Move focus too, so keyboard users see the next tab activate
      const buttons = (e.currentTarget.parentElement?.querySelectorAll('button[role="tab"]')) ?? [];
      (buttons[next] as HTMLButtonElement | undefined)?.focus();
    }
  };

  return (
    <div className="party-tab-bar" role="tablist" aria-label="Party detail sections">
      {tabs.map((tab, idx) => {
        const selected = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`party-tabpanel-${tab.key}`}
            id={`party-tab-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            className={'party-tab' + (selected ? ' party-tab-active' : '')}
            onClick={() => onTabChange(tab.key)}
            onKeyDown={e => handleKey(e, idx)}
          >
            <span className="party-tab-label">{tab.label}</span>
            <span className="party-tab-count" aria-hidden="true">{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function PartyTabPanel({
  detail,
  activeTab,
  focusedTxId,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  activeTab: ActiveTab;
  focusedTxId: string | null;
  onFocusTransaction: (txId: string | null) => void;
}) {
  // The panel container is consistent across tabs so Steps 6-9 can each
  // implement a TabContent component with its own header / filters /
  // table / footer without re-reasoning about the outer shell.
  //
  // Spec §"Tabs" sketches the per-tab content. Steps 6-9 will replace
  // the placeholder children below.
  return (
    <div
      role="tabpanel"
      id={`party-tabpanel-${activeTab}`}
      aria-labelledby={`party-tab-${activeTab}`}
      className="party-tab-panel"
      tabIndex={0}
    >
      {activeTab === 'transactions' && (
        <TransactionsTabPlaceholder
          detail={detail}
          focusedTxId={focusedTxId}
          onClearFocus={() => onFocusTransaction(null)}
        />
      )}
      {activeTab === 'statements'   && (
        <StatementsTab detail={detail} onFocusTransaction={onFocusTransaction} />
      )}
      {activeTab === 'reviews'      && (
        <ReviewsTabPlaceholder detail={detail} onFocusTransaction={onFocusTransaction} />
      )}
      {activeTab === 'duplicates'   && (
        <DuplicatesTabPlaceholder detail={detail} onFocusTransaction={onFocusTransaction} />
      )}
    </div>
  );
}

// ============================================================
// Tab placeholders (Step 5 — Steps 6-9 replace these)
// ============================================================
//
// Each placeholder shows the count and a stub message. They use the
// real selector data so Step 5 verification can check that the right
// detail subset is being routed to each tab.

function TabPlaceholder({
  title,
  count,
  unit,
  emptyMessage,
}: {
  title: string;
  count: number;
  unit: string;
  emptyMessage?: string;
}) {
  return (
    <div className="party-tab-content-placeholder">
      <h3 className="empty-title">{title}</h3>
      {count === 0 && emptyMessage ? (
        <p className="empty-sub">{emptyMessage}</p>
      ) : (
        <p className="empty-sub">
          {count} {unit}. Tab content arrives in v2.2 Step{' '}
          {title === 'Transactions' ? '6' :
           title === 'Statements'   ? '7' :
           title === 'Reviews'      ? '8' : '9'}.
        </p>
      )}
    </div>
  );
}

function TransactionsTabPlaceholder({
  detail,
  focusedTxId,
  onClearFocus,
}: {
  detail: PartyDetail;
  focusedTxId: string | null;
  onClearFocus: () => void;
}) {
  // Statement-only parties: spec §"Empty States" wants this exact copy.
  if (detail.transactions.length === 0 && detail.statementLinks.length > 0) {
    return (
      <TabPlaceholder
        title="Transactions"
        count={0}
        unit="transactions"
        emptyMessage="No ERP transactions found. This party only appears in statement files."
      />
    );
  }
  // Step 6: real Transactions tab
  if (detail.transactions.length > 0) {
    return <TransactionsTab detail={detail} focusedTxId={focusedTxId} onClearFocus={onClearFocus} />;
  }
  return <TabPlaceholder title="Transactions" count={0} unit="transactions" />;
}

// ============================================================
// Step 6 — Transactions tab content
// ============================================================
//
// Spec §"Tabs" → "Transactions":
//   Columns: Type / Direction / Currency / Amount / Aging / Date / Ref / Source
//   Default sort: aging desc, amount desc
//   Inline trace expansion on row click

type TxCurrencyFilter = 'ALL' | 'USD' | 'CAD';
// 'OPEN' = receivable + payable (excludes settled). This is the
// actionable view for AR/AP work and is the Party Detail default per
// reviewer's UX call: accountants opening Party Detail want to see
// outstanding balances first, not historic settled rows.
type TxDirectionFilter = 'ALL' | 'OPEN' | 'receivable' | 'payable' | 'settled';
type TxSortMode =
  | 'aging-desc'         // default per spec
  | 'amount-desc'
  | 'amount-asc'
  | 'date-desc'
  | 'date-asc'
  | 'source-row-asc';

function TransactionsTab({
  detail,
  focusedTxId,
  onClearFocus,
}: {
  detail: PartyDetail;
  focusedTxId: string | null;
  onClearFocus: () => void;
}) {
  const [currency, setCurrency] = useState<TxCurrencyFilter>('ALL');
  // Default = OPEN (receivable + payable, excludes settled). Spec D14
  // freeze respected at the spec level; this is a UI default, not a
  // selector or data change. Users can still switch to All / Settled.
  const [direction, setDirection] = useState<TxDirectionFilter>('OPEN');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<TxSortMode>('aging-desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Cross-tab focus handling (Step 7):
  // When focusedTxId is set, we ensure the target row is RENDERED even
  // if the user's current Direction filter would normally hide it (the
  // P1 case: settled ERP tx, OPEN filter excludes settled).
  // Strategy: include the focused tx as an "exception" — bypass the
  // direction filter for that one row. This preserves the user's
  // explicit filter selection.
  const focusedTx = useMemo(
    () => focusedTxId ? detail.transactions.find(t => t.id === focusedTxId) ?? null : null,
    [detail.transactions, focusedTxId],
  );

  // After-focus expiry: clear focus state ~1.5s after it was set so
  // the highlight class drops off naturally.
  useEffect(() => {
    if (!focusedTxId) return;
    const timer = setTimeout(() => onClearFocus(), 1800);
    return () => clearTimeout(timer);
  }, [focusedTxId, onClearFocus]);

  // Derived: filtered + sorted rows. Pure function of inputs; memoized
  // to keep keyboard nav snappy on the largest party (~150 rows).
  const rows = useMemo(() => {
    let r = detail.transactions;

    if (currency !== 'ALL') r = r.filter(t => t.currency === currency);
    if (direction === 'OPEN') {
      r = r.filter(t =>
        t.direction === 'receivable' ||
        t.direction === 'payable' ||
        // P1 #3 (Step 7): focused row is always visible even if it
        // would otherwise be filtered out (e.g. settled tx targeted
        // from Statements tab cross-navigation).
        t.id === focusedTxId,
      );
    } else if (direction !== 'ALL') {
      r = r.filter(t => t.direction === direction || t.id === focusedTxId);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(t =>
        // Search across visible identifying fields. partyName is shown
        // in the header so we don't search it here — it's redundant.
        (t.ourRefNo ?? '').toLowerCase().includes(q) ||
        (t.invoiceNo ?? '').toLowerCase().includes(q) ||
        (t.crdrNo ?? '').toLowerCase().includes(q) ||
        (t.vendorInvoiceNo ?? '').toLowerCase().includes(q) ||
        (t.blNo ?? '').toLowerCase().includes(q) ||
        (t.trace.sourceFile ?? '').toLowerCase().includes(q),
      );
    }

    return sortTransactions(r, sortMode);
  }, [detail.transactions, currency, direction, query, sortMode]);

  // Per-currency footer totals — never sum across currencies (spec D5).
  const totals = useMemo(() => {
    const byCcy = { USD: 0, CAD: 0 };
    for (const t of rows) {
      if (t.direction === 'settled') continue;  // Dashboard parity
      byCcy[t.currency] += t.signedBalance;
    }
    return byCcy;
  }, [rows]);

  return (
    <div className="party-tab-content">
      <TransactionsFilterBar
        currency={currency}
        direction={direction}
        query={query}
        sortMode={sortMode}
        onCurrencyChange={setCurrency}
        onDirectionChange={setDirection}
        onQueryChange={setQuery}
        onSortChange={setSortMode}
      />

      {rows.length === 0 ? (
        <div className="party-tab-empty">
          <p className="empty-sub">No transactions match the current filter.</p>
        </div>
      ) : (
        <table className="data tx-table">
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Direction</th>
              <th scope="col">Currency</th>
              <th scope="col" className="tx-col-amount">Amount</th>
              <th scope="col" className="tx-col-aging">Aging</th>
              <th scope="col">Date</th>
              <th scope="col">Reference</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(tx => {
              const isExpanded = expandedId === tx.id;
              return (
                <Fragment key={tx.id}>
                  <tr
                    className={
                      'tx-row' +
                      (isExpanded ? ' tx-row-expanded' : '') +
                      (tx.id === focusedTxId ? ' tx-row-focused' : '')
                    }
                    ref={tx.id === focusedTxId ? (el => {
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }) : undefined}
                  >
                    <td className="tx-col-toggle">
                      <button
                        type="button"
                        className="tx-toggle-btn"
                        onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && isExpanded) {
                            e.preventDefault();
                            setExpandedId(null);
                          }
                        }}
                        aria-expanded={isExpanded}
                        aria-controls={`tx-trace-${tx.id}`}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} trace for ${tx.sourceType} row ${tx.trace.sourceRow}`}
                      >
                        <span className="tx-toggle-chevron" aria-hidden="true">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        {tx.sourceType}
                      </button>
                    </td>
                    <td>
                      <DirectionBadge direction={tx.direction} />
                    </td>
                    <td>{tx.currency}</td>
                    <td className={'tx-col-amount mono ' + amountClass(tx.signedBalance)}>
                      {formatSignedMoney(tx.signedBalance)}
                    </td>
                    <td className="tx-col-aging">
                      <AgingPill days={tx.agingDays} bucket={tx.agingBucket} direction={tx.direction} />
                    </td>
                    <td className="mono">
                      {displayDate(tx) || '—'}
                    </td>
                    <td className="mono tx-col-ref">
                      {pickReference(tx)}
                    </td>
                    <td className="mono muted-small">
                      {tx.trace.sourceFile}:{tx.trace.sourceRow}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="tx-trace-row" id={`tx-trace-${tx.id}`}>
                      <td colSpan={8}>
                        <TransactionTracePanel tx={tx} partyName={detail.partyName} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="party-tab-footer">
        <span className="panel-subtitle">
          {rows.length} of {detail.transactions.length} transactions
        </span>
        <span className="party-tab-totals">
          {totals.USD !== 0 && (
            <span className={'mono ' + amountClass(totals.USD)}>
              USD {formatSignedMoney(totals.USD)}
            </span>
          )}
          {totals.CAD !== 0 && (
            <span className={'mono ' + amountClass(totals.CAD)}>
              CAD {formatSignedMoney(totals.CAD)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Display/sort date helper — single source of truth so the visible
// date and the date-sort key never disagree.
// (P1 fix: previously sort used invoiceDate alone, while display used
// invoiceDate ?? postDate, so CRDR/AP rows could sort as empty dates
// while showing a post date in the cell.)
// ----------------------------------------------------------
function displayDate(tx: PreviewTransaction): string {
  return tx.invoiceDate ?? tx.postDate ?? '';
}

// ----------------------------------------------------------
// Sort helper for transactions
// ----------------------------------------------------------
function sortTransactions(
  rows: PreviewTransaction[],
  mode: TxSortMode,
): PreviewTransaction[] {
  // Make a copy so we don't mutate the selector's array.
  const out = [...rows];
  switch (mode) {
    case 'aging-desc':
      // Per spec: aging desc, amount desc (composite default)
      out.sort((a, b) => {
        if (b.agingDays !== a.agingDays) return b.agingDays - a.agingDays;
        return Math.abs(b.signedBalance) - Math.abs(a.signedBalance);
      });
      break;
    case 'amount-desc':
      out.sort((a, b) => Math.abs(b.signedBalance) - Math.abs(a.signedBalance));
      break;
    case 'amount-asc':
      out.sort((a, b) => Math.abs(a.signedBalance) - Math.abs(b.signedBalance));
      break;
    case 'date-desc':
      out.sort((a, b) => displayDate(b).localeCompare(displayDate(a)));
      break;
    case 'date-asc':
      out.sort((a, b) => displayDate(a).localeCompare(displayDate(b)));
      break;
    case 'source-row-asc':
      out.sort((a, b) => {
        if (a.trace.sourceFile !== b.trace.sourceFile) {
          return a.trace.sourceFile.localeCompare(b.trace.sourceFile);
        }
        return a.trace.sourceRow - b.trace.sourceRow;
      });
      break;
  }
  return out;
}

// ----------------------------------------------------------
// Reference picker — show the most relevant ref per source type
// ----------------------------------------------------------
function pickReference(tx: PreviewTransaction): string {
  if (tx.sourceType === 'CRDR') return tx.crdrNo ?? tx.ourRefNo ?? '—';
  if (tx.sourceType === 'AP')   return tx.vendorInvoiceNo ?? tx.ourRefNo ?? '—';
  // INVOICE
  return tx.invoiceNo ?? tx.ourRefNo ?? '—';
}

// ----------------------------------------------------------
// Filter bar
// ----------------------------------------------------------
function TransactionsFilterBar({
  currency, direction, query, sortMode,
  onCurrencyChange, onDirectionChange, onQueryChange, onSortChange,
}: {
  currency: TxCurrencyFilter;
  direction: TxDirectionFilter;
  query: string;
  sortMode: TxSortMode;
  onCurrencyChange: (v: TxCurrencyFilter) => void;
  onDirectionChange: (v: TxDirectionFilter) => void;
  onQueryChange: (v: string) => void;
  onSortChange: (v: TxSortMode) => void;
}) {
  return (
    <div className="party-tab-filter-bar">
      <label className="filter-field">
        <span className="filter-label">CURRENCY</span>
        <select value={currency} onChange={e => onCurrencyChange(e.target.value as TxCurrencyFilter)}>
          <option value="ALL">All</option>
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">DIRECTION</span>
        <select value={direction} onChange={e => onDirectionChange(e.target.value as TxDirectionFilter)}>
          <option value="OPEN">Open (receivable + payable)</option>
          <option value="ALL">All</option>
          <option value="receivable">Receivable</option>
          <option value="payable">Payable</option>
          <option value="settled">Settled</option>
        </select>
      </label>

      <label className="filter-field filter-field-grow">
        <span className="filter-label">SEARCH</span>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="ref, invoice, crdr, vendor invoice, BL, source file"
        />
      </label>

      <label className="filter-field">
        <span className="filter-label">SORT</span>
        <select value={sortMode} onChange={e => onSortChange(e.target.value as TxSortMode)}>
          <option value="aging-desc">Aging desc (default)</option>
          <option value="amount-desc">Amount desc</option>
          <option value="amount-asc">Amount asc</option>
          <option value="date-desc">Date desc</option>
          <option value="date-asc">Date asc</option>
          <option value="source-row-asc">Source row</option>
        </select>
      </label>
    </div>
  );
}

// ----------------------------------------------------------
// Cell components
// ----------------------------------------------------------
function DirectionBadge({ direction }: { direction: 'receivable' | 'payable' | 'settled' }) {
  const cls =
    direction === 'receivable' ? 'pill-receivable' :
    direction === 'payable'    ? 'pill-payable' :
    'pill-settled';
  return <span className={'pill ' + cls}>{direction}</span>;
}

function AgingPill({
  days, bucket, direction,
}: {
  days: number;
  bucket: PreviewTransaction['agingBucket'];
  direction: PreviewTransaction['direction'];
}) {
  // Settled rows: aging is informational only, render muted
  if (direction === 'settled') {
    return <span className="aging-cell muted-small">—</span>;
  }
  const cls =
    bucket === '90+'  ? 'aging-90plus' :
    bucket === '61-90' ? 'aging-61-90' :
    bucket === '31-60' ? 'aging-31-60' :
                         'aging-0-30';
  return (
    <span className={'aging-cell ' + cls}>
      <span className="aging-days">{days}d</span>
      <span className="aging-bucket muted-small">{bucket}</span>
    </span>
  );
}

function amountClass(value: number): string {
  if (value > 0) return 'amount-pos';
  if (value < 0) return 'amount-neg';
  return 'amount-zero';
}

// ----------------------------------------------------------
// Trace panel for a transaction row (Step 10 will unify across tabs)
// ----------------------------------------------------------
function TransactionTracePanel({
  tx,
  partyName,
}: {
  tx: PreviewTransaction;
  partyName: string;
}) {
  // Show all reference fields that are present; suppress the missing
  // ones to reduce noise.
  const refs: Array<[string, string]> = [];
  if (tx.ourRefNo)         refs.push(['ourRefNo', tx.ourRefNo]);
  if (tx.invoiceNo)        refs.push(['invoiceNo', tx.invoiceNo]);
  if (tx.crdrNo)           refs.push(['crdrNo', tx.crdrNo]);
  if (tx.vendorInvoiceNo)  refs.push(['vendorInvoiceNo', tx.vendorInvoiceNo]);
  if (tx.vendorName)       refs.push(['vendorName', tx.vendorName]);
  if (tx.blNo)             refs.push(['blNo', tx.blNo]);

  return (
    <div className="trace-panel">
      <div className="trace-grid">
        <TraceField label="Source File"  value={tx.trace.sourceFile} mono />
        <TraceField label="Source Sheet" value={tx.trace.sourceSheet || '—'} mono />
        <TraceField label="Source Row"   value={String(tx.trace.sourceRow)} mono />
        <TraceField label="Transaction ID" value={tx.id} mono small />
        <TraceField label="Party Name"   value={partyName} />
        <TraceField label="Party Key"    value={tx.partyKey} mono />
        <TraceField label="Department"   value={tx.department ?? 'UNKNOWN'} />
        <TraceField label="Aging Basis"  value={tx.agingBasisDate} mono />
        <TraceField label="Raw Balance"  value={formatMoney(tx.rawBalance)} mono />
        <TraceField label="Signed"       value={formatSignedMoney(tx.signedBalance)} mono />
        <TraceField label="Zero Balance" value={tx.isZeroBalance ? 'yes' : 'no'} />
        <TraceField label="Flags"        value={tx.flags.length > 0 ? tx.flags.join(', ') : '—'} mono />
      </div>
      {refs.length > 0 && (
        <div className="trace-refs">
          <div className="trace-section-label">REFERENCES</div>
          <div className="trace-grid">
            {refs.map(([k, v]) => <TraceField key={k} label={k} value={v} mono />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TraceField({
  label, value, mono = false, small = false,
}: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="trace-field">
      <div className="trace-field-label">{label}</div>
      <div className={'trace-field-value' + (mono ? ' mono' : '') + (small ? ' muted-small' : '')}>
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Step 7 — Statements tab content
// ============================================================
//
// Spec §"Tabs" → "Statements" + Step 7 micro-spec rev (S1-S7 with
// reviewer P1 corrections):
//
//   Columns: Source / Currency / Stmt Balance / Reference / MatchType /
//            ERP match / Source statement row
//   Default sort: match type priority, then |statementBalance| desc
//   Match type priority (corrected per reviewer P2):
//     1. Confirmed not in ERP (strict — those that have a review item)
//     2. BALANCE_DIFFERENCE
//     3. CHANGED_AFTER_STATEMENT
//     4. NOT_IN_ERP_EXTRACT broad (without strict review item)
//     5. SETTLED_AFTER_STATEMENT
//     6. EXACT_SIGNED
//     7. (other 5 edge types) alpha
//
//   Filter (corrected per reviewer P1 #2):
//     All / Exact / Matched with difference / Unmatched (outside extract) /
//     Settled after statement
//
//   Labels (corrected per reviewer P1 #1):
//     Strict 7:  "Confirmed not in ERP"
//     Broad 95:  "Not in uploaded ERP extract"
//
//   Cross-tab focus (corrected per reviewer P1 #3):
//     Click ERP-match cell → setFocusedTxId(id) → switch to Transactions
//     tab. Transactions tab handles the OPEN-filter override and
//     1.8s highlight + scroll into view.

type StmtSourceFilter = 'ALL' | 'LOCAL' | 'AGENT';
type StmtMatchFilter =
  | 'ALL'
  | 'EXACT'                    // matchType === EXACT_SIGNED
  | 'MATCHED_WITH_DIFFERENCE'  // BALANCE_DIFFERENCE | CHANGED_AFTER_STATEMENT
  | 'UNMATCHED'                // NOT_IN_ERP_EXTRACT (broad + strict)
  | 'SETTLED_AFTER';           // SETTLED_AFTER_STATEMENT
type StmtCurrencyFilter = 'ALL' | 'USD' | 'CAD';

interface StatementsTabProps {
  detail: PartyDetail;
  onFocusTransaction: (txId: string | null) => void;
}

function StatementsTab({ detail, onFocusTransaction }: StatementsTabProps) {
  const [source, setSource] = useState<StmtSourceFilter>('ALL');
  const [match, setMatch] = useState<StmtMatchFilter>('ALL');
  const [currency, setCurrency] = useState<StmtCurrencyFilter>('ALL');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Derive the set of "strict" matched transaction ids — those that
  // also appear as a NOT_IN_ERP_EXTRACT review item. Used for label
  // separation (reviewer P1 #1) and priority sort (reviewer P2).
  const strictNotInErpKeys = useMemo(() => {
    // The strict review items contain (sourceFile, sourceRow) in trace.
    // A statement link is "strict" if its (sourceFile, sourceRow)
    // matches a strict review item's trace.
    const set = new Set<string>();
    for (const r of detail.reviewItems) {
      if (r.category !== 'NOT_IN_ERP_EXTRACT') continue;
      if (!r.trace) continue;
      set.add(`${r.trace.sourceFile}|${r.trace.sourceRow}`);
    }
    return set;
  }, [detail.reviewItems]);

  const isStrictNotInErp = (link: typeof detail.statementLinks[number]) =>
    strictNotInErpKeys.has(`${link.sourceFile}|${link.sourceRow}`);

  // Filter + sort
  const rows = useMemo(() => {
    let r = detail.statementLinks;

    if (source !== 'ALL') r = r.filter(l => l.source === source);
    if (currency !== 'ALL') r = r.filter(l => l.currency === currency);

    if (match === 'EXACT') {
      r = r.filter(l => l.matchType === 'EXACT_SIGNED');
    } else if (match === 'MATCHED_WITH_DIFFERENCE') {
      r = r.filter(l =>
        l.matchType === 'BALANCE_DIFFERENCE' ||
        l.matchType === 'CHANGED_AFTER_STATEMENT',
      );
    } else if (match === 'UNMATCHED') {
      r = r.filter(l => l.matchType === 'NOT_IN_ERP_EXTRACT');
    } else if (match === 'SETTLED_AFTER') {
      r = r.filter(l => l.matchType === 'SETTLED_AFTER_STATEMENT');
    }

    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(l =>
        (l.ourRefNo ?? '').toLowerCase().includes(q) ||
        (l.invoiceNo ?? '').toLowerCase().includes(q) ||
        (l.crdrNo ?? '').toLowerCase().includes(q) ||
        (l.sourceFile ?? '').toLowerCase().includes(q),
      );
    }

    return [...r].sort((a, b) => {
      const pa = matchTypePriority(a, isStrictNotInErp(a));
      const pb = matchTypePriority(b, isStrictNotInErp(b));
      if (pa !== pb) return pa - pb;
      return Math.abs(b.statementBalance) - Math.abs(a.statementBalance);
    });
  }, [detail.statementLinks, source, match, currency, query, strictNotInErpKeys]);

  // Footer counts (reviewer P1 #1: distinguish broad vs strict)
  const broadNotInErpCount = detail.statementLinks.filter(
    l => l.matchType === 'NOT_IN_ERP_EXTRACT',
  ).length;
  const strictNotInErpCount = detail.statementLinks.filter(
    l => l.matchType === 'NOT_IN_ERP_EXTRACT' && isStrictNotInErp(l),
  ).length;

  return (
    <div className="party-tab-content">
      <StatementsFilterBar
        source={source}
        match={match}
        currency={currency}
        query={query}
        onSourceChange={setSource}
        onMatchChange={setMatch}
        onCurrencyChange={setCurrency}
        onQueryChange={setQuery}
      />

      {rows.length === 0 ? (
        <div className="party-tab-empty">
          <p className="empty-sub">
            {detail.statementLinks.length === 0
              ? 'No statement rows for this party. Statements appear when the party shows up in LOCAL_STATEMENT or AGENT_STATEMENT files for the period.'
              : 'No statement rows match the current filter.'}
          </p>
        </div>
      ) : (
        <table className="data stmt-table">
          <thead>
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Currency</th>
              <th scope="col" className="stmt-col-amount">Stmt Balance</th>
              <th scope="col">Reference</th>
              <th scope="col">Match Type</th>
              <th scope="col">ERP Match</th>
              <th scope="col">Statement Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(link => {
              const linkId = `${link.sourceFile}|${link.sourceRow}`;
              const isExpanded = expandedId === linkId;
              const strict = isStrictNotInErp(link);
              return (
                <Fragment key={linkId}>
                  <tr className={'stmt-row' + (isExpanded ? ' stmt-row-expanded' : '')}>
                    <td className="stmt-col-toggle">
                      <button
                        type="button"
                        className="tx-toggle-btn"
                        onClick={() => setExpandedId(isExpanded ? null : linkId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && isExpanded) {
                            e.preventDefault();
                            setExpandedId(null);
                          }
                        }}
                        aria-expanded={isExpanded}
                        aria-controls={`stmt-trace-${encodeURIComponent(linkId)}`}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} trace for ${link.source} statement row ${link.sourceRow}`}
                      >
                        <span className="tx-toggle-chevron" aria-hidden="true">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <SourcePill source={link.source} />
                      </button>
                    </td>
                    <td>{link.currency}</td>
                    <td className={'stmt-col-amount mono ' + amountClass(link.statementBalance)}>
                      {formatSignedMoney(link.statementBalance)}
                    </td>
                    <td className="mono stmt-col-ref">
                      {pickStatementReference(link)}
                    </td>
                    <td>
                      <MatchTypeBadge matchType={link.matchType} strict={strict} />
                    </td>
                    <td className="mono">
                      <ErpMatchCell
                        link={link}
                        partyTransactions={detail.transactions}
                        onFocus={onFocusTransaction}
                      />
                    </td>
                    <td className="mono muted-small">
                      {link.sourceFile}:{link.sourceRow}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="stmt-trace-row" id={`stmt-trace-${encodeURIComponent(linkId)}`}>
                      <td colSpan={7}>
                        <StatementTracePanel
                          link={link}
                          partyName={detail.partyName}
                          strict={strict}
                          partyTransactions={detail.transactions}
                          onFocus={onFocusTransaction}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="party-tab-footer stmt-footer">
        <span>
          {rows.length} of {detail.statementLinks.length} statement rows
        </span>
        {broadNotInErpCount > 0 && (
          <span className="stmt-reconcile-note muted-small">
            {broadNotInErpCount} statement {broadNotInErpCount === 1 ? 'row is' : 'rows are'} outside the uploaded ERP extract;
            {' '}{strictNotInErpCount} {strictNotInErpCount === 1 ? 'is a confirmed' : 'are confirmed'} review {strictNotInErpCount === 1 ? 'item' : 'items'}.
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Match type priority helper (reviewer P2 fix)
// ----------------------------------------------------------
function matchTypePriority(
  link: { matchType: string },
  isStrict: boolean,
): number {
  // Strict not-in-ERP is highest priority (the 7 confirmed review rows)
  if (link.matchType === 'NOT_IN_ERP_EXTRACT' && isStrict) return 1;
  if (link.matchType === 'BALANCE_DIFFERENCE')             return 2;
  if (link.matchType === 'CHANGED_AFTER_STATEMENT')        return 3;
  // Broad NOT_IN_ERP_EXTRACT (without a strict review item)
  if (link.matchType === 'NOT_IN_ERP_EXTRACT')             return 4;
  if (link.matchType === 'SETTLED_AFTER_STATEMENT')        return 5;
  if (link.matchType === 'EXACT_SIGNED')                   return 6;
  // Other edge matchTypes (alpha-fallback for stability)
  return 7;
}

// ----------------------------------------------------------
// Reference picker for statement links
// ----------------------------------------------------------
function pickStatementReference(
  link: { source: string; ourRefNo: string | null; invoiceNo: string | null; crdrNo: string | null },
): string {
  if (link.source === 'AGENT') return link.crdrNo ?? link.ourRefNo ?? '—';
  // LOCAL: prefer invoice-side ref
  return link.invoiceNo ?? link.ourRefNo ?? '—';
}

// ----------------------------------------------------------
// Filter bar — 4 controls (reviewer P1 #2 corrected filter set)
// ----------------------------------------------------------
function StatementsFilterBar({
  source, match, currency, query,
  onSourceChange, onMatchChange, onCurrencyChange, onQueryChange,
}: {
  source: StmtSourceFilter;
  match: StmtMatchFilter;
  currency: StmtCurrencyFilter;
  query: string;
  onSourceChange: (v: StmtSourceFilter) => void;
  onMatchChange: (v: StmtMatchFilter) => void;
  onCurrencyChange: (v: StmtCurrencyFilter) => void;
  onQueryChange: (v: string) => void;
}) {
  return (
    <div className="party-tab-filter-bar">
      <label className="filter-field">
        <span className="filter-label">SOURCE</span>
        <select value={source} onChange={e => onSourceChange(e.target.value as StmtSourceFilter)}>
          <option value="ALL">All</option>
          <option value="LOCAL">LOCAL</option>
          <option value="AGENT">AGENT</option>
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">MATCH</span>
        <select value={match} onChange={e => onMatchChange(e.target.value as StmtMatchFilter)}>
          <option value="ALL">All</option>
          <option value="EXACT">Exact</option>
          <option value="MATCHED_WITH_DIFFERENCE">Matched with difference</option>
          <option value="UNMATCHED">Unmatched (outside extract)</option>
          <option value="SETTLED_AFTER">Settled after statement</option>
        </select>
      </label>

      <label className="filter-field">
        <span className="filter-label">CURRENCY</span>
        <select value={currency} onChange={e => onCurrencyChange(e.target.value as StmtCurrencyFilter)}>
          <option value="ALL">All</option>
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
        </select>
      </label>

      <label className="filter-field filter-field-grow">
        <span className="filter-label">SEARCH</span>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="reference, invoice, crdr, source file"
        />
      </label>
    </div>
  );
}

// ----------------------------------------------------------
// Cell components
// ----------------------------------------------------------
function SourcePill({ source }: { source: 'LOCAL' | 'AGENT' }) {
  const cls = source === 'LOCAL' ? 'pill-local' : 'pill-agent';
  return <span className={'pill ' + cls}>{source}</span>;
}

function MatchTypeBadge({
  matchType, strict,
}: {
  matchType: string;
  strict: boolean;
}) {
  // Reviewer P1 #1: distinguish strict (confirmed) from broad
  // (outside-extract). Same matchType code, different label + color.
  if (matchType === 'NOT_IN_ERP_EXTRACT' && strict) {
    return <span className="pill pill-mt-strict">Confirmed not in ERP</span>;
  }
  if (matchType === 'NOT_IN_ERP_EXTRACT') {
    return <span className="pill pill-mt-broad">Not in uploaded ERP extract</span>;
  }
  if (matchType === 'BALANCE_DIFFERENCE') {
    return <span className="pill pill-mt-diff">Balance difference</span>;
  }
  if (matchType === 'CHANGED_AFTER_STATEMENT') {
    return <span className="pill pill-mt-diff">Changed after statement</span>;
  }
  if (matchType === 'SETTLED_AFTER_STATEMENT') {
    return <span className="pill pill-mt-settled">Settled after statement</span>;
  }
  if (matchType === 'EXACT_SIGNED') {
    return <span className="pill pill-mt-exact">Exact</span>;
  }
  // Other edge types (alphabetical fallback)
  return <span className="pill pill-mt-other">{matchType.toLowerCase().replace(/_/g, ' ')}</span>;
}

function ErpMatchCell({
  link,
  partyTransactions,
  onFocus,
}: {
  link: { matchedTransactionId: string | null; matchType: string; statementBalance: number };
  partyTransactions: PreviewTransaction[];
  onFocus: (txId: string | null) => void;
}) {
  if (!link.matchedTransactionId) {
    return <span className="muted-small">—</span>;
  }
  const tx = partyTransactions.find(t => t.id === link.matchedTransactionId);
  if (!tx) {
    // Defensive: matched id exists but tx not in this party's set.
    // Should not happen given selector filter, but handle gracefully.
    return <span className="muted-small">tx-{link.matchedTransactionId.slice(0, 8)}</span>;
  }
  // Show short source-file:row + delta inline when applicable
  const fileShort = tx.trace.sourceFile.split(/[/\\]/).pop() ?? tx.trace.sourceFile;
  const fileShorter = fileShort.length > 18 ? fileShort.slice(0, 16) + '…' : fileShort;
  const delta = link.matchType === 'BALANCE_DIFFERENCE'
    ? Math.round((link.statementBalance - tx.signedBalance) * 100) / 100
    : null;
  return (
    <button
      type="button"
      className="erp-match-link"
      onClick={() => onFocus(tx.id)}
      title={`Switch to Transactions tab and focus row at ${tx.trace.sourceFile}:${tx.trace.sourceRow}`}
    >
      → {fileShorter}:{tx.trace.sourceRow}
      {delta !== null && delta !== 0 && (
        <span className="erp-delta"> (Δ {formatSignedMoney(delta)})</span>
      )}
    </button>
  );
}

// ----------------------------------------------------------
// Trace panel for a statement link
// ----------------------------------------------------------
function StatementTracePanel({
  link,
  partyName,
  strict,
  partyTransactions,
  onFocus,
}: {
  link: PartyDetail['statementLinks'][number];
  partyName: string;
  strict: boolean;
  partyTransactions: PreviewTransaction[];
  onFocus: (txId: string | null) => void;
}) {
  const matchedTx = link.matchedTransactionId
    ? partyTransactions.find(t => t.id === link.matchedTransactionId) ?? null
    : null;

  const refs: Array<[string, string]> = [];
  if (link.ourRefNo)  refs.push(['ourRefNo', link.ourRefNo]);
  if (link.invoiceNo) refs.push(['invoiceNo', link.invoiceNo]);
  if (link.crdrNo)    refs.push(['crdrNo', link.crdrNo]);

  return (
    <div className="trace-panel">
      <div className="trace-grid">
        <TraceField label="Source File"  value={link.sourceFile} mono />
        <TraceField label="Source Row"   value={String(link.sourceRow)} mono />
        <TraceField label="Source"       value={link.source} />
        <TraceField label="Party Name"   value={partyName} />
        <TraceField label="Party Key"    value={link.partyKey} mono />
        <TraceField label="Match Type"   value={
          link.matchType === 'NOT_IN_ERP_EXTRACT' && strict
            ? 'Confirmed not in ERP'
            : link.matchType === 'NOT_IN_ERP_EXTRACT'
              ? 'Not in uploaded ERP extract'
              : link.matchType
        } />
        <TraceField label="Currency"     value={link.currency} mono />
        <TraceField label="Stmt Balance" value={formatSignedMoney(link.statementBalance)} mono />
      </div>

      {matchedTx && (
        <div className="trace-refs">
          <div className="trace-section-label">ERP MATCH</div>
          <div className="trace-grid">
            <TraceField label="Tx Source File" value={matchedTx.trace.sourceFile} mono />
            <TraceField label="Tx Source Row"  value={String(matchedTx.trace.sourceRow)} mono />
            <TraceField label="Tx Signed"      value={formatSignedMoney(matchedTx.signedBalance)} mono />
            {link.matchType === 'BALANCE_DIFFERENCE' && (
              <TraceField
                label="Delta"
                value={formatSignedMoney(
                  Math.round((link.statementBalance - matchedTx.signedBalance) * 100) / 100,
                )}
                mono
              />
            )}
          </div>
          <button
            type="button"
            className="btn-link erp-jump-btn"
            onClick={() => onFocus(matchedTx.id)}
          >
            View this transaction in Transactions tab →
          </button>
        </div>
      )}

      {refs.length > 0 && (
        <div className="trace-refs">
          <div className="trace-section-label">REFERENCES</div>
          <div className="trace-grid">
            {refs.map(([k, v]) => <TraceField key={k} label={k} value={v} mono />)}
          </div>
        </div>
      )}

      {(link.referenceStatus || link.differenceType) && (
        <div className="trace-refs">
          <div className="trace-section-label">STATEMENT STATUS FIELDS</div>
          <div className="trace-grid">
            {link.referenceStatus && <TraceField label="referenceStatus" value={link.referenceStatus} mono />}
            {link.differenceType && <TraceField label="differenceType" value={link.differenceType} mono />}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsTabPlaceholder({
  detail,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  onFocusTransaction: (txId: string | null) => void;
}) {
  if (detail.reviewItems.length > 0) {
    return <ReviewsTab detail={detail} onFocusTransaction={onFocusTransaction} />;
  }
  return <TabPlaceholder title="Reviews" count={0} unit="review items" />;
}

// ============================================================
// Step 8 — Reviews tab content
// ============================================================
//
// Spec §"Tabs" -> "Reviews":
//   Rows: party review items across all categories
//   No deduplication. A transaction can appear in multiple categories.
//   Default filter: all categories
//
// Cross-tab focus reuses Step 7's onFocusTransaction prop. When a
// review item has a transactionId, clicking it switches to the
// Transactions tab and focuses the matched row. NOT_IN_ERP_EXTRACT
// items have no transactionId (statement-only) and render without a
// jump link.

type ReviewCategoryFilter =
  | 'ALL'
  | 'WARNINGS'
  | 'AGING_90_PLUS'
  | 'DUPLICATES'
  | 'NOT_IN_ERP_EXTRACT'
  | 'UNKNOWN_DEPARTMENT';

const CATEGORY_LABELS: Record<Exclude<ReviewCategoryFilter, 'ALL'>, string> = {
  WARNINGS:           'Warnings',
  AGING_90_PLUS:      '90+ Aging',
  DUPLICATES:         'Duplicates',
  NOT_IN_ERP_EXTRACT: 'Not in ERP',
  UNKNOWN_DEPARTMENT: 'Unknown department',
};

// Severity-based category priority for default sort (most-actionable first).
// Mirrors the Review Queue card order:
//   NOT_IN_ERP_EXTRACT first (audit-grade missing rows)
//   AGING_90_PLUS next (real money outstanding)
//   DUPLICATES (potential double-counting)
//   WARNINGS (parser-flagged anomalies)
//   UNKNOWN_DEPARTMENT (housekeeping)
function reviewCategoryPriority(cat: string): number {
  switch (cat) {
    case 'NOT_IN_ERP_EXTRACT': return 1;
    case 'AGING_90_PLUS':      return 2;
    case 'DUPLICATES':         return 3;
    case 'WARNINGS':           return 4;
    case 'UNKNOWN_DEPARTMENT': return 5;
    default: return 6;
  }
}

function ReviewsTab({
  detail,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  onFocusTransaction: (txId: string | null) => void;
}) {
  const [category, setCategory] = useState<ReviewCategoryFilter>('ALL');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-category counts shown next to filter options
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      WARNINGS: 0, AGING_90_PLUS: 0, DUPLICATES: 0,
      NOT_IN_ERP_EXTRACT: 0, UNKNOWN_DEPARTMENT: 0,
    };
    for (const r of detail.reviewItems) {
      c[r.category] = (c[r.category] ?? 0) + 1;
    }
    return c;
  }, [detail.reviewItems]);

  // Filter + sort
  const rows = useMemo(() => {
    let r = detail.reviewItems;

    if (category !== 'ALL') r = r.filter(item => item.category === category);

    const q = query.trim().toLowerCase();
    if (q) {
      r = r.filter(item =>
        (item.reason ?? '').toLowerCase().includes(q) ||
        (item.reasonCode ?? '').toLowerCase().includes(q),
      );
    }

    // Sort: category priority, then |amount| desc, then id stable
    return [...r].sort((a, b) => {
      const pa = reviewCategoryPriority(a.category);
      const pb = reviewCategoryPriority(b.category);
      if (pa !== pb) return pa - pb;
      const aa = Math.abs(a.amount ?? 0);
      const ab = Math.abs(b.amount ?? 0);
      if (aa !== ab) return ab - aa;
      return a.id.localeCompare(b.id);
    });
  }, [detail.reviewItems, category, query]);

  // Per-currency impact totals (USD/CAD never summed)
  const impact = useMemo(() => {
    const t = { USD: 0, CAD: 0 };
    for (const r of rows) {
      if (r.amount === null || r.currency === null) continue;
      t[r.currency] += r.amount;
    }
    return t;
  }, [rows]);

  return (
    <div className="party-tab-content">
      <ReviewsFilterBar
        category={category}
        query={query}
        counts={counts}
        onCategoryChange={setCategory}
        onQueryChange={setQuery}
      />

      {rows.length === 0 ? (
        <div className="party-tab-empty">
          <p className="empty-sub">
            {detail.reviewItems.length === 0
              ? 'No review items for this party. The audit found no warnings, duplicates, aging issues, or other flags.'
              : 'No review items match the current filter.'}
          </p>
        </div>
      ) : (
        <table className="data review-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Reason</th>
              <th scope="col">Currency</th>
              <th scope="col" className="review-col-amount">Amount</th>
              <th scope="col">Source</th>
              <th scope="col">Linked Tx</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(item => {
              const isExpanded = expandedId === item.id;
              const matchedTx = item.transactionId
                ? detail.transactions.find(t => t.id === item.transactionId) ?? null
                : null;
              return (
                <Fragment key={item.id}>
                  <tr className={'review-row' + (isExpanded ? ' review-row-expanded' : '')}>
                    <td className="review-col-toggle">
                      <button
                        type="button"
                        className="tx-toggle-btn"
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && isExpanded) {
                            e.preventDefault();
                            setExpandedId(null);
                          }
                        }}
                        aria-expanded={isExpanded}
                        aria-controls={`review-trace-${item.id}`}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} review item ${item.reasonCode}`}
                      >
                        <span className="tx-toggle-chevron" aria-hidden="true">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <CategoryBadge category={item.category} />
                      </button>
                    </td>
                    <td className="review-col-reason">
                      <div className="review-reason-code mono muted-small">{item.reasonCode}</div>
                      <div className="review-reason-text">{item.reason}</div>
                    </td>
                    <td>{item.currency ?? '—'}</td>
                    <td className={'review-col-amount mono ' + (item.amount !== null ? amountClass(item.amount) : '')}>
                      {item.amount !== null ? formatSignedMoney(item.amount) : '—'}
                    </td>
                    <td className="mono muted-small">
                      {item.trace
                        ? `${item.trace.sourceFile}:${item.trace.sourceRow}`
                        : '—'}
                    </td>
                    <td>
                      {matchedTx ? (
                        <button
                          type="button"
                          className="erp-match-link"
                          onClick={() => onFocusTransaction(matchedTx.id)}
                          title={`Switch to Transactions tab and focus this row`}
                        >
                          → {matchedTx.sourceType}
                        </button>
                      ) : (
                        <span className="muted-small">—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="review-trace-row" id={`review-trace-${item.id}`}>
                      <td colSpan={6}>
                        <ReviewTracePanel
                          item={item}
                          partyName={detail.partyName}
                          matchedTx={matchedTx}
                          onFocus={onFocusTransaction}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="party-tab-footer">
        <span>
          {rows.length} of {detail.reviewItems.length} review items
        </span>
        <span className="party-tab-totals">
          {impact.USD !== 0 && (
            <span className={'mono ' + amountClass(impact.USD)}>
              USD impact {formatSignedMoney(impact.USD)}
            </span>
          )}
          {impact.CAD !== 0 && (
            <span className={'mono ' + amountClass(impact.CAD)}>
              CAD impact {formatSignedMoney(impact.CAD)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Filter bar
// ----------------------------------------------------------
function ReviewsFilterBar({
  category, query, counts,
  onCategoryChange, onQueryChange,
}: {
  category: ReviewCategoryFilter;
  query: string;
  counts: Record<string, number>;
  onCategoryChange: (v: ReviewCategoryFilter) => void;
  onQueryChange: (v: string) => void;
}) {
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <div className="party-tab-filter-bar">
      <label className="filter-field">
        <span className="filter-label">CATEGORY</span>
        <select value={category} onChange={e => onCategoryChange(e.target.value as ReviewCategoryFilter)}>
          <option value="ALL">All ({totalCount})</option>
          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(k => (
            counts[k] > 0 ? (
              <option key={k} value={k}>{CATEGORY_LABELS[k]} ({counts[k]})</option>
            ) : null
          ))}
        </select>
      </label>

      <label className="filter-field filter-field-grow">
        <span className="filter-label">SEARCH</span>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="reason, reason code"
        />
      </label>
    </div>
  );
}

// ----------------------------------------------------------
// Cell components
// ----------------------------------------------------------
function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category;
  const cls =
    category === 'NOT_IN_ERP_EXTRACT' ? 'pill-cat-strict' :
    category === 'AGING_90_PLUS'      ? 'pill-cat-aging' :
    category === 'DUPLICATES'         ? 'pill-cat-dup' :
    category === 'WARNINGS'           ? 'pill-cat-warn' :
    category === 'UNKNOWN_DEPARTMENT' ? 'pill-cat-unknown' :
                                        'pill-cat-other';
  return <span className={'pill ' + cls}>{label}</span>;
}

// ----------------------------------------------------------
// Trace panel for a review item
// ----------------------------------------------------------
function ReviewTracePanel({
  item,
  partyName,
  matchedTx,
  onFocus,
}: {
  item: PartyDetail['reviewItems'][number];
  partyName: string;
  matchedTx: PreviewTransaction | null;
  onFocus: (txId: string | null) => void;
}) {
  // Extract any optional flat string/number details for display, but
  // never raw row arrays (spec §1.7).
  const extraDetails: Array<[string, string]> = [];
  if (item.details) {
    for (const [k, v] of Object.entries(item.details)) {
      if (v == null) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        extraDetails.push([k, String(v)]);
      }
    }
  }

  return (
    <div className="trace-panel">
      <div className="trace-grid">
        {item.trace && (
          <>
            <TraceField label="Source File" value={item.trace.sourceFile} mono />
            <TraceField label="Source Row"  value={String(item.trace.sourceRow)} mono />
            {item.trace.sourceSheet && (
              <TraceField label="Source Sheet" value={item.trace.sourceSheet} mono />
            )}
          </>
        )}
        <TraceField label="Category"    value={CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] ?? item.category} />
        <TraceField label="Reason Code" value={item.reasonCode} mono />
        <TraceField label="Severity"    value={item.severity} />
        <TraceField label="Party Name"  value={partyName} />
        <TraceField label="Party Key"   value={item.partyKey ?? '—'} mono />
        {item.currency && (
          <TraceField label="Currency"  value={item.currency} mono />
        )}
        {item.amount !== null && (
          <TraceField label="Amount"    value={formatSignedMoney(item.amount)} mono />
        )}
      </div>

      <div className="trace-refs">
        <div className="trace-section-label">REASON</div>
        <p className="review-reason-detail">{item.reason}</p>
      </div>

      {matchedTx && (
        <div className="trace-refs">
          <div className="trace-section-label">LINKED TRANSACTION</div>
          <div className="trace-grid">
            <TraceField label="Tx Source File" value={matchedTx.trace.sourceFile} mono />
            <TraceField label="Tx Source Row"  value={String(matchedTx.trace.sourceRow)} mono />
            <TraceField label="Tx Type"        value={matchedTx.sourceType} />
            <TraceField label="Tx Direction"   value={matchedTx.direction} />
            <TraceField label="Tx Signed"      value={formatSignedMoney(matchedTx.signedBalance)} mono />
          </div>
          <button
            type="button"
            className="btn-link erp-jump-btn"
            onClick={() => onFocus(matchedTx.id)}
          >
            View this transaction in Transactions tab →
          </button>
        </div>
      )}

      {extraDetails.length > 0 && (
        <div className="trace-refs">
          <div className="trace-section-label">DETAILS</div>
          <div className="trace-grid">
            {extraDetails.map(([k, v]) => <TraceField key={k} label={k} value={v} mono />)}
          </div>
        </div>
      )}
    </div>
  );
}

function DuplicatesTabPlaceholder({
  detail,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  onFocusTransaction: (txId: string | null) => void;
}) {
  // Spec §"Empty States": "If zero groups, show a neutral empty state.
  // Do not hide the tab."
  if (detail.duplicateGroups.length === 0) {
    return (
      <TabPlaceholder
        title="Duplicates"
        count={0}
        unit="duplicate groups"
        emptyMessage="No duplicate groups for this party."
      />
    );
  }
  return <DuplicatesTab detail={detail} onFocusTransaction={onFocusTransaction} />;
}

// ============================================================
// Step 9 — Duplicates tab content
// ============================================================
//
// Spec §"Tabs" -> "Duplicates":
//   Rows: duplicate groups touching this party (selector pre-filtered)
//   Group rows expand to show member transaction ids and trace rows
//   Empty state: "No duplicate groups for this party." (handled above)
//
// Architecture:
//   - Group row shows: identityKey / currency / count / |impact|
//   - Click expands to show member tx rows (one row per member)
//   - Each member tx row has cross-tab focus link (reuse Step 7)
//   - Filter by currency (USD/CAD)

type DupCurrencyFilter = 'ALL' | 'USD' | 'CAD';
type DupSortMode =
  | 'impact-desc'        // default — biggest financial impact first
  | 'impact-asc'
  | 'count-desc'         // most members first (when group sizes vary)
  | 'identity-asc';      // alpha by identityKey for predictable scanning

function DuplicatesTab({
  detail,
  onFocusTransaction,
}: {
  detail: PartyDetail;
  onFocusTransaction: (txId: string | null) => void;
}) {
  const [currency, setCurrency] = useState<DupCurrencyFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<DupSortMode>('impact-desc');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Build a fast tx-id lookup so member rows can resolve their tx
  const txById = useMemo(() => {
    const m = new Map<string, PreviewTransaction>();
    for (const t of detail.transactions) m.set(t.id, t);
    return m;
  }, [detail.transactions]);

  // Filter + sort
  const groups = useMemo(() => {
    let g = detail.duplicateGroups;

    if (currency !== 'ALL') g = g.filter(grp => grp.currency === currency);

    const q = query.trim().toLowerCase();
    if (q) {
      g = g.filter(grp =>
        grp.identityKey.toLowerCase().includes(q) ||
        // Search across member tx references too
        grp.transactionIds.some(tid => {
          const tx = txById.get(tid);
          if (!tx) return false;
          return (
            (tx.ourRefNo ?? '').toLowerCase().includes(q) ||
            (tx.invoiceNo ?? '').toLowerCase().includes(q) ||
            (tx.crdrNo ?? '').toLowerCase().includes(q) ||
            (tx.vendorInvoiceNo ?? '').toLowerCase().includes(q)
          );
        }),
      );
    }

    return [...g].sort((a, b) => {
      switch (sortMode) {
        case 'impact-desc':
          return Math.abs(b.potentialSignedImpact) - Math.abs(a.potentialSignedImpact);
        case 'impact-asc':
          return Math.abs(a.potentialSignedImpact) - Math.abs(b.potentialSignedImpact);
        case 'count-desc':
          if (b.count !== a.count) return b.count - a.count;
          return Math.abs(b.potentialSignedImpact) - Math.abs(a.potentialSignedImpact);
        case 'identity-asc':
          return a.identityKey.localeCompare(b.identityKey);
      }
    });
  }, [detail.duplicateGroups, currency, query, sortMode, txById]);

  // Per-currency potential impact totals (D5 — never sum across)
  const totals = useMemo(() => {
    const t = { USD: 0, CAD: 0 };
    for (const g of groups) {
      t[g.currency] += g.potentialSignedImpact;
    }
    return t;
  }, [groups]);

  return (
    <div className="party-tab-content">
      <DuplicatesFilterBar
        currency={currency}
        query={query}
        sortMode={sortMode}
        onCurrencyChange={setCurrency}
        onQueryChange={setQuery}
        onSortChange={setSortMode}
      />

      {groups.length === 0 ? (
        <div className="party-tab-empty">
          <p className="empty-sub">No duplicate groups match the current filter.</p>
        </div>
      ) : (
        <table className="data dup-table">
          <thead>
            <tr>
              <th scope="col">Identity</th>
              <th scope="col">Currency</th>
              <th scope="col" className="dup-col-count">Members</th>
              <th scope="col" className="dup-col-amount">Potential impact</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const isExpanded = expandedKey === group.identityKey;
              return (
                <Fragment key={group.identityKey}>
                  <tr className={'dup-row' + (isExpanded ? ' dup-row-expanded' : '')}>
                    <td className="dup-col-toggle">
                      <button
                        type="button"
                        className="tx-toggle-btn"
                        onClick={() => setExpandedKey(isExpanded ? null : group.identityKey)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && isExpanded) {
                            e.preventDefault();
                            setExpandedKey(null);
                          }
                        }}
                        aria-expanded={isExpanded}
                        aria-controls={`dup-members-${encodeURIComponent(group.identityKey)}`}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} duplicate group ${group.identityKey} with ${group.count} members`}
                      >
                        <span className="tx-toggle-chevron" aria-hidden="true">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <span className="mono">{group.identityKey}</span>
                      </button>
                    </td>
                    <td>{group.currency}</td>
                    <td className="dup-col-count mono">{group.count}</td>
                    <td className={'dup-col-amount mono ' + amountClass(group.potentialSignedImpact)}>
                      {formatSignedMoney(group.potentialSignedImpact)}
                    </td>
                    <td>
                      <span className="pill pill-cat-dup">Duplicate group</span>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr
                      className="dup-members-row"
                      id={`dup-members-${encodeURIComponent(group.identityKey)}`}
                    >
                      <td colSpan={5}>
                        <DuplicateGroupMembers
                          group={group}
                          txById={txById}
                          partyName={detail.partyName}
                          onFocus={onFocusTransaction}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="party-tab-footer">
        <span>
          {groups.length} of {detail.duplicateGroups.length} duplicate groups
        </span>
        <span className="party-tab-totals">
          {totals.USD !== 0 && (
            <span className={'mono ' + amountClass(totals.USD)}>
              USD impact {formatSignedMoney(totals.USD)}
            </span>
          )}
          {totals.CAD !== 0 && (
            <span className={'mono ' + amountClass(totals.CAD)}>
              CAD impact {formatSignedMoney(totals.CAD)}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------
// Filter bar
// ----------------------------------------------------------
function DuplicatesFilterBar({
  currency, query, sortMode,
  onCurrencyChange, onQueryChange, onSortChange,
}: {
  currency: DupCurrencyFilter;
  query: string;
  sortMode: DupSortMode;
  onCurrencyChange: (v: DupCurrencyFilter) => void;
  onQueryChange: (v: string) => void;
  onSortChange: (v: DupSortMode) => void;
}) {
  return (
    <div className="party-tab-filter-bar">
      <label className="filter-field">
        <span className="filter-label">CURRENCY</span>
        <select value={currency} onChange={e => onCurrencyChange(e.target.value as DupCurrencyFilter)}>
          <option value="ALL">All</option>
          <option value="USD">USD</option>
          <option value="CAD">CAD</option>
        </select>
      </label>

      <label className="filter-field filter-field-grow">
        <span className="filter-label">SEARCH</span>
        <input
          type="search"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="identity key, member ref, invoice, crdr"
        />
      </label>

      <label className="filter-field">
        <span className="filter-label">SORT</span>
        <select value={sortMode} onChange={e => onSortChange(e.target.value as DupSortMode)}>
          <option value="impact-desc">Impact desc (default)</option>
          <option value="impact-asc">Impact asc</option>
          <option value="count-desc">Members desc</option>
          <option value="identity-asc">Identity key</option>
        </select>
      </label>
    </div>
  );
}

// ----------------------------------------------------------
// Member rows (expanded under each group)
// ----------------------------------------------------------
function DuplicateGroupMembers({
  group,
  txById,
  partyName,
  onFocus,
}: {
  group: DuplicateGroupDetail;
  txById: Map<string, PreviewTransaction>;
  partyName: string;
  onFocus: (txId: string | null) => void;
}) {
  // Resolve members; preserve group order. Some ids may not be in the
  // party's tx set (theoretically possible if group bridges parties —
  // baseline shows 0 such cases but defensive code matters).
  const members = group.transactionIds.map(tid => ({
    id: tid,
    tx: txById.get(tid) ?? null,
  }));

  return (
    <div className="dup-members-panel">
      <div className="dup-members-header">
        <span className="trace-section-label">MEMBERS ({group.count})</span>
        <span className="muted-small">
          Identity: <span className="mono">{group.identityKey}</span> · {partyName}
        </span>
      </div>
      <table className="dup-members-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Direction</th>
            <th className="dup-member-amount">Amount</th>
            <th>Date</th>
            <th>Reference</th>
            <th>Source</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ id, tx }) => {
            if (!tx) {
              // Defensive — id present but tx not in this party's set
              return (
                <tr key={id} className="dup-member-row dup-member-missing">
                  <td colSpan={7} className="muted-small mono">
                    {id} — transaction not found in this party's set
                  </td>
                </tr>
              );
            }
            return (
              <tr key={id} className="dup-member-row">
                <td>{tx.sourceType}</td>
                <td><DirectionBadge direction={tx.direction} /></td>
                <td className={'dup-member-amount mono ' + amountClass(tx.signedBalance)}>
                  {formatSignedMoney(tx.signedBalance)}
                </td>
                <td className="mono">{displayDate(tx) || '—'}</td>
                <td className="mono">{pickReference(tx)}</td>
                <td className="mono muted-small">
                  {tx.trace.sourceFile}:{tx.trace.sourceRow}
                </td>
                <td>
                  <button
                    type="button"
                    className="erp-match-link"
                    onClick={() => onFocus(tx.id)}
                    title="Switch to Transactions tab and focus this row"
                  >
                    → View tx
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Header sub-component
// ============================================================

function PartyHeader({
  detail,
  onBack,
}: {
  detail: PartyDetail;
  onBack: () => void;
}) {
  const { dominant, breakdown } = detail.department;
  const deptDisplay =
    dominant !== null
      ? deptLabel(dominant)
      : breakdown.length > 0
        ? `Mixed (${breakdown
            .slice(0, 3)
            .map(b => `${b.department ?? 'UNKNOWN'} ${b.count}`)
            .join(', ')}${breakdown.length > 3 ? '…' : ''})`
        : '—';

  return (
    <section className="party-header">
      <div className="party-header-top">
        <div>
          <h1 className="dashboard-title">{detail.partyName}</h1>
          <div className="party-key-mono">{detail.partyKey}</div>
          {detail.partyNameVariants.length > 1 && (
            <div className="party-aliases">
              Aliases seen:{' '}
              {detail.partyNameVariants
                .filter(v => v !== detail.partyName)
                .slice(0, 3)
                .map((v, i, arr) => (
                  <span key={v}>
                    {v}
                    {i < arr.length - 1 ? ', ' : ''}
                  </span>
                ))}
            </div>
          )}
          <div className="party-meta">Department: {deptDisplay}</div>
        </div>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="party-header-kpis">
        <PartyStatusPill status={detail.status} />
        <PartyCurrencyPills detail={detail} />
      </div>
    </section>
  );
}

function PartyStatusPill({ status }: { status: PartyStatus }) {
  const cls =
    status === 'Clean'
      ? 'pill-clean'
      : status === 'Has issues'
        ? 'pill-warn'
        : 'pill-info';
  return (
    <div className="party-kpi">
      <div className="party-kpi-label">STATUS</div>
      <div className={`party-kpi-value ${cls}`}>{status}</div>
    </div>
  );
}

function PartyCurrencyPills({ detail }: { detail: PartyDetail }) {
  // Spec D5: USD and CAD are NEVER summed. Render side-by-side.
  if (detail.currencyTotals.length === 0) {
    return (
      <div className="party-kpi">
        <div className="party-kpi-label">NET BALANCE</div>
        <div className="party-kpi-value muted">— (no transactions)</div>
      </div>
    );
  }
  return (
    <>
      {detail.currencyTotals.map(c => (
        <div className="party-kpi" key={c.currency}>
          <div className="party-kpi-label">
            NET {c.currency}
            {c.agingNinetyPlusCount > 0 ? ` · ${c.agingNinetyPlusCount} @ 90+` : ''}
          </div>
          <div
            className={
              'party-kpi-value ' +
              (c.netBalance < 0 ? 'amount-neg' : 'amount-pos')
            }
          >
            {formatSignedMoney(c.netBalance)}
          </div>
        </div>
      ))}
    </>
  );
}

// ============================================================
// Summary Cards sub-component
// ============================================================

interface CardSpec {
  key: string;
  label: string;
  count: number;
  tab: ActiveTab;
  emphasis?: 'warn' | 'critical';
}

function PartySummaryCards({
  detail,
  onCardClick,
}: {
  detail: PartyDetail;
  onCardClick: (tab: ActiveTab) => void;
}) {
  const s = detail.summary;

  // Six cards per spec §"Summary Cards". Each click switches tab via
  // the parent's setActiveTab. Filter activation (e.g. open Reviews
  // tab AND filter to NOT_IN_ERP) is wired in Step 5+ when the tab
  // panel learns to read filter from URL/local state.
  const cards: CardSpec[] = [
    { key: 'tx',       label: 'TOTAL TRANSACTIONS',   count: s.totalTransactions, tab: 'transactions' },
    { key: 'stmt',     label: 'STATEMENT ROWS',       count: s.statementRows,     tab: 'statements' },
    { key: 'matched',  label: 'ERP MATCHED',          count: s.erpMatched,        tab: 'statements' },
    { key: 'notInErp', label: 'NOT IN ERP EXTRACT',   count: s.notInErpExtract,   tab: 'reviews',
      emphasis: s.notInErpExtract > 0 ? 'warn' : undefined },
    { key: 'dup',      label: 'DUPLICATE FLAGS',      count: s.duplicateFlags,    tab: 'duplicates',
      emphasis: s.duplicateFlags > 0 ? 'warn' : undefined },
    { key: 'warn',     label: 'WARNINGS',             count: s.warnings,          tab: 'reviews',
      emphasis: s.warnings > 0 ? 'warn' : undefined },
  ];

  return (
    <section className="party-summary-cards">
      {cards.map(card => (
        <button
          type="button"
          key={card.key}
          className={
            'party-summary-card' +
            (card.emphasis === 'warn' ? ' party-summary-card-warn' : '')
          }
          onClick={() => onCardClick(card.tab)}
          aria-label={`${card.label}: ${card.count}. Open ${card.tab} tab.`}
        >
          <div className="party-summary-label">{card.label}</div>
          <div className="party-summary-value">{card.count}</div>
        </button>
      ))}
    </section>
  );
}
