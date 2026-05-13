// components/party/csvExport.ts
//
// Phase 2 v2.2 Step 11 — CSV export for Party Detail tabs.
//
// Reuses v2.1 Review Queue CSV pattern (UTF-8 BOM, double-quote
// escape, ISO-ish timestamp) but extended to 4 tab variants:
//
//   transactions   - the Transactions tab rows
//   statements     - the Statements tab rows
//   reviews        - the Reviews tab rows
//   duplicates     - the Duplicates tab group + member rows (flattened)
//
// Filename convention (per spec):
//   aging-party-{partyKey}-{tab}-{YYYYMMDD-HHmm}.csv
//
// Each export captures EXACTLY what the user sees on the tab:
//   - The trace columns (sourceFile / sourceSheet / sourceRow) so the
//     CSV is auditable back to the originating file/row.
//   - The visible business columns of the tab.
//   - The party identity (partyKey + partyName) on every row, so a
//     downstream merge across multiple party CSVs reconciles cleanly.
//
// This file is intentionally separate from PartyDetailPage.tsx —
// per reviewer guidance, the page file is approaching unmanageable
// size and Step 11 is a natural seam for the first split.

import type {
  PartyDetail,
  PreviewTransaction,
} from '../../parsing-engine/types';

// ============================================================
// Public API
// ============================================================

export type CsvTab = 'transactions' | 'statements' | 'reviews' | 'duplicates';

export function exportPartyTabCsv(detail: PartyDetail, tab: CsvTab): void {
  const csv = buildCsv(detail, tab);
  const filename = makeFilename(detail.partyKey, tab);
  triggerDownload(csv, filename);
}

// Exported for testing — invariant tests call this directly to verify
// the CSV body without exercising the DOM download path.
export function buildCsv(detail: PartyDetail, tab: CsvTab): string {
  switch (tab) {
    case 'transactions': return buildTransactionsCsv(detail);
    case 'statements':   return buildStatementsCsv(detail);
    case 'reviews':      return buildReviewsCsv(detail);
    case 'duplicates':   return buildDuplicatesCsv(detail);
  }
}

// Exported for testing — filename format is part of the spec.
export function makeFilename(partyKey: string, tab: CsvTab, now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');
  const mi   = String(now.getMinutes()).padStart(2, '0');
  return `aging-party-${partyKey}-${tab}-${yyyy}${mm}${dd}-${hh}${mi}.csv`;
}

// ============================================================
// Per-tab builders
// ============================================================

function buildTransactionsCsv(detail: PartyDetail): string {
  const headers = [
    'partyKey', 'partyName',
    'sourceType', 'direction', 'currency',
    'signedBalance', 'rawBalance', 'isZeroBalance',
    'agingDays', 'agingBucket', 'agingBasisDate',
    'invoiceDate', 'postDate',
    'department',
    'ourRefNo', 'invoiceNo', 'crdrNo', 'vendorInvoiceNo', 'vendorName', 'blNo',
    'flags',
    'sourceFile', 'sourceSheet', 'sourceRow',
    'transactionId',
  ];

  const rows = detail.transactions.map(t => [
    detail.partyKey, detail.partyName,
    t.sourceType, t.direction, t.currency,
    t.signedBalance, t.rawBalance, t.isZeroBalance ? 'yes' : 'no',
    t.agingDays, t.agingBucket, t.agingBasisDate,
    t.invoiceDate ?? '', t.postDate ?? '',
    t.department ?? '',
    t.ourRefNo ?? '', t.invoiceNo ?? '', t.crdrNo ?? '',
    t.vendorInvoiceNo ?? '', t.vendorName ?? '', t.blNo ?? '',
    t.flags.join(';'),
    t.trace.sourceFile, t.trace.sourceSheet ?? '', t.trace.sourceRow,
    t.id,
  ]);

  return assembleCsv(headers, rows);
}

function buildStatementsCsv(detail: PartyDetail): string {
  // Replicate the strict-vs-broad NOT_IN_ERP distinction from Step 7
  // so the CSV match-type column matches the on-screen label.
  const strictKeys = new Set<string>();
  for (const r of detail.reviewItems) {
    if (r.category !== 'NOT_IN_ERP_EXTRACT' || !r.trace) continue;
    strictKeys.add(`${r.trace.sourceFile}|${r.trace.sourceRow}`);
  }
  const isStrict = (sourceFile: string, sourceRow: number) =>
    strictKeys.has(`${sourceFile}|${sourceRow}`);

  // Index party transactions for matched-tx lookup
  const txById = new Map<string, PreviewTransaction>();
  for (const t of detail.transactions) txById.set(t.id, t);

  const headers = [
    'partyKey', 'partyName',
    'source',           // LOCAL / AGENT
    'currency', 'statementBalance',
    'matchType',        // raw enum value
    'matchTypeLabel',   // human label (Confirmed not in ERP / Not in uploaded ERP extract / etc.)
    'ourRefNo', 'invoiceNo', 'crdrNo',
    'matchedTransactionId',
    'matchedTxSourceFile', 'matchedTxSourceRow', 'matchedTxSigned',
    'delta',            // for BALANCE_DIFFERENCE: stmt - tx, else blank
    'referenceStatus', 'differenceType',
    'sourceFile', 'sourceRow',
  ];

  const rows = detail.statementLinks.map(l => {
    const strict = l.matchType === 'NOT_IN_ERP_EXTRACT' && isStrict(l.sourceFile, l.sourceRow);
    const matchTypeLabel =
      l.matchType === 'NOT_IN_ERP_EXTRACT' && strict ? 'Confirmed not in ERP' :
      l.matchType === 'NOT_IN_ERP_EXTRACT'           ? 'Not in uploaded ERP extract' :
      l.matchType === 'BALANCE_DIFFERENCE'           ? 'Balance difference' :
      l.matchType === 'CHANGED_AFTER_STATEMENT'      ? 'Changed after statement' :
      l.matchType === 'SETTLED_AFTER_STATEMENT'      ? 'Settled after statement' :
      l.matchType === 'EXACT_SIGNED'                 ? 'Exact' :
      l.matchType;

    const matchedTx = l.matchedTransactionId ? txById.get(l.matchedTransactionId) ?? null : null;
    const delta = matchedTx && l.matchType === 'BALANCE_DIFFERENCE'
      ? Math.round((l.statementBalance - matchedTx.signedBalance) * 100) / 100
      : '';

    return [
      detail.partyKey, detail.partyName,
      l.source,
      l.currency, l.statementBalance,
      l.matchType, matchTypeLabel,
      l.ourRefNo ?? '', l.invoiceNo ?? '', l.crdrNo ?? '',
      l.matchedTransactionId ?? '',
      matchedTx?.trace.sourceFile ?? '',
      matchedTx?.trace.sourceRow ?? '',
      matchedTx?.signedBalance ?? '',
      delta,
      l.referenceStatus ?? '', l.differenceType ?? '',
      l.sourceFile, l.sourceRow,
    ];
  });

  return assembleCsv(headers, rows);
}

function buildReviewsCsv(detail: PartyDetail): string {
  const headers = [
    'partyKey', 'partyName',
    'category', 'reasonCode', 'severity',
    'reason',
    'currency', 'amount',
    'transactionId',
    'sourceFile', 'sourceSheet', 'sourceRow',
    'reviewItemId',
  ];

  const rows = detail.reviewItems.map(r => [
    detail.partyKey, detail.partyName,
    r.category, r.reasonCode, r.severity,
    r.reason,
    r.currency ?? '', r.amount ?? '',
    r.transactionId ?? '',
    r.trace?.sourceFile ?? '',
    r.trace?.sourceSheet ?? '',
    r.trace?.sourceRow ?? '',
    r.id,
  ]);

  return assembleCsv(headers, rows);
}

function buildDuplicatesCsv(detail: PartyDetail): string {
  // Flatten: one row per (group, member). Group-level columns repeat
  // across the group's members so the CSV is self-contained and a
  // pivot/sort by groupIdentityKey reproduces the UI grouping.
  const headers = [
    'partyKey', 'partyName',
    'groupIdentityKey', 'groupCurrency', 'groupCount', 'groupPotentialImpact',
    'memberTransactionId',
    'memberSourceType', 'memberDirection', 'memberSignedBalance',
    'memberInvoiceDate', 'memberPostDate',
    'memberOurRefNo', 'memberInvoiceNo', 'memberCrdrNo', 'memberVendorInvoiceNo',
    'memberSourceFile', 'memberSourceSheet', 'memberSourceRow',
  ];

  const txById = new Map<string, PreviewTransaction>();
  for (const t of detail.transactions) txById.set(t.id, t);

  const rows: Array<Array<string | number>> = [];
  for (const g of detail.duplicateGroups) {
    for (const tid of g.transactionIds) {
      const tx = txById.get(tid) ?? null;
      rows.push([
        detail.partyKey, detail.partyName,
        g.identityKey, g.currency, g.count, g.potentialSignedImpact,
        tid,
        tx?.sourceType ?? '',
        tx?.direction ?? '',
        tx?.signedBalance ?? '',
        tx?.invoiceDate ?? '', tx?.postDate ?? '',
        tx?.ourRefNo ?? '', tx?.invoiceNo ?? '', tx?.crdrNo ?? '', tx?.vendorInvoiceNo ?? '',
        tx?.trace.sourceFile ?? '',
        tx?.trace.sourceSheet ?? '',
        tx?.trace.sourceRow ?? '',
      ]);
    }
  }

  return assembleCsv(headers, rows);
}

// ============================================================
// CSV plumbing
// ============================================================

function assembleCsv(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const escape = (v: string | number | boolean): string => {
    const s = String(v);
    // Always quote — handles commas, quotes, newlines, and leading-zero
    // strings that Excel might otherwise auto-mangle.
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = [headers, ...rows]
    .map(cols => cols.map(escape).join(','))
    .join('\n');
  // UTF-8 BOM keeps non-ASCII party names readable in Excel direct-open.
  return `\uFEFF${body}`;
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
