import { useRef, useState } from 'react';
import type { Lang } from '../i18n/strings';
import { strings } from '../i18n/strings';

interface DropZoneProps {
  lang: Lang;
  onFiles: (files: File[]) => void;
  onLoadBaseline: () => void;
  onImportSnapshot: (file: File) => void;
  onExportSnapshot: () => void;
  onClear: () => void;
  hasData: boolean;
  loading?: boolean;
}

export function DropZone({
  lang,
  onFiles,
  onLoadBaseline,
  onImportSnapshot,
  onExportSnapshot,
  onClear,
  hasData,
  loading,
}: DropZoneProps) {
  const t = strings[lang];
  const inputRef = useRef<HTMLInputElement>(null);
  const snapshotInputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setActive(false);
    if (loading) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };
  const handleSnapshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportSnapshot(file);
    if (snapshotInputRef.current) snapshotInputRef.current.value = '';
  };

  return (
    <div
      className={`drop-zone ${active ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="drop-zone-icon">FILES · XLS / XLSX</div>
      <h2 className="drop-zone-title">{t.dropZoneTitle}</h2>
      <p className="drop-zone-sub">{t.dropZoneSub}</p>

      <div className="drop-zone-actions">
        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {t.browse}
        </button>
        <button
          type="button"
          className="btn btn-mono"
          disabled={loading}
          onClick={onLoadBaseline}
        >
          {loading ? `... ${t.loadingBaseline}` : `> ${t.loadBaseline}`}
        </button>
        <button
          type="button"
          className="btn"
          disabled={loading}
          onClick={() => snapshotInputRef.current?.click()}
        >
          {t.importSnapshot}
        </button>
        {hasData && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={loading}
            onClick={onExportSnapshot}
          >
            {t.exportSnapshot}
          </button>
        )}
        {hasData && (
          <button type="button" className="btn btn-ghost" onClick={onClear} disabled={loading}>
            {t.clear}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xls,.xlsx"
          onChange={handleSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={snapshotInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleSnapshotSelect}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
