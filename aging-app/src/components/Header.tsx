import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';
import pteLogoHeader from '../assets/pte-logo-header.png';

interface HeaderProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  asOfDate?: string;
  hasData?: boolean;
  apiOnline?: boolean;
  apiVersion?: string;
}

export function Header({ lang, onLangChange, asOfDate, hasData, apiOnline, apiVersion }: HeaderProps) {
  const t = strings[lang];

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-brand">
          <a
            href="https://pinetreeexpress.com"
            target="_blank"
            rel="noopener noreferrer"
            className="app-brand-logo"
            aria-label="Pinetree Express"
          >
            <img
              src={pteLogoHeader}
              alt="Pinetree Express"
              className="app-brand-logo-img"
            />
          </a>
          <span className="app-brand-sep">/</span>
          <span className="app-brand-app">{t.appName}</span>
        </div>

        <div className="app-header-search">
          <input
            type="search"
            className="header-search-input"
            placeholder={t.searchPlaceholder}
            disabled={!hasData}
            aria-label={t.searchPlaceholder}
          />
        </div>

        <div className="app-header-spacer" />

        <div
          className={`api-indicator ${apiOnline ? 'online' : 'offline'}`}
          title={apiOnline
            ? `${t.apiOnline}${apiVersion ? ` · v${apiVersion}` : ''}`
            : t.apiOffline}
        >
          <span className="api-dot" aria-hidden="true" />
          <span className="api-label">
            {apiOnline ? t.apiOnline : t.apiOffline}
          </span>
        </div>

        {asOfDate && (
          <div className="app-meta">
            <b>{t.asOfDate}</b> · {asOfDate}
          </div>
        )}

        <div className="lang-toggle" role="tablist" aria-label="language">
          <button
            type="button"
            className={lang === 'en' ? 'active' : ''}
            onClick={() => onLangChange('en')}
            aria-pressed={lang === 'en'}
          >
            EN
          </button>
          <button
            type="button"
            className={lang === 'ko' ? 'active' : ''}
            onClick={() => onLangChange('ko')}
            aria-pressed={lang === 'ko'}
          >
            KO
          </button>
        </div>
      </div>
    </header>
  );
}
