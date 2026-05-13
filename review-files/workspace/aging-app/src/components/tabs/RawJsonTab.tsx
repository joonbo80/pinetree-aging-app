import type { Lang } from '../../i18n/strings';
import { strings } from '../../i18n/strings';
import type { ParseResult } from '../../parsing-engine/types';

interface RawJsonTabProps {
  lang: Lang;
  result: ParseResult;
}

export function RawJsonTab({ lang, result }: RawJsonTabProps) {
  const t = strings[lang];
  const json = JSON.stringify(result, null, 2);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* ignore */
    }
  };

  const downloadJson = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parse-result.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{t.tabRawJson}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-mono" onClick={copyJson}>
            ⎘ Copy
          </button>
          <button type="button" className="btn btn-mono" onClick={downloadJson}>
            ⇣ {t.exportJson}
          </button>
        </div>
      </div>
      <div className="panel-body no-pad">
        <pre className="json-viewer">{json}</pre>
      </div>
    </div>
  );
}
