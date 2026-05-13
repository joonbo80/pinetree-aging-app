const API_DEMO_URL = "http://localhost:4000/api/parse-demo";

const i18n = {
  en: {
    appTitle: "Aging App",
    upload: "Upload",
    preview: "Parsing Preview",
    language: "KO",
    dropTitle: "Upload workbench",
    dropText: "Drop Excel/PDF files here or browse to prepare a parsing preview.",
    browse: "Browse files",
    baseline: "Load baseline demo",
    clear: "Clear",
    exportJson: "Export JSON",
    exportCsv: "Export review CSV",
    confirm: "Confirm Import",
    confirmed: "Import confirmed. Dashboard will use this session.",
    files: "Files",
    erp: "ERP Reconciliation",
    statements: "Statements",
    review: "Review Queue",
    raw: "Raw JSON",
    ready: "Ready",
    needsReview: "Needs review",
    blocked: "Blocked",
    noData: "Load the baseline demo or upload files to preview parsing results.",
    dashboard: "Dashboard placeholder",
    dashboardText: "Dashboard Phase 2.2 will start after Upload + Parsing Preview is stable.",
  },
  ko: {
    appTitle: "Aging App",
    upload: "업로드",
    preview: "파싱 미리보기",
    language: "EN",
    dropTitle: "업로드 작업대",
    dropText: "Excel/PDF 파일을 드래그하거나 선택해서 파싱 결과를 확인합니다.",
    browse: "파일 선택",
    baseline: "Baseline Demo 불러오기",
    clear: "초기화",
    exportJson: "JSON 내보내기",
    exportCsv: "검토 CSV 내보내기",
    confirm: "Import 확정",
    confirmed: "Import가 확정되었습니다. Dashboard는 이 세션을 사용합니다.",
    files: "파일",
    erp: "ERP 검증",
    statements: "Statement",
    review: "검토 Queue",
    raw: "Raw JSON",
    ready: "준비 완료",
    needsReview: "검토 필요",
    blocked: "차단",
    noData: "Baseline Demo를 불러오거나 파일을 업로드해서 파싱 결과를 확인하세요.",
    dashboard: "Dashboard 준비 화면",
    dashboardText: "Upload + Parsing Preview가 안정화된 후 Dashboard Phase 2.2를 시작합니다.",
  },
};

const state = {
  lang: localStorage.getItem("agingApp.language") || "en",
  tab: "files",
  result: null,
  uploadedFiles: [],
  route: location.hash === "#dashboard" ? "dashboard" : "upload",
  message: "",
  confirmOpen: false,
  sourceMode: null,
};

const app = document.getElementById("app");

window.addEventListener("hashchange", () => {
  state.route = location.hash === "#dashboard" ? "dashboard" : "upload";
  render();
});

function t(key) {
  return i18n[state.lang][key] || i18n.en[key] || key;
}

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function render() {
  app.replaceChildren(
    h("div", { class: "shell" }, [
      renderHeader(),
      state.route === "dashboard" ? renderDashboard() : renderUploadPreview(),
      state.confirmOpen ? renderConfirmModal() : null,
    ]),
  );
}

function renderHeader() {
  return h("header", { class: "topbar" }, [
    h("a", { class: "brand", href: "https://pinetreeexpress.com", target: "_blank", rel: "noreferrer" }, [
      h("span", { class: "brand-mark", text: "P" }),
      h("span", { class: "brand-text", text: "Pinetree Express" }),
    ]),
    h("nav", { class: "nav" }, [
      h("button", { class: state.route === "upload" ? "nav-btn active" : "nav-btn", onclick: () => navigate("upload"), text: t("upload") }),
      h("button", { class: state.route === "dashboard" ? "nav-btn active" : "nav-btn", onclick: () => navigate("dashboard"), text: "Dashboard" }),
    ]),
    h("div", { class: "header-actions" }, [
      h("label", { class: "search-wrap" }, [
        h("span", { text: "Search" }),
        h("input", {
          class: "search",
          placeholder: state.result ? "Search preview" : "Load demo to enable",
          disabled: !state.result,
          "aria-label": "Search preview",
        }),
      ]),
      h("button", { class: "icon-btn", onclick: toggleLanguage, text: t("language"), title: "Language" }),
    ]),
  ]);
}

function navigate(route) {
  location.hash = route === "dashboard" ? "#dashboard" : "";
}

function toggleLanguage() {
  state.lang = state.lang === "en" ? "ko" : "en";
  localStorage.setItem("agingApp.language", state.lang);
  render();
}

function renderUploadPreview() {
  const summary = state.result ? buildSummary(state.result) : null;
  return h("main", { class: "page" }, [
    h("section", { class: "title-row" }, [
      h("div", {}, [
        h("p", { class: "eyebrow", text: "Phase 2" }),
        h("h1", { text: `${t("upload")} + ${t("preview")}` }),
      ]),
      summary ? renderReadinessPill(summary.readiness) : null,
    ]),
    h("section", { class: "workbench" }, [
      renderDropZone(),
      renderReadiness(summary),
    ]),
    state.result ? renderSourceBar() : null,
    state.message ? h("div", { class: "notice", text: state.message }) : null,
    state.result ? renderPreview(summary) : h("section", { class: "empty-state", text: t("noData") }),
  ]);
}

function renderSourceBar() {
  const label = state.sourceMode === "api" ? "API Demo" : "Local Baseline";
  const tone = state.sourceMode === "api" ? "api" : "local";
  return h("div", { class: `source-bar ${tone}` }, [
    h("span", { text: "Source" }),
    h("strong", { text: label }),
    h("em", { text: state.sourceMode === "api" ? "Loaded from /api/parse-demo" : "Loaded from embedded baseline fallback" }),
  ]);
}

function renderDropZone() {
  return h("div", {
    class: "drop-zone",
    ondragover: (event) => {
      event.preventDefault();
      event.currentTarget.classList.add("drag");
    },
    ondragleave: (event) => event.currentTarget.classList.remove("drag"),
    ondrop: handleDrop,
  }, [
    h("div", { class: "drop-icon", text: "UP" }),
    h("h2", { text: t("dropTitle") }),
    h("p", { text: t("dropText") }),
    h("div", { class: "button-row" }, [
      h("label", { class: "secondary-btn" }, [
        t("browse"),
        h("input", { type: "file", multiple: true, accept: ".xls,.xlsx,.pdf", onchange: handleFileInput }),
      ]),
      h("button", { class: "primary-btn", onclick: loadBaseline, text: t("baseline") }),
    ]),
    state.uploadedFiles.length ? h("ul", { class: "file-chips" }, state.uploadedFiles.map((file) => h("li", { text: file.name }))) : null,
  ]);
}

function renderReadiness(summary) {
  if (!summary) {
    return h("aside", { class: "readiness" }, [
      h("p", { class: "panel-label", text: "Import Readiness" }),
      h("h2", { text: "Waiting for files" }),
      h("p", { class: "muted", text: "Load the baseline demo to view the Phase 1 frozen parser output." }),
    ]);
  }
  return h("aside", { class: "readiness" }, [
    h("p", { class: "panel-label", text: "Import Readiness" }),
    h("div", { class: "readiness-heading" }, [
      h("h2", { text: readinessLabel(summary.readiness) }),
      renderReadinessPill(summary.readiness),
    ]),
    renderMetricGrid([
      ["Files", summary.fileCount],
      ["Critical", summary.criticalCount],
      ["Warnings", summary.warningCount],
      ["Statements", summary.statementCount],
      ["Review", summary.localReviewCount],
      ["ERP Diff", summary.erpDiffOk ? "0" : "Check"],
    ]),
    h("div", { class: "action-row" }, [
      h("button", { class: "secondary-btn", onclick: clearSession, text: t("clear") }),
      h("button", { class: "secondary-btn", onclick: exportJson, disabled: !state.result, text: t("exportJson") }),
      h("button", { class: "secondary-btn", onclick: exportReviewCsv, disabled: !state.result, text: t("exportCsv") }),
      h("button", { class: "primary-btn", onclick: openConfirmModal, disabled: summary.readiness === "blocked", text: t("confirm") }),
    ]),
  ]);
}

function renderMetricGrid(items) {
  return h("div", { class: "metric-grid" }, items.map(([label, value]) =>
    h("div", { class: "metric" }, [
      h("span", { text: label }),
      h("strong", { text: value }),
    ]),
  ));
}

function renderReadinessPill(status) {
  return h("span", { class: `status ${status}`, text: readinessLabel(status) });
}

function readinessLabel(status) {
  if (status === "ready") return t("ready");
  if (status === "blocked") return t("blocked");
  return t("needsReview");
}

function renderPreview(summary) {
  const tabs = [
    ["files", t("files")],
    ["erp", t("erp")],
    ["statements", t("statements")],
    ["review", t("review")],
    ["raw", t("raw")],
  ];
  return h("section", { class: "preview" }, [
    h("div", { class: "tabs" }, tabs.map(([id, label]) =>
      h("button", { class: state.tab === id ? "tab active" : "tab", onclick: () => setTab(id), text: label }),
    )),
    h("div", { class: "tab-panel" }, renderTab(summary)),
  ]);
}

function setTab(tab) {
  state.tab = tab;
  render();
}

function renderTab(summary) {
  if (state.tab === "files") return [renderFilesTable()];
  if (state.tab === "erp") return [renderErp(summary)];
  if (state.tab === "statements") return [renderStatements(summary)];
  if (state.tab === "review") return [renderReviewQueue(summary)];
  return [renderRawJson()];
}

function renderFilesTable() {
  const rows = state.result.classificationReport || [];
  return renderTable(["File", "Type", "Confidence", "Rules", "Status"], rows.map((row) => [
    row.file,
    row.detectedType,
    `${row.confidence}%`,
    (row.rulesPassed || []).join(", "),
    row.requiresUserSelection ? "Manual required" : "Classified",
  ]));
}

function renderErp(summary) {
  const reports = state.result.reconciliationReport || {};
  const rows = Object.entries(reports).map(([type, report]) => [
    type,
    report.sourceRowCount,
    report.parsedRowCount,
    report.skippedRowCount,
    report.rejectedRowCount,
    money(report.sourceComputedTotal),
    money(report.parsedTotal),
    money(report.diff),
    report.match ? "Match" : "Check",
  ]);
  return h("div", {}, [
    h("div", { class: "card-row" }, [
      statCard("ERP Diff", summary.erpDiffOk ? "0" : "Check", summary.erpDiffOk ? "ok" : "bad"),
      statCard("Transactions", state.result.transactions.length, "neutral"),
      statCard("Skipped", Object.values(reports).reduce((sum, item) => sum + item.skippedRowCount, 0), "neutral"),
    ]),
    renderTable(["Type", "Source", "Parsed", "Skipped", "Rejected", "Source Total", "Parsed Total", "Diff", "Status"], rows),
  ]);
}

function renderStatements(summary) {
  const agent = state.result.statementMatchReport?.agent || {};
  const local = state.result.statementMatchReport?.local || {};
  return h("div", { class: "statement-grid" }, [
    h("section", { class: "flat-panel" }, [
      h("h3", { text: "Agent Statements" }),
      renderMetricGrid([
        ["Statements", agent.statementCount || 0],
        ["Refs", agent.transactionRefCount || 0],
        ["Matched", agent.matchedRefCount || 0],
        ["As-of", agent.asOfDateMismatchCount || 0],
        ["Settled", agent.settledInErpCount || 0],
        ["Changed", agent.changedInErpCount || 0],
      ]),
      h("p", { class: "help-text", text: state.lang === "ko" ? "Statement 금액은 발행일 기준이고 ERP 금액은 업로드 기준일 현재 금액입니다." : "Statement balances are compared with the current ERP balance as of the import date." }),
    ]),
    h("section", { class: "flat-panel" }, [
      h("h3", { text: "Local Statements" }),
      renderMetricGrid([
        ["Statements", local.statementCount || 0],
        ["Refs", local.transactionRefCount || 0],
        ["Found", local.refFoundCount || 0],
        ["Exact", local.exactSignedBalanceMatchCount || 0],
        ["Review", local.notInUploadedErpExtractCount || 0],
        ["No Ref", local.noReferenceNumberCount || 0],
      ]),
      h("p", { class: "help-text", text: "Only NOT_IN_UPLOADED_ERP_EXTRACT rows are treated as review queue items." }),
    ]),
  ]);
}

function renderReviewQueue(summary) {
  const reviewRows = localReviewRows(state.result);
  return h("div", {}, [
    h("div", { class: "card-row" }, [
      statCard("Local Review", summary.localReviewCount, summary.localReviewCount ? "warn" : "ok"),
      statCard("Duplicates", countAnomaly("W1"), "warn"),
      statCard("Critical", summary.criticalCount, summary.criticalCount ? "bad" : "ok"),
    ]),
    h("p", { class: "review-note", text: "These rows are the only remaining Local Statement items that require business review after historical, no-ref, and cross-currency rows were separated." }),
    renderReviewTable(reviewRows),
  ]);
}

function renderReviewTable(rows) {
  const tableRows = rows.map((row) => [
    row.partyName,
    row.sourceRow,
    row.invoiceDate,
    row.ourRefNo || "",
    row.invoiceNo || "",
    row.currency,
    money(row.statementBalance),
    row.differenceType,
  ]);
  return h("div", { class: "table-wrap review-table" }, [
    h("table", {}, [
      h("thead", {}, h("tr", {}, ["Party", "Row", "Date", "Ref", "Invoice", "Currency", "Balance", "Type"].map((header) => h("th", { text: header })))),
      h("tbody", {}, tableRows.map((row) => h("tr", { class: "review-row" }, row.map((cell, index) => {
        if (index === 7) return h("td", {}, h("span", { class: "review-badge", text: cell }));
        return h("td", { text: cell });
      })))),
    ]),
  ]);
}

function renderRawJson() {
  return h("pre", { class: "raw-json", text: JSON.stringify({
    versions: {
      specVersion: state.result.specVersion,
      schemaVersion: state.result.schemaVersion,
      parserVersion: state.result.parserVersion,
    },
    uploadSession: state.result.uploadSession,
    classificationReport: state.result.classificationReport,
    reconciliationReport: state.result.reconciliationReport,
    statementMatchReport: {
      agent: withoutStatements(state.result.statementMatchReport?.agent),
      local: withoutStatements(state.result.statementMatchReport?.local),
    },
  }, null, 2) });
}

function withoutStatements(report) {
  if (!report) return null;
  const copy = { ...report };
  delete copy.statements;
  return copy;
}

function statCard(label, value, tone) {
  return h("div", { class: `stat-card ${tone}` }, [
    h("span", { text: label }),
    h("strong", { text: value }),
  ]);
}

function renderTable(headers, rows) {
  return h("div", { class: "table-wrap" }, [
    h("table", {}, [
      h("thead", {}, h("tr", {}, headers.map((header) => h("th", { text: header })))),
      h("tbody", {}, rows.map((row) => h("tr", {}, row.map((cell) => h("td", { text: cell }))))),
    ]),
  ]);
}

function buildSummary(result) {
  const criticalCount = (result.validationReport?.critical || []).length;
  const warningCount = Object.values(result.validationReport?.warnings || {}).reduce((sum, group) => sum + (group.affectedTransactions?.length || group.count || 0), 0);
  const unknownFileCount = (result.classificationReport || []).filter((file) => file.requiresUserSelection).length;
  const erpDiffOk = Object.values(result.reconciliationReport || {}).every((report) => report.match);
  const localReviewCount = result.statementMatchReport?.local?.notInUploadedErpExtractCount || 0;
  const readiness = criticalCount || unknownFileCount || !erpDiffOk ? "blocked" : warningCount || localReviewCount ? "review" : "ready";
  return {
    readiness,
    criticalCount,
    warningCount,
    fileCount: result.classificationReport?.length || 0,
    statementCount: result.statements?.length || 0,
    localReviewCount,
    erpDiffOk,
  };
}

function localReviewRows(result) {
  return (result.statementMatchReport?.local?.statements || [])
    .flatMap((statement) =>
      (statement.matches || [])
        .filter((match) => match.differenceType === "NOT_IN_UPLOADED_ERP_EXTRACT")
        .map((match) => ({
          partyName: statement.partyName,
          sourceFile: statement.sourceFile,
          sourceRow: match.statementRow,
          invoiceDate: match.invoiceDate,
          ourRefNo: match.ourRefNo,
          invoiceNo: match.invoiceNo,
          currency: match.currency,
          statementBalance: match.statementBalance,
          differenceType: match.differenceType,
        })),
    );
}

function countAnomaly(rule) {
  return (state.result.transactions || []).filter((transaction) => transaction.anomalyRefs?.includes(rule)).length;
}

async function loadBaseline() {
  state.message = "Loading baseline parser output...";
  render();
  const loaded = await loadBaselineDemo();
  state.result = loaded.data;
  state.sourceMode = loaded.mode;
  state.uploadedFiles = state.result.uploadSession.files.map((file) => ({ name: file.name }));
  state.tab = "files";
  state.message = loaded.mode === "api" ? "" : "API unavailable. Loaded local baseline fallback.";
  localStorage.setItem("agingApp.lastImportSession", JSON.stringify({
    importBatchId: state.result.uploadSession.importBatchId,
    timestamp: state.result.uploadSession.timestamp,
    asOfDate: state.result.uploadSession.asOfDate,
  }));
  render();
}

async function loadBaselineDemo() {
  try {
    const response = await fetch(API_DEMO_URL);
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return {
      mode: "api",
      data: await response.json(),
    };
  } catch (error) {
    console.warn("[Baseline] API unavailable, using local baseline", error);
    if (!window.BASELINE_RESULT) throw new Error("No API response and no local baseline is available");
    return {
      mode: "local",
      data: window.BASELINE_RESULT,
    };
  }
}

function handleDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag");
  state.uploadedFiles = Array.from(event.dataTransfer.files || []);
  state.message = "File upload parsing will be connected after the baseline preview UI is approved. Use the baseline demo for now.";
  render();
}

function handleFileInput(event) {
  state.uploadedFiles = Array.from(event.target.files || []);
  state.message = "File upload parsing will be connected after the baseline preview UI is approved. Use the baseline demo for now.";
  render();
}

function clearSession() {
  state.result = null;
  state.uploadedFiles = [];
  state.message = "";
  state.confirmOpen = false;
  state.sourceMode = null;
  render();
}

function openConfirmModal() {
  state.confirmOpen = true;
  render();
}

function closeConfirmModal() {
  state.confirmOpen = false;
  render();
}

function confirmImport() {
  if (!state.result) return;
  localStorage.setItem("agingApp.lastImportSession", JSON.stringify({
    importBatchId: state.result.uploadSession.importBatchId,
    timestamp: new Date().toISOString(),
    confirmed: true,
  }));
  state.message = t("confirmed");
  state.confirmOpen = false;
  navigate("dashboard");
}

function exportJson() {
  download("aging-parse-result.json", JSON.stringify(state.result, null, 2), "application/json");
}

function exportReviewCsv() {
  const rows = localReviewRows(state.result);
  const headers = Object.keys(rows[0] || { partyName: "", sourceFile: "", sourceRow: "", invoiceDate: "", ourRefNo: "", invoiceNo: "", currency: "", statementBalance: "", differenceType: "" });
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  download("local-review-candidates.csv", csv, "text/csv");
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = h("a", { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function money(value) {
  if (typeof value !== "number") return value;
  return value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderDashboard() {
  return h("main", { class: "page" }, [
    h("section", { class: "title-row" }, [
      h("div", {}, [
        h("p", { class: "eyebrow", text: "Phase 2.2" }),
        h("h1", { text: t("dashboard") }),
      ]),
    ]),
    h("section", { class: "empty-state" }, [
      h("h2", { text: t("dashboard") }),
      h("p", { text: t("dashboardText") }),
      h("button", { class: "primary-btn", onclick: () => navigate("upload"), text: `${t("upload")} + ${t("preview")}` }),
    ]),
  ]);
}

function renderConfirmModal() {
  const summary = buildSummary(state.result);
  const classified = (state.result.classificationReport || []).filter((file) => !file.requiresUserSelection).length;
  const totalFiles = state.result.classificationReport?.length || 0;
  return h("div", { class: "modal-backdrop", onclick: (event) => {
    if (event.target.classList.contains("modal-backdrop")) closeConfirmModal();
  } }, [
    h("section", { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-title" }, [
      h("h2", { id: "confirm-title", text: "Confirm Import" }),
      h("p", { class: "muted", text: "This will load the parsed baseline session into the workspace preview state." }),
      h("div", { class: "confirm-grid" }, [
        h("div", {}, [h("span", { text: "Files classified" }), h("strong", { text: `${classified}/${totalFiles}` })]),
        h("div", {}, [h("span", { text: "ERP reconciliation" }), h("strong", { text: summary.erpDiffOk ? "Passed" : "Check" })]),
        h("div", {}, [h("span", { text: "Critical errors" }), h("strong", { text: summary.criticalCount })]),
        h("div", {}, [h("span", { text: "Review candidates" }), h("strong", { text: summary.localReviewCount })]),
      ]),
      h("div", { class: "modal-actions" }, [
        h("button", { class: "secondary-btn", onclick: closeConfirmModal, text: "Cancel" }),
        h("button", { class: "primary-btn", onclick: confirmImport, text: "Confirm Import" }),
      ]),
    ]),
  ]);
}

render();
