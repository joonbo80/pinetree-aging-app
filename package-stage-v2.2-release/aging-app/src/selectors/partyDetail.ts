import type {
  DuplicateGroupDetail,
  ParsingPreviewResult,
  PartyCurrencyTotal,
  PartyDepartmentSummary,
  PartyDetail,
  PartyStatus,
  PreviewTransaction,
  ReviewItem,
  StatementLink,
} from '../parsing-engine/types';

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

function humanizeKey(key: string): string {
  if (!key) return 'Unknown party';
  return key
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function pickMajorityName(names: Array<string | null | undefined>): string | null {
  const counts = new Map<string, number>();
  const firstSeenIndex = new Map<string, number>();
  let index = 0;

  for (const name of names) {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
      index += 1;
      continue;
    }
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    if (!firstSeenIndex.has(trimmed)) firstSeenIndex.set(trimmed, index);
    index += 1;
  }

  if (counts.size === 0) return null;

  let bestName: string | null = null;
  let bestCount = -1;
  let bestFirstSeen = Number.POSITIVE_INFINITY;

  for (const [name, count] of counts) {
    const firstSeen = firstSeenIndex.get(name) ?? Number.POSITIVE_INFINITY;
    if (count > bestCount || (count === bestCount && firstSeen < bestFirstSeen)) {
      bestName = name;
      bestCount = count;
      bestFirstSeen = firstSeen;
    }
  }

  return bestName;
}

function resolvePartyName(
  partyKey: string,
  transactions: PreviewTransaction[],
  statementLinks: StatementLink[],
  reviewItems: ReviewItem[],
): { name: string; variants: string[] } {
  const variants = new Set<string>();
  for (const row of transactions) if (row.partyName?.trim()) variants.add(row.partyName.trim());
  for (const row of statementLinks) if (row.partyName?.trim()) variants.add(row.partyName.trim());
  for (const row of reviewItems) if (row.partyName?.trim()) variants.add(row.partyName.trim());

  const transactionMajority = pickMajorityName(transactions.map(row => row.partyName));
  if (transactionMajority) return { name: transactionMajority, variants: Array.from(variants) };

  const firstStatement = statementLinks.find(row => row.partyName?.trim());
  if (firstStatement) return { name: firstStatement.partyName.trim(), variants: Array.from(variants) };

  const firstReview = reviewItems.find(row => row.partyName?.trim());
  if (firstReview) return { name: firstReview.partyName!.trim(), variants: Array.from(variants) };

  return { name: humanizeKey(partyKey), variants: [] };
}

function resolveDepartment(transactions: PreviewTransaction[]): PartyDepartmentSummary {
  const counts = new Map<string | null, number>();
  for (const row of transactions) {
    const department = row.department ?? null;
    counts.set(department, (counts.get(department) ?? 0) + 1);
  }

  const breakdown = Array.from(counts.entries())
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  if (transactions.length === 0) return { dominant: null, breakdown: [] };

  const top = breakdown[0];
  const share = top.count / transactions.length;
  const dominant = share >= 0.6 && top.department !== null ? top.department : null;

  return { dominant, breakdown };
}

function buildCurrencyTotals(transactions: PreviewTransaction[]): PartyCurrencyTotal[] {
  const byCurrency = new Map<'USD' | 'CAD', { netBalance: number; agingNinetyPlusCount: number }>();

  for (const row of transactions) {
    if (row.direction === 'settled') continue;
    const entry = byCurrency.get(row.currency) ?? { netBalance: 0, agingNinetyPlusCount: 0 };
    entry.netBalance += row.signedBalance;
    if (row.agingBucket === '90+') entry.agingNinetyPlusCount += 1;
    byCurrency.set(row.currency, entry);
  }

  return (['USD', 'CAD'] as const)
    .filter(currency => byCurrency.has(currency))
    .map(currency => {
      const entry = byCurrency.get(currency)!;
      return {
        currency,
        netBalance: Math.round((entry.netBalance + Number.EPSILON) * 100) / 100,
        agingNinetyPlusCount: entry.agingNinetyPlusCount,
      };
    });
}

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

function buildSummary(
  transactions: PreviewTransaction[],
  statementLinks: StatementLink[],
  reviewItems: ReviewItem[],
  duplicateGroups: DuplicateGroupDetail[],
) {
  return {
    totalTransactions: transactions.length,
    statementRows: statementLinks.length,
    erpMatched: statementLinks.filter(row => row.matchedTransactionId !== null).length,
    notInErpExtract: reviewItems.filter(row => row.category === 'NOT_IN_ERP_EXTRACT').length,
    duplicateFlags: duplicateGroups.length,
    warnings: reviewItems.filter(row => row.category === 'WARNINGS').length,
  };
}

export function selectPartyDetail(
  partyKey: string,
  result: ParsingPreviewResult | null | undefined,
): PartyDetail {
  if (!partyKey || !result?.details) return emptyPartyDetail(partyKey || '');

  const {
    transactions: allTransactions,
    statementLinks: allStatementLinks,
    reviewItems: allReviewItems,
    duplicateGroups: allDuplicateGroups,
  } = result.details;

  const transactions = allTransactions.filter(row => row.partyKey === partyKey);
  const statementLinks = allStatementLinks.filter(row => row.partyKey === partyKey);
  const reviewItems = allReviewItems.filter(row => row.partyKey === partyKey);
  const partyTransactionIds = new Set(transactions.map(row => row.id));
  const duplicateGroups = allDuplicateGroups.filter(group =>
    group.transactionIds.some(id => partyTransactionIds.has(id)),
  );

  if (transactions.length === 0 && statementLinks.length === 0 && reviewItems.length === 0) {
    return emptyPartyDetail(partyKey);
  }

  const { name, variants } = resolvePartyName(partyKey, transactions, statementLinks, reviewItems);

  return {
    partyKey,
    partyName: name,
    partyNameVariants: variants,
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
