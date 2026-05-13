import { useNavigate, useParams } from 'react-router-dom';

interface PlaceholderPageProps {
  kind: 'review-index' | 'review-category' | 'party';
}

const REVIEW_LABELS: Record<string, string> = {
  warnings: 'Warnings',
  'aging-90-plus': '90+ Aging',
  duplicates: 'Duplicate Groups',
  'not-in-erp-extract': 'Not in ERP Extract',
  'unknown-department': 'Unknown Department',
};

export function PlaceholderPage({ kind }: PlaceholderPageProps) {
  const navigate = useNavigate();
  const params = useParams();

  const title =
    kind === 'review-index'
      ? 'Review Queue'
      : kind === 'party'
        ? `Party Detail: ${params.partyKey ?? ''}`
        : REVIEW_LABELS[params.type ?? ''] ?? 'Review Category';

  const subtitle =
    kind === 'party'
      ? 'Coming in v2.2. The route and partyKey contract are now reserved.'
      : 'Coming in v2.1. The details data contract is loaded; rendering is the next step.';

  return (
    <main className="app-content">
      <div className="app-subtitle">Phase 2 v2.0 · Route Placeholder</div>
      <section className="placeholder-panel">
        <h2 className="dashboard-title">{title}</h2>
        <p className="empty-sub">{subtitle}</p>
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
