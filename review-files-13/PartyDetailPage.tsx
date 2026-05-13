// components/party/PartyDetailPage.tsx
//
// Phase 2 v2.2 Step 4 — header + summary cards.
// Tabs and tab content arrive in Steps 5-9. This file is the landing
// shell users see when they click a /party/:partyKey link.
//
// Architecture: PartyDetailPage is a pure render of selectPartyDetail()
// output plus minimal local UI state (active tab, filters). No data
// shaping happens here.
//
// Spec references:
//   §"Header"             — title, key, dept, status, currency totals
//   §"Summary Cards"      — 6 cards, each clickable to switch tab
//   §"Empty States"       — unknown party + statement-only
//   §"Schema 1.0"         — graceful "details unavailable" notice
//   §D1                   — default tab is Transactions
//   §D5                   — USD/CAD never summed

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  ParsingPreviewResult,
  PartyDetail,
  PartyStatus,
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

  // Compute selector output once per render. The selector is fast
  // (<10ms even on the largest party) so memoization is mostly for
  // referential stability of the returned arrays.
  const detail = useMemo(
    () => selectPartyDetail(partyKey, result),
    [partyKey, result],
  );

  // ----------------------------------------------------------
  // Schema 1.0 / no-result fallback
  // ----------------------------------------------------------
  // If the result loaded but lacks `details`, this is schema 1.0.
  // Per spec, show notice and offer Back to Dashboard.
  // We distinguish this from "unknown party" — the latter is handled
  // inside the page render below.
  if (result && !result.details) {
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

      {/* Step 5+ tabs go here. For Step 4, show a simple placeholder
          so the page is testable end-to-end. */}
      <section className="placeholder-panel" data-tab-placeholder>
        <h3 className="empty-title">Tab: {activeTab}</h3>
        <p className="empty-sub">
          Tab rendering arrives in v2.2 Step 5&ndash;9. Selector data is
          ready; the active selection is preserved in local state.
        </p>
      </section>
    </main>
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
