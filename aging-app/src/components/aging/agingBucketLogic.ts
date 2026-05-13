// components/aging/agingBucketLogic.ts
//
// Pure overdue aging bucket breakdown helper for C2 Round 7.
// Input is already tab-filtered AgingTabData; output preserves USD/CAD
// and AR/AP separation.

import type {
  AgingTabData,
  Currency,
  Direction,
} from '../../selectors/agingReport.ts';

export type AgingBucketKey = '0-30' | '31-60' | '61-90' | '90+';

export interface AgingBucketSummary {
  bucket: AgingBucketKey;
  transactionCount: number;
  totals: {
    USD: { receivable: number; payable: number };
    CAD: { receivable: number; payable: number };
  };
}

export const BUCKET_ORDER: AgingBucketKey[] = [
  '0-30',
  '31-60',
  '61-90',
  '90+',
];

export function buildBucketBreakdown(
  tabData: AgingTabData,
): AgingBucketSummary[] {
  const buckets = Object.fromEntries(
    BUCKET_ORDER.map((bucket) => [bucket, emptyBucket(bucket)]),
  ) as Record<AgingBucketKey, AgingBucketSummary>;

  for (const party of tabData.parties) {
    for (const tx of party.transactions) {
      const bucket = normalizeBucket(tx.agingBucket);
      if (!bucket) continue;

      buckets[bucket].transactionCount += 1;
      addAmount(
        buckets[bucket],
        tx.currency,
        tx.direction,
        tx.signedBalance,
      );
    }
  }

  return BUCKET_ORDER.map((bucket) => buckets[bucket]);
}

function emptyBucket(bucket: AgingBucketKey): AgingBucketSummary {
  return {
    bucket,
    transactionCount: 0,
    totals: {
      USD: { receivable: 0, payable: 0 },
      CAD: { receivable: 0, payable: 0 },
    },
  };
}

function addAmount(
  summary: AgingBucketSummary,
  currency: Currency,
  direction: Direction,
  amount: number,
) {
  if (direction === 'payable') {
    summary.totals[currency].payable += amount;
  } else {
    summary.totals[currency].receivable += amount;
  }
}

function normalizeBucket(value: string): AgingBucketKey | null {
  if (value === '0-30') return '0-30';
  if (value === '31-60') return '31-60';
  if (value === '61-90') return '61-90';
  if (value === '90+') return '90+';
  return null;
}
