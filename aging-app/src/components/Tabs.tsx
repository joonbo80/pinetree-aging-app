import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';

export type TabId = 'files' | 'reconciliation' | 'statements' | 'review' | 'json';

export interface TabBadge {
  count: number;
  variant?: 'warn' | 'fail' | 'neutral';
}

interface TabsProps {
  lang: Lang;
  active: TabId;
  onChange: (id: TabId) => void;
  badges?: Partial<Record<TabId, TabBadge>>;
}

export function Tabs({ lang, active, onChange, badges }: TabsProps) {
  const t = strings[lang];

  const tabs: { id: TabId; label: string }[] = [
    { id: 'files', label: t.tabFiles },
    { id: 'reconciliation', label: t.tabReconciliation },
    { id: 'statements', label: t.tabStatements },
    { id: 'review', label: t.tabReviewQueue },
    { id: 'json', label: t.tabRawJson },
  ];

  return (
    <div className="tabs" role="tablist">
      {tabs.map(tab => {
        const badge = badges?.[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`tab ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {badge && badge.count > 0 && (
              <span className={`tab-badge ${badge.variant ?? ''}`}>
                {badge.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
