import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import './styles/global.css';
import type { Lang } from './i18n/strings';
import { strings } from './i18n/strings';
import type { ParsingPreviewResult } from './parsing-engine/types';
import baseline from './baselines/phase1-v1.3.0.json';
import { apiClient, type DataSource, type ApiHealth } from './api/client';

import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { Readiness, type ReadinessStatus } from './components/Readiness';
import { Tabs, type TabId } from './components/Tabs';
import { FilesTab } from './components/tabs/FilesTab';
import { ReconciliationTab } from './components/tabs/ReconciliationTab';
import { StatementsTab } from './components/tabs/StatementsTab';
import { ReviewQueueTab } from './components/tabs/ReviewQueueTab';
import { RawJsonTab } from './components/tabs/RawJsonTab';
import { ConfirmModal } from './components/ConfirmModal';
import { Dashboard } from './components/dashboard/Dashboard';
import { PlaceholderPage } from './components/PlaceholderPage';
import { ReviewQueuePage } from './components/review/ReviewQueuePage';
import { PartyDetailPage } from './components/party/PartyDetailPage';

const LANG_KEY = 'agingApp.language';
const SESSION_KEY = 'agingApp.lastImportSession';

function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY);
  return v === 'ko' ? 'ko' : 'en';
}

function computeStatus(result: ParsingPreviewResult | null): ReadinessStatus {
  if (!result) return 'empty';
  const blocked =
    result.validationReport.critical.length > 0 ||
    result.classificationReport.some(c => c.requiresUserSelection) ||
    Object.values(result.reconciliationReport).some(r => !r.match);
  if (blocked) return 'blocked';

  const warnings = result.validationReport.warnings.length;
  const reviewItems = result.reviewCandidates.local.length;
  if (warnings > 0 || reviewItems > 0) return 'review';
  return 'ready';
}

function reviewCountOf(result: ParsingPreviewResult | null) {
  if (!result) return 0;
  return result.reviewCandidates.local.length;
}

export default function App() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>(loadLang);
  const [result, setResult] = useState<ParsingPreviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('files');
  const [showConfirm, setShowConfirm] = useState(false);
  const [importedAt, setImportedAt] = useState<string | null>(null);

  // API state
  const [dataSource, setDataSource] = useState<DataSource>('unknown');
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [loading, setLoading] = useState(false);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  // Probe API health on mount so we can tell the user up-front whether
  // the server is reachable. Failure here is silent — the fallback path
  // still works.
  useEffect(() => {
    (async () => {
      const h = await apiClient.health();
      setApiHealth(h);
    })();
  }, []);

  // Persist language
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const t = strings[lang];

  const status = useMemo(() => computeStatus(result), [result]);
  const reviewCount = useMemo(() => reviewCountOf(result), [result]);

  const handleLoadBaseline = async () => {
    setLoading(true);
    setUploadError(null);
    setDetailsNotice(null);
    try {
      // Try API first.
      const fromApi = await apiClient.parseDemo();
      if (fromApi) {
        setResult(fromApi);
        setDataSource('api');
        setActiveTab('files');
        setImportedAt(null);
        return;
      }
      // Fall back to bundled baseline.
      setResult(baseline as unknown as ParsingPreviewResult);
      setDataSource('fallback');
      setActiveTab('files');
      setImportedAt(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setDataSource('unknown');
    setActiveTab('files');
    setImportedAt(null);
    setUploadError(null);
    setDetailsNotice(null);
  };

  const openReviewRoute = (route: 'warnings' | 'aging-90-plus' | 'duplicates' | 'not-in-erp-extract' | 'unknown-department') => {
    if (!result?.details) {
      setDetailsNotice('Drill-down requires a schema 1.1 payload with details. This data can still be reviewed in summary mode.');
      return;
    }
    setDetailsNotice(null);
    navigate(`/review/${route}`);
  };

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    setUploadError(null);
    setDetailsNotice(null);
    try {
      const parsed = await apiClient.parseUpload(files);
      setResult(parsed);
      setDataSource('api');
      setActiveTab('files');
      setImportedAt(null);
      const h = await apiClient.health();
      setApiHealth(h);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload parsing failed');
      const h = await apiClient.health();
      setApiHealth(h);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    const session = {
      importBatchId: result.uploadSession.importBatchId,
      timestamp: new Date().toISOString(),
      asOfDate: result.uploadSession.asOfDate,
      fileCount: result.uploadSession.files.length,
      reviewCount,
      dataSource,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setImportedAt(session.timestamp);
    setShowConfirm(false);
    navigate('/dashboard');
  };

  const tabBadges = useMemo(() => {
    if (!result) return undefined;
    const warningTotal = result.validationReport.warnings.reduce((s, w) => s + w.count, 0);
    const reconFail = Object.values(result.reconciliationReport).filter(r => !r.match).length;
    return {
      reconciliation: reconFail > 0 ? { count: reconFail, variant: 'fail' as const } : undefined,
      review: result.reviewCandidates.local.length > 0
        ? { count: result.reviewCandidates.local.length, variant: 'warn' as const }
        : undefined,
      statements: warningTotal > 0
        ? { count: warningTotal, variant: 'warn' as const }
        : undefined,
    };
  }, [result]);

  const canConfirm = status === 'ready' || status === 'review';

  return (
    <div className="app-shell">
      <Header
        lang={lang}
        onLangChange={setLang}
        asOfDate={result?.uploadSession.asOfDate}
        hasData={!!result}
        apiOnline={apiHealth !== null}
        apiVersion={apiHealth?.version}
      />

      <Routes>
        <Route
          path="/dashboard"
          element={(
            <Dashboard
              lang={lang}
              result={result}
              onBackToUpload={() => navigate('/')}
              onOpenReview={() => {
                if (result?.details) {
                  navigate('/review');
                } else {
                  setActiveTab('review');
                  navigate('/');
                }
              }}
              onOpenReviewCategory={openReviewRoute}
              onOpenParty={(partyKey) => navigate(`/party/${partyKey}`)}
              detailsNotice={detailsNotice}
            />
          )}
        />
        <Route path="/review" element={<ReviewQueuePage result={result} />} />
        <Route path="/review/:type" element={<ReviewQueuePage result={result} />} />
        <Route path="/party/:partyKey" element={<PartyDetailPage result={result} />} />
        <Route path="/" element={<main className="app-content">
        <div className="app-subtitle">{t.appSubtitle}</div>

        <div className="workbench">
          <DropZone
            lang={lang}
            onFiles={handleFiles}
            onLoadBaseline={handleLoadBaseline}
            onClear={handleClear}
            hasData={!!result}
            loading={loading}
          />
          <Readiness
            lang={lang}
            status={status}
            result={result}
            reviewCount={reviewCount}
            dataSource={dataSource}
          />
        </div>

        {uploadError && (
          <div className="notice fail upload-error">
            {uploadError}
          </div>
        )}

        {!result ? (
          <div className="empty">
            <h2 className="empty-title">{t.emptyTitle}</h2>
            <p className="empty-sub">{t.emptySub}</p>
          </div>
        ) : (
          <>
            <Tabs
              lang={lang}
              active={activeTab}
              onChange={setActiveTab}
              badges={tabBadges}
            />

            {activeTab === 'files' && <FilesTab lang={lang} result={result} />}
            {activeTab === 'reconciliation' && <ReconciliationTab lang={lang} result={result} />}
            {activeTab === 'statements' && <StatementsTab lang={lang} result={result} />}
            {activeTab === 'review' && <ReviewQueueTab lang={lang} result={result} />}
            {activeTab === 'json' && <RawJsonTab lang={lang} result={result} />}

            <div className="footer-actions">
              <div className="footer-actions-group">
                <button type="button" className="btn" onClick={handleClear}>
                  {t.clear}
                </button>
              </div>

              <div className="footer-actions-group">
                <span
                  className="app-meta"
                  style={{ marginRight: 12, alignSelf: 'center' }}
                >
                  {importedAt ? (
                    <>
                      <span className="badge pass dot">{t.importPassed}</span>{' '}
                      {new Date(importedAt).toLocaleString()}
                    </>
                  ) : (
                    <>
                      <b>{t.spec}</b> {result.specVersion} · <b>{t.parser}</b> {result.parserVersion}
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canConfirm}
                  onClick={() => setShowConfirm(true)}
                >
                  {t.confirmImport}
                </button>
              </div>
            </div>
          </>
        )}
      </main>} />
      </Routes>

      {result && (
        <ConfirmModal
          lang={lang}
          open={showConfirm}
          result={result}
          reviewCount={reviewCount}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}

    </div>
  );
}
