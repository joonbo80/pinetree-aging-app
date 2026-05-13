// selectors/agingReport.ts
//
// Pure-function projection of `result.details` to an AgingReportData,
// the source of truth for the v2.3 Statement Collection Workbench (C2).
//
// Phase 2 v2.3 C2 spec rev3 (FROZEN) sections referenced:
//   3.2   Statement Status mapping (4 values)
//   3.3   Action Readiness mapping
//   3.4   Priority Band rules (Cleared FIRST precedence)
//   3.5   Tab classification formula
//   6.5.1 No Due Date open vs settled split
//   Q-A   High amount threshold (10,000 per currency, no conversion)
//
// IMPORTANT design rules (consistent with v2.2 partyDetail.ts):
//   1. NEVER mix USD and CAD in any aggregate (v1.1 LOCKED rule)
//   2. partyName is preserved as the display name from the transaction;
//      partyKey is for routing only
//   3. tab classification covers every transaction exactly once
//      (Cleared > No Due Date > Current > Overdue, isZeroBalance first)
//   4. Cleared Priority Band evaluates FIRST so settled rows never get
//      Review First / Follow Up / Monitor labels
//   5. NOT_IN_ERP_EXTRACT (95 records in baseline) does NOT appear in
//      party rollup -- those are orphan statementLinks with no matched
//      transaction; surfaced via Review Queue cross-link instead
//   6. Baseline coverage at default asOfDate 2026-05-01 (artifact-verified):
//        Current:                 21
//        Overdue:                463
//        No Due Date (open):     118
//        Cleared:                628
//        Total:                1,230

import type {
  ParsingPreviewResult,
  PreviewTransaction,
  StatementLink,
} from '../parsing-engine/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TabId = 'current' | 'overdue' | 'cleared';

/**
 * Statement Status for transaction-driven rollup (4 values).
 *
 * NOT_IN_ERP_EXTRACT (matchType) is intentionally NOT represented here
 * because those records have no matched transaction. They are routed
 * to the Review Queue via a separate cross-link chip (spec Section 3.6
 * and 7.4).
 */
export type StatementStatus =
  | 'ExactMatch'
  | 'BalanceDifference'
  | 'SettledAfterStatement'
  | 'NoStatement';

export type ActionReadiness =
  | 'ReadyToFollowUp'
  | 'ReviewStatementDifference'
  | 'MissingDueDate'
  | 'CheckDuplicate'
  | 'Cleared';

export type PriorityBand =
  | 'Cleared'
  | 'ReviewFirst'
  | 'FollowUp'
  | 'Monitor';

export type Currency = 'USD' | 'CAD';

export type Direction = 'receivable' | 'payable' | 'settled';

export interface AgingBucketBreakdown {
  '1-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
}

export interface TransactionRow {
  id: string;
  partyKey: string;
  partyName: string;
  currency: Currency;
  /**
   * Direction is part of the rollup grouping key (NEVER net AR vs AP).
   * v1.1 LOCKED rule extended in Round 1 rev2 per spec review P1-2.
   */
  direction: Direction;
  signedBalance: number;
  absoluteBalance: number;
  isZeroBalance: boolean;
  invoiceDate: string | null;
  dueDate: string | null;
  agingDays: number;
  agingBucket: string;
  invoiceNo: string | null;
  ourRefNo: string | null;
  statementStatus: StatementStatus;
  actionReadiness: ActionReadiness;
  priorityBand: PriorityBand;
  isHighAmount: boolean;
  hasDuplicateFlag: boolean;
  sourceFile: string;
  sourceRow: number;
}

export interface PartyRollup {
  partyKey: string;
  partyName: string;
  currency: Currency;
  /**
   * Rollup direction. AR (receivable) and AP (payable) under the
   * same (party, currency) are SEPARATE rollup rows -- never netted.
   */
  direction: Direction;
  openAmount: number;
  oldestAgingDays: number;
  invoiceCount: number;
  ninetyPlusCount: number;
  /** Worst-case Statement Status across the party's transactions. */
  statementStatus: StatementStatus;
  /** Worst-case Action Readiness across the party's transactions. */
  actionReadiness: ActionReadiness;
  /** Worst-case Priority Band across the party's transactions. */
  priorityBand: PriorityBand;
  transactions: TransactionRow[];
  /** Populated only on the Overdue tab; null on Current and Cleared. */
  agingBucketBreakdown: AgingBucketBreakdown | null;
}

export interface AgingTabData {
  parties: PartyRollup[];
  /**
   * Currency-separated totals further split by direction so AR and AP
   * are NEVER netted at the tab level. v2.3 C2 Round 2 rev2 fix
   * (P1-#1): the same currency LOCKED + direction-LOCKED rule that
   * applies to party rollup rows extends to tab-level totals.
   *
   * A collector reading "USD receivable 256,000 / USD payable -32,000"
   * understands the workbench owes 32k and is owed 256k. A netted
   * "USD 224,000" would be misread as "we are owed 224k".
   */
  totals: {
    USD: { receivable: number; payable: number };
    CAD: { receivable: number; payable: number };
  };
  transactionCount: number;
}

export interface NoDueDateBucket {
  /** Count of OPEN transactions without dueDate (isZeroBalance=false). */
  openCount: number;
  totals: {
    USD: number;
    CAD: number;
  };
  /** The open, no-dueDate transactions themselves. */
  transactions: TransactionRow[];
}

export interface AgingReportData {
  asOfDate: string;
  noDueDate: NoDueDateBucket;
  tabs: {
    current: AgingTabData;
    overdue: AgingTabData;
    cleared: AgingTabData;
  };
  /** Total transactions evaluated; should equal result.details.transactions.length. */
  totalTransactions: number;
  /** Coverage sum (should equal totalTransactions) -- for diagnostic. */
  coverageSum: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * High amount threshold per currency (spec Q-A).
 * No currency conversion. Each currency is evaluated independently.
 */
export const HIGH_AMOUNT_THRESHOLD: Record<Currency, number> = {
  USD: 10_000,
  CAD: 10_000,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the AgingReportData projection for the Collection Workbench.
 *
 * @param result    The parsing preview result. asOfDate is sourced from
 *                  the result if asOfDate arg is omitted.
 * @param asOfDate  Override for the reference date (YYYY-MM-DD). If
 *                  omitted, falls back to result.asOfDate.
 */
export function selectAgingReport(
  result: ParsingPreviewResult | null,
  asOfDate?: string,
): AgingReportData {
  if (!result || !result.details) {
    return emptyAgingReport(asOfDate ?? '');
  }

  const effectiveAsOf =
    asOfDate ?? result.uploadSession?.asOfDate ?? '';
  const txs = result.details.transactions;
  const stmtLinks = result.details.statementLinks;
  const duplicateGroups = result.details.duplicateGroups ?? [];

  // Build a fast lookup: transactionId -> StatementStatus
  const stmtByTxId = indexStatementLinksByTransactionId(stmtLinks);

  // Build a fast lookup: transactionId -> hasDuplicateFlag
  const duplicateTxIds = new Set<string>();
  for (const group of duplicateGroups) {
    for (const txId of group.transactionIds ?? []) {
      duplicateTxIds.add(txId);
    }
  }

  // Classify each transaction into a tab (or No Due Date), and
  // compute its row-level labels.
  const noDueDateOpenRows: TransactionRow[] = [];
  const currentRows: TransactionRow[] = [];
  const overdueRows: TransactionRow[] = [];
  const clearedRows: TransactionRow[] = [];

  for (const tx of txs) {
    const row = buildTransactionRow(
      tx,
      stmtByTxId,
      duplicateTxIds,
    );

    const bucket = classifyTab(tx, effectiveAsOf);
    if (bucket === 'cleared') {
      clearedRows.push(row);
    } else if (bucket === 'no-due-date-open') {
      noDueDateOpenRows.push(row);
    } else if (bucket === 'current') {
      currentRows.push(row);
    } else {
      overdueRows.push(row);
    }
  }

  return {
    asOfDate: effectiveAsOf,
    noDueDate: buildNoDueDateBucket(noDueDateOpenRows),
    tabs: {
      current: buildTabData(currentRows, /* includeBuckets */ false),
      overdue: buildTabData(overdueRows, /* includeBuckets */ true),
      cleared: buildTabData(clearedRows, /* includeBuckets */ false),
    },
    totalTransactions: txs.length,
    coverageSum:
      noDueDateOpenRows.length +
      currentRows.length +
      overdueRows.length +
      clearedRows.length,
  };
}

// ---------------------------------------------------------------------------
// Tab classification (spec Section 3.5)
// ---------------------------------------------------------------------------

type TabBucket = 'cleared' | 'no-due-date-open' | 'current' | 'overdue';

/**
 * Tab classification rule chain (spec Section 3.5). Each transaction
 * routes to exactly one bucket.
 *
 *   1. isZeroBalance=true               -> Cleared
 *   2. dueDate missing AND open         -> No Due Date open
 *   3. dueDate >= asOfDate              -> Current
 *   4. dueDate <  asOfDate              -> Overdue
 *
 * The 185 settled-but-no-dueDate rows are routed to Cleared by
 * rule 1 (isZeroBalance takes precedence over dueDate absence).
 */
function classifyTab(tx: PreviewTransaction, asOfDate: string): TabBucket {
  if (tx.isZeroBalance) return 'cleared';
  if (!tx.dueDate) return 'no-due-date-open';
  if (tx.dueDate >= asOfDate) return 'current';
  return 'overdue';
}

// ---------------------------------------------------------------------------
// Per-row label computation
// ---------------------------------------------------------------------------

function buildTransactionRow(
  tx: PreviewTransaction,
  stmtByTxId: Map<string, StatementStatus>,
  duplicateTxIds: Set<string>,
): TransactionRow {
  const statementStatus = stmtByTxId.get(tx.id) ?? 'NoStatement';
  const hasDuplicateFlag =
    duplicateTxIds.has(tx.id) ||
    tx.flags.some((f) => f.includes('DUPLICATE'));
  const isHighAmount =
    tx.absoluteBalance >= HIGH_AMOUNT_THRESHOLD[tx.currency];

  const actionReadiness = evaluateActionReadiness(
    tx,
    statementStatus,
    hasDuplicateFlag,
  );
  const priorityBand = evaluatePriorityBand(
    tx,
    statementStatus,
    hasDuplicateFlag,
    isHighAmount,
  );

  return {
    id: tx.id,
    partyKey: tx.partyKey,
    partyName: tx.partyName,
    currency: tx.currency,
    direction: tx.direction,
    signedBalance: tx.signedBalance,
    absoluteBalance: tx.absoluteBalance,
    isZeroBalance: tx.isZeroBalance,
    invoiceDate: tx.invoiceDate,
    dueDate: tx.dueDate,
    agingDays: tx.agingDays,
    agingBucket: tx.agingBucket as string,
    invoiceNo: tx.invoiceNo,
    ourRefNo: tx.ourRefNo,
    statementStatus,
    actionReadiness,
    priorityBand,
    isHighAmount,
    hasDuplicateFlag,
    sourceFile: tx.trace.sourceFile,
    sourceRow: tx.trace.sourceRow,
  };
}

// ---------------------------------------------------------------------------
// Statement Status mapping (spec Section 3.2)
// ---------------------------------------------------------------------------

/**
 * Build a lookup of transactionId -> StatementStatus.
 *
 * Mapping from artifact matchType field (spec Section 3.2):
 *   EXACT_SIGNED                  -> ExactMatch
 *   BALANCE_DIFFERENCE            -> BalanceDifference
 *   CHANGED_AFTER_STATEMENT       -> BalanceDifference (folded)
 *   SETTLED_AFTER_STATEMENT       -> SettledAfterStatement
 *   NOT_IN_ERP_EXTRACT            -> (excluded; no matched tx)
 *
 * Transactions with no entry in this map default to 'NoStatement'.
 */
function indexStatementLinksByTransactionId(
  links: StatementLink[],
): Map<string, StatementStatus> {
  const out = new Map<string, StatementStatus>();
  for (const link of links) {
    if (!link.matchedTransactionId) continue; // orphan; routes to Review Queue
    const status = mapMatchTypeToStatus(link.matchType);
    if (!status) continue;
    // If multiple links collide on a tx id, prefer the "worst" status.
    const prev = out.get(link.matchedTransactionId);
    out.set(
      link.matchedTransactionId,
      prev ? worstStatementStatus(prev, status) : status,
    );
  }
  return out;
}

function mapMatchTypeToStatus(
  matchType: string,
): StatementStatus | null {
  switch (matchType) {
    case 'EXACT_SIGNED':
      return 'ExactMatch';
    case 'BALANCE_DIFFERENCE':
      return 'BalanceDifference';
    case 'CHANGED_AFTER_STATEMENT':
      return 'BalanceDifference';
    case 'SETTLED_AFTER_STATEMENT':
      return 'SettledAfterStatement';
    case 'NOT_IN_ERP_EXTRACT':
      return null; // orphan; not part of transaction-driven rollup
    default:
      return null;
  }
}

// "Worst" ranking for Statement Status aggregation:
//   BalanceDifference > SettledAfterStatement > NoStatement > ExactMatch
// Higher rank = more attention required.
const STATEMENT_STATUS_RANK: Record<StatementStatus, number> = {
  BalanceDifference: 4,
  SettledAfterStatement: 3,
  NoStatement: 2,
  ExactMatch: 1,
};

function worstStatementStatus(
  a: StatementStatus,
  b: StatementStatus,
): StatementStatus {
  return STATEMENT_STATUS_RANK[a] >= STATEMENT_STATUS_RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Action Readiness mapping (spec Section 3.3)
// ---------------------------------------------------------------------------

/**
 * Action Readiness rule chain (spec Section 3.3). First match wins.
 *
 *   1. Cleared                  -> isZeroBalance=true
 *   2. Missing Due Date         -> open AND dueDate missing
 *   3. Check Duplicate          -> open AND duplicate flag
 *   4. Review Statement Diff    -> open AND StatementStatus in
 *                                  [BalanceDifference, SettledAfterStatement]
 *   5. Ready to Follow Up       -> default for any other open
 */
function evaluateActionReadiness(
  tx: PreviewTransaction,
  statementStatus: StatementStatus,
  hasDuplicateFlag: boolean,
): ActionReadiness {
  if (tx.isZeroBalance) return 'Cleared';
  if (!tx.dueDate) return 'MissingDueDate';
  if (hasDuplicateFlag) return 'CheckDuplicate';
  if (
    statementStatus === 'BalanceDifference' ||
    statementStatus === 'SettledAfterStatement'
  ) {
    return 'ReviewStatementDifference';
  }
  return 'ReadyToFollowUp';
}

const ACTION_READINESS_RANK: Record<ActionReadiness, number> = {
  MissingDueDate: 5,
  ReviewStatementDifference: 4,
  CheckDuplicate: 3,
  ReadyToFollowUp: 2,
  Cleared: 1,
};

function worstActionReadiness(
  a: ActionReadiness,
  b: ActionReadiness,
): ActionReadiness {
  return ACTION_READINESS_RANK[a] >= ACTION_READINESS_RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Priority Band mapping (spec Section 3.4)
// ---------------------------------------------------------------------------

/**
 * Priority Band rule chain (spec Section 3.4). Cleared evaluates FIRST.
 *
 *   1. Cleared       -> isZeroBalance=true (regardless of other attrs)
 *   2. Review First  -> open AND (dueDate missing
 *                       OR BalanceDifference
 *                       OR duplicate flag
 *                       OR (aging > 90 AND high amount))
 *   3. Follow Up     -> open AND (aging > 60
 *                       OR high amount
 *                       OR SettledAfterStatement)
 *   4. Monitor       -> open AND no other condition (fallback)
 */
function evaluatePriorityBand(
  tx: PreviewTransaction,
  statementStatus: StatementStatus,
  hasDuplicateFlag: boolean,
  isHighAmount: boolean,
): PriorityBand {
  if (tx.isZeroBalance) return 'Cleared';

  // Open balance from here. Evaluate Review First triggers.
  if (!tx.dueDate) return 'ReviewFirst';
  if (statementStatus === 'BalanceDifference') return 'ReviewFirst';
  if (hasDuplicateFlag) return 'ReviewFirst';
  if (tx.agingDays > 90 && isHighAmount) return 'ReviewFirst';

  // Follow Up triggers.
  if (tx.agingDays > 60) return 'FollowUp';
  if (isHighAmount) return 'FollowUp';
  if (statementStatus === 'SettledAfterStatement') return 'FollowUp';

  // Fallback for open with no other condition.
  return 'Monitor';
}

const PRIORITY_BAND_RANK: Record<PriorityBand, number> = {
  ReviewFirst: 4,
  FollowUp: 3,
  Monitor: 2,
  Cleared: 1,
};

function worstPriorityBand(a: PriorityBand, b: PriorityBand): PriorityBand {
  return PRIORITY_BAND_RANK[a] >= PRIORITY_BAND_RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// Party rollup aggregation
// ---------------------------------------------------------------------------

/**
 * Group rows by (partyKey, currency, direction). A party with both
 * USD and CAD open balances appears as multiple rollup rows (currency
 * LOCKED rule). Similarly, AR (receivable) and AP (payable) open
 * balances under the same (party, currency) appear as SEPARATE
 * rollup rows, so receivables are NEVER netted against payables in
 * the workbench (accounting correctness; see Round 1 review P1-2).
 *
 * The 'settled' direction is filtered out of open rollups by the
 * caller (rows passed in here are tab-filtered already), but if
 * present it would form its own group too.
 */
function buildTabData(
  rows: TransactionRow[],
  includeBuckets: boolean,
): AgingTabData {
  // Group by partyKey + currency + direction
  const groups = new Map<string, TransactionRow[]>();
  for (const r of rows) {
    const key = `${r.partyKey}__${r.currency}__${r.direction}`;
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const parties: PartyRollup[] = [];
  let totalUSDReceivable = 0;
  let totalUSDPayable = 0;
  let totalCADReceivable = 0;
  let totalCADPayable = 0;

  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const openAmount = sumSignedBalance(groupRows);
    const oldestAging = Math.max(...groupRows.map((r) => r.agingDays));
    const ninetyPlus = groupRows.filter(
      (r) => r.agingBucket === '90+' || r.agingDays > 90,
    ).length;

    const stmtStatus = groupRows.reduce<StatementStatus>(
      (acc, r) => worstStatementStatus(acc, r.statementStatus),
      'ExactMatch',
    );
    const readiness = groupRows.reduce<ActionReadiness>(
      (acc, r) => worstActionReadiness(acc, r.actionReadiness),
      'Cleared',
    );
    const band = groupRows.reduce<PriorityBand>(
      (acc, r) => worstPriorityBand(acc, r.priorityBand),
      'Cleared',
    );

    parties.push({
      partyKey: first.partyKey,
      partyName: first.partyName,
      currency: first.currency,
      direction: first.direction,
      openAmount,
      oldestAgingDays: oldestAging,
      invoiceCount: groupRows.length,
      ninetyPlusCount: ninetyPlus,
      statementStatus: stmtStatus,
      actionReadiness: readiness,
      priorityBand: band,
      transactions: groupRows,
      agingBucketBreakdown: includeBuckets
        ? buildAgingBucketBreakdown(groupRows)
        : null,
    });

    // Accumulate direction-split totals. Currency LOCKED rule
    // continues to apply; direction LOCKED rule extends to totals.
    if (first.currency === 'USD') {
      if (first.direction === 'payable') totalUSDPayable += openAmount;
      else totalUSDReceivable += openAmount;
    } else {
      if (first.direction === 'payable') totalCADPayable += openAmount;
      else totalCADReceivable += openAmount;
    }
  }

  // Sort parties: highest priority first, then largest open amount.
  parties.sort((a, b) => {
    const r = PRIORITY_BAND_RANK[b.priorityBand] -
      PRIORITY_BAND_RANK[a.priorityBand];
    if (r !== 0) return r;
    return Math.abs(b.openAmount) - Math.abs(a.openAmount);
  });

  return {
    parties,
    totals: {
      USD: { receivable: totalUSDReceivable, payable: totalUSDPayable },
      CAD: { receivable: totalCADReceivable, payable: totalCADPayable },
    },
    transactionCount: rows.length,
  };
}

function sumSignedBalance(rows: TransactionRow[]): number {
  let s = 0;
  for (const r of rows) s += r.signedBalance;
  return s;
}

function buildAgingBucketBreakdown(
  rows: TransactionRow[],
): AgingBucketBreakdown {
  const out: AgingBucketBreakdown = {
    '1-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  };
  for (const r of rows) {
    const amt = Math.abs(r.signedBalance);
    if (r.agingDays <= 30) out['1-30'] += amt;
    else if (r.agingDays <= 60) out['31-60'] += amt;
    else if (r.agingDays <= 90) out['61-90'] += amt;
    else out['90+'] += amt;
  }
  return out;
}

// ---------------------------------------------------------------------------
// No Due Date bucket
// ---------------------------------------------------------------------------

function buildNoDueDateBucket(rows: TransactionRow[]): NoDueDateBucket {
  let usd = 0;
  let cad = 0;
  for (const r of rows) {
    if (r.currency === 'USD') usd += r.signedBalance;
    else cad += r.signedBalance;
  }
  return {
    openCount: rows.length,
    totals: { USD: usd, CAD: cad },
    transactions: rows,
  };
}

// ---------------------------------------------------------------------------
// Empty fallback
// ---------------------------------------------------------------------------

function emptyAgingReport(asOfDate: string): AgingReportData {
  const emptyTab: AgingTabData = {
    parties: [],
    totals: {
      USD: { receivable: 0, payable: 0 },
      CAD: { receivable: 0, payable: 0 },
    },
    transactionCount: 0,
  };
  return {
    asOfDate,
    noDueDate: {
      openCount: 0,
      totals: { USD: 0, CAD: 0 },
      transactions: [],
    },
    tabs: {
      current: emptyTab,
      overdue: { ...emptyTab, parties: [] },
      cleared: { ...emptyTab, parties: [] },
    },
    totalTransactions: 0,
    coverageSum: 0,
  };
}
