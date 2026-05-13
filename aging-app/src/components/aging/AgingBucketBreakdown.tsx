// components/aging/AgingBucketBreakdown.tsx
//
// Read-only overdue aging bucket summary for C2 Round 7.

import type { AgingTabData } from '../../selectors/agingReport';
import { buildBucketBreakdown } from './agingBucketLogic.ts';

interface AgingBucketBreakdownProps {
  tabData: AgingTabData;
}

function money(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AgingBucketBreakdown({
  tabData,
}: AgingBucketBreakdownProps) {
  const buckets = buildBucketBreakdown(tabData);

  return (
    <section
      className="aging-bucket-breakdown"
      aria-label="Overdue aging bucket breakdown"
    >
      <div className="aging-bucket-breakdown-head">
        <span className="aging-bucket-breakdown-title">
          Aging Breakdown
        </span>
        <span className="aging-bucket-breakdown-hint">
          Overdue only. USD/CAD and AR/AP remain separated.
        </span>
      </div>

      <div className="aging-bucket-grid">
        {buckets.map((summary) => (
          <div key={summary.bucket} className="aging-bucket-cell">
            <div className="aging-bucket-key">{summary.bucket}</div>
            <div className="aging-bucket-count">
              {summary.transactionCount} tx
            </div>
            <div className="aging-bucket-totals">
              <span>
                USD AR {money(summary.totals.USD.receivable)}
              </span>
              <span>
                USD AP {money(summary.totals.USD.payable)}
              </span>
              <span>
                CAD AR {money(summary.totals.CAD.receivable)}
              </span>
              <span>
                CAD AP {money(summary.totals.CAD.payable)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
