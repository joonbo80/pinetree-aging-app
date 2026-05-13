// selectors/partyDetail.ts
//
// Pure-function projection of `result.details` to a PartyDetail.
//
// Phase 2 v2.2 spec §"Data Selectors" + §"Party Name Authority" + §D3-D5.
//
// IMPORTANT design rules:
//   1. NEVER mix USD and CAD in any aggregate (v1.1 LOCKED rule, spec D5)
//   2. partyName is resolved with explicit priority and the chosen value
//      MUST be human-readable, NEVER a kebab-case partyKey (v2.1.1 invariant)
//   3. NOT_IN_ERP_EXTRACT count comes from REVIEW ITEMS (the strict 7),
//      not from transactions or statement links (per spec correction)
//   4. Duplicate groups touch a party if any tx in the group has matching
//      partyKey (transitively — the group represents the same identity
//      potentially appearing under multiple parties is not in current data
//      but the selector is correct for that case too)

import type {
  ParsingPreviewResult,
  PreviewTransaction,
  ReviewItem,
  StatementLink,
  DuplicateGroupDetail,
  PartyDetail,
  PartyStatus,
  PartyDepartmentSummary,
  PartyCurrencyTotal,
  PartySummaryCounts,
} from '../parsing-engine/types';

/**
 * Empty selector result for unknown partyKey or schema-1.0 payload.
 * The UI uses the empty arrays + provided partyKey to render the "No
 * data for this party" empty state.
 */
function emptyPartyDetail(partyKey: string): PartyDetail {
  return {
    partyKey,
    partyName: humanizeKey(partyKey),
    partyNameVariants: [],
    department: { dominant: null, breakdown: [] },
    status: 'Clean',
    currencyTotals: [],
    summary: {
      totalTransactions: 0,
      statementRows: 0,
      erpMatched: 0,
      notInErpExtract: 0,
      duplicateFlags: 0,
      warnings: 0,
    },
    transactions: [],
    statementLinks: [],
    reviewItems: [],
    duplicateGroups: [],
  };
}

/**
 * Last-resort party label when no real data carries a name. Converts
 * "win-yan-logistics" to "Win Yan Logistics". Only used for the unknown-
 * partyKey case; never used when any tx/statement/review carries a name.
 */
function humanizeKey(key: string): string {
  if (!key) return 'Unknown party';
  return key
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pick the most-frequent partyName from a list. Ties broken by first
 * occurrence (stable). Empty/whitespace names ignored.
 */
function pickMajorityName(names: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  const firstSeenIndex = new Map<string, number>();
  let i = 0;
  for (const n of names) {
    const trimmed = (n ?? '').trim();
    if (!trimmed) { i++; continue; }
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    if (!firstSeenIndex.has(trimmed)) firstSeenIndex.set(trimmed, i);
    i++;
  }
  if (counts.size === 0) return null;
  let bestName: string | null = null;
  let bestCount = -1;
  let bestFirstSeen = Infinity;
  for (const [name, count] of counts) {
    const fs = firstSeenIndex.get(name) ?? Infinity;
    if (count > bestCount || (count === bestCount && fs < bestFirstSeen)) {
      bestName = name;
      bestCount = count;
      bestFirstSeen = fs;
    }
  }
  return bestName;
}

/**
 * Resolve the canonical display name per spec §"Party Name Authority":
 *   1. Most frequent partyName among party transactions.
 *   2. First statement link partyName.
 *   3. First review item partyName.
 *   4. Humanized partyKey (last resort).
 *
 * The chosen name MUST NOT be the kebab-case key. The empty-trim guard
 * inside pickMajorityName ensures we never pick a blank, but if a real
 * partyName equals partyKey character-for-character, we still accept it
 * (some single-token party names may legitimately match) — the v2.1.1
 * invariant test guards against the SUSPICIOUS case of a kebab-case
 * (containing "-") match, not single-token coincidence.
 */
function resolvePartyName(
  partyKey: string,
  transactions: PreviewTransaction[],
  statementLinks: StatementLink[],
  reviewItems: ReviewItem[],
): { name: string; variants: string[] } {
  const variants = new Set<string>();
  for (const t of transactions) if (t.partyName) variants.add(t.partyName.trim());
  for (const l of statementLinks) if (l.partyName) variants.add(l.partyName.trim());
  for (const r of reviewItems) if (r.partyName) variants.add(r.partyName.trim());
  variants.delete('');

  const txMajority = pickMajorityName(transactions.map(t => t.partyName));
  if (txMajority) return { name: txMajority, variants: Array.from(variants) };

  const firstLink = statementLinks.find(l => l.partyName?.trim());
  if (firstLink) return { name: firstLink.partyName.trim(), variants: Array.from(variants) };

  const firstReview = reviewItems.find(r => r.partyName?.trim());
  if (firstReview) return { name: firstReview.partyName!.trim(), variants: Array.from(variants) };

  return { name: humanizeKey(partyKey), variants: [] };
}

/**
 * Department: majority by 60% threshold, else "Mixed" + breakdown.
 * `null` and 'UNKNOWN' departments count as their own category.
 */
function resolveDepartment(transactions: PreviewTransaction[]): PartyDepartmentSummary {
  const counts = new Map<string | null, number>();
  for (const t of transactions) {
    const d = t.department ?? null;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const breakdown = Array.from(counts.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  const total = transactions.length;
  if (total === 0) return { dominant: null, breakdown: [] };

  const top = breakdown[0];
  const share = top.count / total;
  const dominant = share >= 0.6 && top.department !== null ? top.department : null;
  return { dominant, breakdown };
}

/**
 * Per-currency net balance + 90+ count. NEVER sums across currencies.
 *
 * "Net balance" = sum of signedBalance for non-settled transactions
 * (settled rows have balance 0 anyway, but excluded explicitly to
 * mirror Dashboard semantics).
 */
function buildCurrencyTotals(transactions: PreviewTransaction[]): PartyCurrencyTotal[] {
  const byCcy = new Map<'USD' | 'CAD', { netBalance: number; agingNinetyPlusCount: number }>();
  for (const t of transactions) {
    if (t.direction === 'settled') continue;
    const cur = t.currency;
    const entry = byCcy.get(cur) ?? { netBalance: 0, agingNinetyPlusCount: 0 };
    entry.netBalance += t.signedBalance;
    if (t.agingBucket === '90+') entry.agingNinetyPlusCount++;
    byCcy.set(cur, entry);
  }
  const result: PartyCurrencyTotal[] = [];
  // Stable order: USD before CAD when both present
  for (const cur of ['USD', 'CAD'] as const) {
    if (byCcy.has(cur)) {
      const e = byCcy.get(cur)!;
      result.push({
        currency: cur,
        netBalance: Math.round((e.netBalance + Number.EPSILON) * 100) / 100,
        agingNinetyPlusCount: e.agingNinetyPlusCount,
      });
    }
  }
  return result;
}

/**
 * Status badge per spec §"Header":
 *   - Statement only:  has statement links AND zero ERP transactions
 *   - Has issues:      has any review items OR any duplicate groups
 *   - Clean:           neither
 *
 * "Statement only" check is FIRST so an issue-laden statement-only
 * party still shows "Statement only" — that signal is more diagnostic.
 */
function resolveStatus(
  transactions: PreviewTransaction[],
  statementLinks: StatementLink[],
  reviewItems: ReviewItem[],
  duplicateGroups: DuplicateGroupDetail[],
): PartyStatus {
  if (transactions.length === 0 && statementLinks.length > 0) return 'Statement only';
  if (reviewItems.length > 0 || duplicateGroups.length > 0) return 'Has issues';
  return 'Clean';
}

/**
 * Six summary card values.
 *
 * Note: `notInErpExtract` is the count of strict NOT_IN_ERP_EXTRACT
 * REVIEW ITEMS (per user correction to spec draft). This is NOT the
 * count of statement links with matchType NOT_IN_ERP_EXTRACT (which
 * would be the broader 95-row population); it's the strict 7-row set
 * the Dashboard agrees with.
 */
function buildSummary(
  transactions: PreviewTransaction[],
  statementLinks: StatementLink[],
  reviewItems: ReviewItem[],
  duplicateGroups: DuplicateGroupDetail[],
): PartySummaryCounts {
  const erpMatched = statementLinks.filter(l => l.matchedTransactionId !== null).length;
  const notInErpExtract = reviewItems.filter(r => r.category === 'NOT_IN_ERP_EXTRACT').length;
  const warnings = reviewItems.filter(r => r.category === 'WARNINGS').length;

  return {
    totalTransactions: transactions.length,
    statementRows: statementLinks.length,
    erpMatched,
    notInErpExtract,
    duplicateFlags: duplicateGroups.length,
    warnings,
  };
}

/**
 * Project `result.details` to a PartyDetail for the given partyKey.
 *
 * Pure function. Same input → same output. No side effects.
 *
 * Returns an empty-but-well-formed PartyDetail when:
 *   - result is null/undefined
 *   - result.details is undefined (schema 1.0 payload)
 *   - partyKey doesn't match any data
 *
 * The caller decides how to render those cases (typically empty state).
 */
export function selectPartyDetail(
  partyKey: string,
  result: ParsingPreviewResult | null | undefined,
): PartyDetail {
  if (!partyKey || !result?.details) {
    return emptyPartyDetail(partyKey || '');
  }

  const { transactions: allTx, statementLinks: allLinks, reviewItems: allReviews, duplicateGroups: allGroups } = result.details;

  // Filter by partyKey (single-pass each)
  const transactions = allTx.filter(t => t.partyKey === partyKey);
  const statementLinks = allLinks.filter(l => l.partyKey === partyKey);
  const reviewItems = allReviews.filter(r => r.partyKey === partyKey);

  // Duplicate groups touching this party: any group whose transactionIds[]
  // overlap with this party's transactions.
  const partyTxIds = new Set(transactions.map(t => t.id));
  const duplicateGroups = allGroups.filter(g =>
    g.transactionIds.some(id => partyTxIds.has(id)),
  );

  // If the party has truly no data anywhere, return empty
  if (
    transactions.length === 0 &&
    statementLinks.length === 0 &&
    reviewItems.length === 0
  ) {
    // duplicateGroups is also empty in this case (guaranteed by the
    // overlap check above when partyTxIds is empty)
    return emptyPartyDetail(partyKey);
  }

  const { name: partyName, variants: partyNameVariants } = resolvePartyName(
    partyKey, transactions, statementLinks, reviewItems,
  );

  return {
    partyKey,
    partyName,
    partyNameVariants,
    department: resolveDepartment(transactions),
    status: resolveStatus(transactions, statementLinks, reviewItems, duplicateGroups),
    currencyTotals: buildCurrencyTotals(transactions),
    summary: buildSummary(transactions, statementLinks, reviewItems, duplicateGroups),
    transactions,
    statementLinks,
    reviewItems,
    duplicateGroups,
  };
}
