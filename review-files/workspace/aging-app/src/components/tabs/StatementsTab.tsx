import type { Lang } from '../../i18n/strings';
import { strings } from '../../i18n/strings';
import type { ParseResult } from '../../parsing-engine/types';

interface StatementsTabProps {
  lang: Lang;
  result: ParseResult;
}

interface MetricItem {
  label: string;
  value: number | string;
  variant?: 'muted' | 'warn' | 'info';
}

function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div className="metric-grid">
      {items.map((it, i) => (
        <div key={i} className="metric-item">
          <div className="metric-label">{it.label}</div>
          <div className={`metric-value ${it.variant ?? ''}`}>
            {typeof it.value === 'number' ? it.value.toLocaleString() : it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatementsTab({ lang, result }: StatementsTabProps) {
  const t = strings[lang];
  const agent = result.statementMatchReport.agent;
  const local = result.statementMatchReport.local;

  const agentItems: MetricItem[] = [
    { label: t.statements, value: agent.statementCount },
    { label: t.txRefs, value: agent.transactionRefCount },
    { label: t.matched, value: agent.matchedCRDRRefs },
    { label: t.unmatched, value: agent.unmatchedCRDRRefs, variant: agent.unmatchedCRDRRefs > 0 ? 'warn' : 'muted' },
    { label: t.identityMismatches, value: agent.identityMismatches, variant: agent.identityMismatches > 0 ? 'warn' : 'muted' },
    { label: t.asOfDateMismatches, value: agent.asOfDateMismatches, variant: 'info' },
    { label: t.settledAfterStatement, value: agent.settledInErpAfterStatement, variant: 'info' },
    { label: t.changedAfterStatement, value: agent.changedInErpAfterStatement, variant: 'info' },
  ];

  const localItems: MetricItem[] = [
    { label: t.statements, value: local.statementCount },
    { label: t.txRefs, value: local.transactionRefCount },
    { label: t.exactMatches, value: local.exactSignedBalanceMatches },
    { label: t.erpRefsFound, value: local.erpRefsFound },
    { label: t.balanceDifferences, value: local.balanceDifferences, variant: 'info' },
    { label: t.outsideDateRange, value: local.outsideUploadedErpDateRange, variant: 'muted' },
    { label: t.sameRefDiffCurrency, value: local.sameRefDifferentCurrency, variant: 'muted' },
    { label: t.rowsWithoutRef, value: local.rowsWithoutReferenceNumber, variant: 'muted' },
    { label: t.notInExtract, value: local.notInUploadedErpExtract, variant: 'warn' },
  ];

  return (
    <>
      {/* Agent */}
      <div className="section-heading">
        <h3>{t.agentStatements}</h3>
        <span className="section-meta">
          USD: {agent.currencies.USD ?? 0} · CAD: {agent.currencies.CAD ?? 0}
        </span>
      </div>

      <div className="notice">{t.asOfNotice}</div>

      <MetricGrid items={agentItems} />

      <div style={{ height: 32 }} />

      {/* Local */}
      <div className="section-heading">
        <h3>{t.localStatements}</h3>
        <span className="section-meta">
          {t.erpDateRange}: {local.uploadedErpDateRange.from} ~ {local.uploadedErpDateRange.to}
        </span>
      </div>

      <MetricGrid items={localItems} />

      <div className="notice" style={{ marginTop: 16 }}>
        <b>NOT_IN_UPLOADED_ERP_EXTRACT</b> ({local.notInUploadedErpExtract}) →{' '}
        {lang === 'ko'
          ? '검토 대기열에서 확인 가능합니다.'
          : 'see Review Queue for these rows.'}
      </div>
    </>
  );
}
