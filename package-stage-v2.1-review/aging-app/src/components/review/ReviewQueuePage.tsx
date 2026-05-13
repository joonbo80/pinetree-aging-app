import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type {
  DuplicateGroupDetail,
  ParsingPreviewResult,
  PreviewTransaction,
  ReviewCategory,
  ReviewItem,
  StatementLink,
  TraceRef,
} from '../../parsing-engine/types';

type ReviewRoute =
  | 'warnings'
  | 'aging-90-plus'
  | 'duplicates'
  | 'not-in-erp-extract'
  | 'unknown-department';

type CurrencyFilter = 'ALL' | 'USD' | 'CAD';
type DirectionFilter = 'ALL' | 'receivable' | 'payable' | 'settled';
type SortMode = 'amount-desc' | 'aging-desc' | 'party-asc' | 'source-row-asc';

interface ReviewQueuePageProps {
  result: ParsingPreviewResult | null;
}

interface CategoryMeta {
  route: ReviewRoute;
  category: ReviewCategory | 'DUPLICATE_GROUPS';
  label: string;
  description: string;
}

interface DisplayRow {
  id: string;
  category: ReviewRoute;
  severity: string;
  reasonCode: string;
  reason: string;
  partyKey: string | null;
  partyName: string;
  currency: 'USD' | 'CAD' | null;
  direction: PreviewTransaction['direction'] | null;
  amount: number | null;
  agingDays: number | null;
  sourceType: PreviewTransaction['sourceType'] | 'STATEMENT' | 'DUPLICATE';
  trace: TraceRef | null;
  transaction: PreviewTransaction | null;
  reviewItem: ReviewItem | null;
  duplicateGroup: DuplicateGroupDetail | null;
  statementLink: StatementLink | null;
  exportExtra: Record<string, unknown>;
}

const CATEGORIES: CategoryMeta[] = [
  {
    route: 'warnings',
    category: 'WARNINGS',
    label: 'Warnings',
    description: 'Rows with parser warnings such as duplicates, cross-currency parties, or unusual balances.',
  },
  {
    route: 'aging-90-plus',
    category: 'AGING_90_PLUS',
    label: '90+ Aging',
    description: 'Open receivable or payable rows whose aging bucket is 90+.',
  },
  {
    route: 'duplicates',
    category: 'DUPLICATE_GROUPS',
    label: 'Duplicate Groups',
    description: 'Exact duplicate groups kept in totals and flagged for human review.',
  },
  {
    route: 'not-in-erp-extract',
    category: 'NOT_IN_ERP_EXTRACT',
    label: 'Not In ERP Extract',
    description: 'Strict local statement rows that are not found in the uploaded ERP extract.',
  },
  {
    route: 'unknown-department',
    category: 'UNKNOWN_DEPARTMENT',
    label: 'Unknown Department',
    description: 'Rows whose department could not be mapped to the standard department set.',
  },
];

function money(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function routeToMeta(route?: string): CategoryMeta | null {
  return CATEGORIES.find(item => item.route === route) ?? null;
}

function indexByTransaction(result: ParsingPreviewResult) {
  return new Map(result.details?.transactions.map(row => [row.id, row]) ?? []);
}

function statementByReviewItem(result: ParsingPreviewResult, item: ReviewItem) {
  if (item.category !== 'NOT_IN_ERP_EXTRACT') return null;
  const invoiceNo = typeof item.details.invoiceNo === 'string' ? item.details.invoiceNo : null;
  const ourRefNo = typeof item.details.ourRefNo === 'string' ? item.details.ourRefNo : null;
  return result.details?.statementLinks.find(link =>
    link.source === 'LOCAL' &&
    link.sourceRow === item.trace?.sourceRow &&
    link.invoiceNo === invoiceNo &&
    link.ourRefNo === ourRefNo
  ) ?? null;
}

function rowFromReviewItem(
  route: ReviewRoute,
  item: ReviewItem,
  txById: Map<string, PreviewTransaction>,
  statementLink: StatementLink | null,
): DisplayRow {
  const tx = item.transactionId ? txById.get(item.transactionId) ?? null : null;
  const partyKey = item.partyKey ?? tx?.partyKey ?? statementLink?.partyKey ?? null;
  const partyName = tx?.partyName ?? partyKey ?? '-';
  const agingDays = typeof item.details.agingDays === 'number' ? item.details.agingDays : tx?.agingDays ?? null;

  return {
    id: item.id,
    category: route,
    severity: item.severity,
    reasonCode: item.reasonCode,
    reason: item.reason,
    partyKey,
    partyName,
    currency: item.currency ?? tx?.currency ?? statementLink?.currency ?? null,
    direction: tx?.direction ?? null,
    amount: item.amount ?? statementLink?.statementBalance ?? tx?.absoluteBalance ?? null,
    agingDays,
    sourceType: tx?.sourceType ?? (statementLink ? 'STATEMENT' : 'STATEMENT'),
    trace: item.trace ?? tx?.trace ?? null,
    transaction: tx,
    reviewItem: item,
    duplicateGroup: null,
    statementLink,
    exportExtra: item.details,
  };
}

function rowsForCategory(result: ParsingPreviewResult, route: ReviewRoute): DisplayRow[] {
  const txById = indexByTransaction(result);

  if (route === 'duplicates') {
    return (result.details?.duplicateGroups ?? []).map(group => {
      const member = group.transactionIds.map(id => txById.get(id)).find(Boolean) ?? null;
      return {
        id: `duplicate-${group.identityKey}-${group.currency}`,
        category: route,
        severity: 'warning',
        reasonCode: 'W1_DUPLICATE',
        reason: `Duplicate group with ${group.count} rows`,
        partyKey: member?.partyKey ?? null,
        partyName: member?.partyName ?? '-',
        currency: group.currency,
        direction: member?.direction ?? null,
        amount: group.potentialSignedImpact,
        agingDays: null,
        sourceType: 'DUPLICATE',
        trace: member?.trace ?? null,
        transaction: member,
        reviewItem: null,
        duplicateGroup: group,
        statementLink: null,
        exportExtra: { transactionIds: group.transactionIds },
      };
    });
  }

  const meta = routeToMeta(route);
  if (!meta || meta.category === 'DUPLICATE_GROUPS') return [];

  return (result.details?.reviewItems ?? [])
    .filter(item => item.category === meta.category)
    .map(item => rowFromReviewItem(route, item, txById, statementByReviewItem(result, item)));
}

function categoryCount(result: ParsingPreviewResult, route: ReviewRoute) {
  if (route === 'duplicates') return result.details?.duplicateGroups.length ?? 0;
  const meta = routeToMeta(route);
  if (!meta || meta.category === 'DUPLICATE_GROUPS') return 0;
  return result.details?.reviewItems.filter(item => item.category === meta.category).length ?? 0;
}

function categoryImpact(result: ParsingPreviewResult, route: ReviewRoute) {
  if (route === 'duplicates') return result.duplicateReview.potentialSignedImpact;
  return rowsForCategory(result, route).reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

function matchesSearch(row: DisplayRow, query: string) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    row.partyName,
    row.partyKey,
    row.reason,
    row.reasonCode,
    row.currency,
    row.direction,
    row.sourceType,
    row.trace?.sourceFile,
    row.transaction?.ourRefNo,
    row.transaction?.invoiceNo,
    row.transaction?.crdrNo,
    row.transaction?.vendorInvoiceNo,
    row.statementLink?.invoiceNo,
    row.statementLink?.ourRefNo,
    row.statementLink?.crdrNo,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function filterAndSortRows(
  rows: DisplayRow[],
  currency: CurrencyFilter,
  direction: DirectionFilter,
  query: string,
  sort: SortMode,
) {
  const filtered = rows.filter(row => {
    if (currency !== 'ALL' && row.currency !== currency) return false;
    if (direction !== 'ALL' && row.direction !== direction) return false;
    return matchesSearch(row, query);
  });

  return filtered.sort((a, b) => {
    if (sort === 'aging-desc') return (b.agingDays ?? -1) - (a.agingDays ?? -1);
    if (sort === 'party-asc') return a.partyName.localeCompare(b.partyName);
    if (sort === 'source-row-asc') return (a.trace?.sourceRow ?? 0) - (b.trace?.sourceRow ?? 0);
    return Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0);
  });
}

function makeCsv(rows: DisplayRow[], category: string) {
  const headers = [
    'category',
    'severity',
    'reasonCode',
    'reason',
    'partyKey',
    'partyName',
    'currency',
    'direction',
    'amount',
    'sourceType',
    'sourceFile',
    'sourceSheet',
    'sourceRow',
    'transactionId',
    'transactionIds',
  ];

  const data = rows.map(row => [
    category,
    row.severity,
    row.reasonCode,
    row.reason,
    row.partyKey ?? '',
    row.partyName,
    row.currency ?? '',
    row.direction ?? '',
    row.amount ?? '',
    row.sourceType,
    row.trace?.sourceFile ?? '',
    row.trace?.sourceSheet ?? '',
    row.trace?.sourceRow ?? '',
    row.transaction?.id ?? row.reviewItem?.transactionId ?? '',
    row.duplicateGroup?.transactionIds.join(';') ?? '',
  ]);

  const csv = [headers, ...data]
    .map(cols => cols.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  // UTF-8 BOM keeps Korean party names readable when opened directly in Excel.
  return `\uFEFF${csv}`;
}

function exportRows(rows: DisplayRow[], route: ReviewRoute) {
  const csv = makeCsv(rows, route);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aging-review-${route}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TracePanel({ row }: { row: DisplayRow }) {
  const details = row.reviewItem?.details ?? row.exportExtra;
  const detailRows = Object.entries(details).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const memberIds = row.duplicateGroup?.transactionIds ?? [];

  return (
    <div className="trace-panel">
      <div className="trace-grid">
        <TraceItem label="Source file" value={row.trace?.sourceFile ?? row.statementLink?.sourceFile ?? '-'} />
        <TraceItem label="Source sheet" value={row.trace?.sourceSheet || '-'} />
        <TraceItem label="Source row" value={row.trace?.sourceRow?.toString() ?? row.statementLink?.sourceRow?.toString() ?? '-'} />
        <TraceItem label="Transaction ID" value={row.transaction?.id ?? row.reviewItem?.transactionId ?? '-'} />
        <TraceItem label="Party key" value={row.partyKey ?? '-'} />
        <TraceItem label="Reason" value={row.reason} />
      </div>

      {detailRows.length > 0 && (
        <div className="trace-kv">
          {detailRows.map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <b>{String(value)}</b>
            </div>
          ))}
        </div>
      )}

      {memberIds.length > 0 && (
        <div className="trace-members">
          <span>Duplicate members</span>
          <code>{memberIds.join(' | ')}</code>
        </div>
      )}
    </div>
  );
}

function TraceItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ReviewIndex({ result }: { result: ParsingPreviewResult }) {
  return (
    <main className="app-content review-page">
      <div className="app-subtitle">Phase 2 v2.1 - Review Queue</div>
      <div className="dashboard-topline">
        <div>
          <h2 className="dashboard-title">Review Queue</h2>
          <p className="review-subtitle">Choose a review category and trace every number back to its source row.</p>
        </div>
        <Link className="btn" to="/dashboard">Back to Dashboard</Link>
      </div>

      <section className="review-index-grid">
        {CATEGORIES.map(meta => {
          const count = categoryCount(result, meta.route);
          const impact = categoryImpact(result, meta.route);
          return (
            <Link className="review-card" to={`/review/${meta.route}`} key={meta.route}>
              <span className="review-card-label">{meta.label}</span>
              <b>{count.toLocaleString()}</b>
              <small>{money(impact)}</small>
              <p>{meta.description}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function ReviewCategoryPage({ result, route }: { result: ParsingPreviewResult; route: ReviewRoute }) {
  const navigate = useNavigate();
  const meta = routeToMeta(route);
  const [currency, setCurrency] = useState<CurrencyFilter>('ALL');
  const [direction, setDirection] = useState<DirectionFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('amount-desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(() => rowsForCategory(result, route), [result, route]);
  const filteredRows = useMemo(
    () => filterAndSortRows([...rows], currency, direction, query, sort),
    [rows, currency, direction, query, sort],
  );

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        if (row.currency === 'USD') acc.usd += row.amount ?? 0;
        if (row.currency === 'CAD') acc.cad += row.amount ?? 0;
        return acc;
      },
      { usd: 0, cad: 0 },
    );
  }, [filteredRows]);

  if (!meta) {
    return (
      <main className="app-content">
        <div className="empty">
          <h2 className="empty-title">No items in this category.</h2>
          <p className="empty-sub">The requested review category is not defined.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/review')}>Review Queue</button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-content review-page">
      <div className="app-subtitle">Phase 2 v2.1 - Review Queue</div>
      <div className="dashboard-topline">
        <div>
          <h2 className="dashboard-title">{meta.label}</h2>
          <p className="review-subtitle">{meta.description}</p>
        </div>
        <div className="placeholder-actions">
          <Link className="btn" to="/review">Review Index</Link>
          <Link className="btn" to="/dashboard">Back to Dashboard</Link>
        </div>
      </div>

      <section className="review-summary-bar">
        <div>
          <span>Rows</span>
          <b>{filteredRows.length.toLocaleString()} / {rows.length.toLocaleString()}</b>
        </div>
        <div>
          <span>USD impact</span>
          <b>{money(totals.usd)}</b>
        </div>
        <div>
          <span>CAD impact</span>
          <b>{money(totals.cad)}</b>
        </div>
      </section>

      <section className="review-filter-bar">
        <label>
          <span>Currency</span>
          <select value={currency} onChange={event => setCurrency(event.target.value as CurrencyFilter)}>
            <option value="ALL">All</option>
            <option value="USD">USD</option>
            <option value="CAD">CAD</option>
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select value={direction} onChange={event => setDirection(event.target.value as DirectionFilter)}>
            <option value="ALL">All</option>
            <option value="receivable">Receivable</option>
            <option value="payable">Payable</option>
            <option value="settled">Settled</option>
          </select>
        </label>
        <label className="review-search">
          <span>Search</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="party, ref, invoice, source file, reason"
          />
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={event => setSort(event.target.value as SortMode)}>
            <option value="amount-desc">Amount desc</option>
            <option value="aging-desc">Aging desc</option>
            <option value="party-asc">Party asc</option>
            <option value="source-row-asc">Source row asc</option>
          </select>
        </label>
      </section>

      <section className="panel">
        {filteredRows.length === 0 ? (
          <div className="empty inline-empty">
            <h3 className="empty-title">No items in this category.</h3>
            <p className="empty-sub">Try clearing filters.</p>
          </div>
        ) : (
          <table className="data review-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Party</th>
                <th>Currency</th>
                <th>Direction</th>
                <th className="num">Amount</th>
                <th className="num">Aging</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="review-row"
                      tabIndex={0}
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setExpandedId(expanded ? null : row.id);
                        }
                        if (event.key === 'Escape') setExpandedId(null);
                      }}
                    >
                      <td>
                        <b>{row.reasonCode}</b>
                        <small>{row.reason}</small>
                      </td>
                      <td>
                        {row.partyKey ? (
                          <Link
                            to={`/party/${encodeURIComponent(row.partyKey)}`}
                            onClick={event => event.stopPropagation()}
                          >
                            {row.partyName}
                          </Link>
                        ) : (
                          row.partyName
                        )}
                      </td>
                      <td>{row.currency ?? '-'}</td>
                      <td>{row.direction ?? '-'}</td>
                      <td className="num">{money(row.amount)}</td>
                      <td className="num">{row.agingDays ?? '-'}</td>
                      <td className="mono review-source">
                        {row.trace ? `${row.trace.sourceFile}:${row.trace.sourceRow}` : '-'}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="trace-row">
                        <td colSpan={7}>
                          <TracePanel row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="footer-actions">
        <span className="panel-subtitle">{filteredRows.length.toLocaleString()} filtered rows</span>
        <button type="button" className="btn btn-mono" onClick={() => exportRows(filteredRows, route)}>
          Export CSV
        </button>
      </div>
    </main>
  );
}

export function ReviewQueuePage({ result }: ReviewQueuePageProps) {
  const params = useParams();
  const route = params.type as ReviewRoute | undefined;

  if (!result) {
    return (
      <main className="app-content">
        <div className="empty">
          <h2 className="empty-title">No data loaded yet</h2>
          <p className="empty-sub">Load or upload data before opening the Review Queue.</p>
          <Link className="btn btn-primary" to="/">Upload Preview</Link>
        </div>
      </main>
    );
  }

  if (!result.details) {
    return (
      <main className="app-content">
        <div className="notice warn">Drill-down requires schema 1.1 details. This payload can still be reviewed in summary mode.</div>
        <div className="empty">
          <h2 className="empty-title">Review Queue unavailable</h2>
          <p className="empty-sub">Use the Upload Preview tabs for this summary-only payload.</p>
          <Link className="btn btn-primary" to="/">Upload Preview</Link>
        </div>
      </main>
    );
  }

  if (!route) return <ReviewIndex result={result} />;
  return <ReviewCategoryPage result={result} route={route} />;
}
