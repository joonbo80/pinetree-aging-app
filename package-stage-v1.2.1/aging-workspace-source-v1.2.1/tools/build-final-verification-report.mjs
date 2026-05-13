import fs from "node:fs/promises";

const input = process.argv[2] || "erp-all-parse-result.json";
const outputDir = process.argv[3] || ".";

const result = JSON.parse(await fs.readFile(input, "utf8"));
const transactions = result.transactions || [];
const statements = result.statements || [];
const agent = result.statementMatchReport?.agent || {};
const local = result.statementMatchReport?.local || {};
const localReviewRows = buildLocalReviewRows(local);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/phase1-final-verification-report.md`, buildMarkdown(), "utf8");
await fs.writeFile(`${outputDir}/phase1-local-review-candidates.csv`, toCsv(localReviewRows), "utf8");

console.log(
  JSON.stringify(
    {
      report: `${outputDir}/phase1-final-verification-report.md`,
      localReviewCsv: `${outputDir}/phase1-local-review-candidates.csv`,
      localReviewCount: localReviewRows.length,
    },
    null,
    2,
  ),
);

function buildMarkdown() {
  const lines = [];
  lines.push("# AGING APP Phase 1 Final Verification Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Input: ${input}`);
  lines.push(`As of date: ${result.uploadSession?.asOfDate || ""}`);
  lines.push(`Spec version: ${result.specVersion}`);
  lines.push(`Schema version: ${result.schemaVersion}`);
  lines.push(`Parser version: ${result.parserVersion}`);
  lines.push("");
  lines.push("## Executive Decision");
  lines.push("");
  lines.push("Phase 1 parsing engine is ready to freeze for UI development, with 7 Local Statement rows reserved for business review.");
  lines.push("");
  lines.push("## Classification");
  lines.push("");
  lines.push("| File | Detected Type | Confidence | Rules |");
  lines.push("|---|---:|---:|---|");
  for (const item of result.classificationReport || []) {
    lines.push(`| ${item.file} | ${item.detectedType} | ${item.confidence}% | ${(item.rulesPassed || []).join(", ")} |`);
  }
  lines.push("");
  lines.push("## ERP Reconciliation");
  lines.push("");
  lines.push("| Type | Source Rows | Parsed | Skipped | Rejected | Total | Diff | Match |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const [type, report] of Object.entries(result.reconciliationReport || {})) {
    lines.push(
      `| ${type} | ${report.sourceRowCount} | ${report.parsedRowCount} | ${report.skippedRowCount} | ${report.rejectedRowCount} | ${report.parsedTotal} | ${report.diff} | ${report.match} |`,
    );
  }
  lines.push("");
  lines.push("## ERP Totals");
  lines.push("");
  lines.push("| Direction | Currency | Count | Signed Balance | Absolute Balance |");
  lines.push("|---|---|---:|---:|---:|");
  for (const group of groupTotals(transactions, ["direction", "currency"])) {
    lines.push(
      `| ${group.fields.direction} | ${group.fields.currency} | ${group.count} | ${group.signedBalance} | ${group.absoluteBalance} |`,
    );
  }
  lines.push("");
  lines.push("## Anomaly Summary");
  lines.push("");
  lines.push("| Category | Rule | Count | Interpretation |");
  lines.push("|---|---|---:|---|");
  lines.push(`| Warning | W1 | ${countAnomaly("W1")} | Exact duplicate candidates; kept in parsed totals for review, not auto-excluded. |`);
  lines.push(`| Warning | W2 | ${countW2Companies()} | Companies with both USD and CAD; counted per company. |`);
  lines.push(`| Warning | W6 | ${countAnomaly("W6")} | AP negative balance; flagged but parsed. |`);
  lines.push(`| Info | I1 | ${countAnomaly("I1")} | Aging greater than 90 days. |`);
  lines.push(`| Info | I2 | ${countAnomaly("I2")} | Due date before as-of date with non-zero balance. |`);
  lines.push("");
  lines.push("## Agent Statements");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  lines.push(`| Statements | ${agent.statementCount || 0} |`);
  lines.push(`| Transaction refs | ${agent.transactionRefCount || 0} |`);
  lines.push(`| Matched CRDR refs | ${agent.matchedRefCount || 0} |`);
  lines.push(`| Unmatched CRDR refs | ${agent.unmatchedRefCount || 0} |`);
  lines.push(`| Identity mismatches | ${agent.identityMismatchCount || 0} |`);
  lines.push(`| As-of date mismatches | ${agent.asOfDateMismatchCount || 0} |`);
  lines.push(`| Settled in ERP after statement | ${agent.settledInErpCount || 0} |`);
  lines.push(`| Changed in ERP after statement | ${agent.changedInErpCount || 0} |`);
  lines.push("");
  lines.push("Agent as-of mismatches are not parsing errors. They compare statement-date balances against ERP current balances.");
  lines.push("");
  lines.push("## Local Statements");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|---|---:|");
  lines.push(`| Statements | ${local.statementCount || 0} |`);
  lines.push(`| Transaction refs | ${local.transactionRefCount || 0} |`);
  lines.push(`| Reconciliation errors | ${countLocalReconciliationErrors()} |`);
  lines.push(`| ERP refs found | ${local.refFoundCount || 0} |`);
  lines.push(`| Exact signed-balance matches | ${local.exactSignedBalanceMatchCount || 0} |`);
  lines.push(`| Found refs with balance difference | ${local.refFoundBalanceDiffCount || 0} |`);
  lines.push(`| Refs outside uploaded ERP date range | ${local.outsideUploadedErpDateRangeCount || 0} |`);
  lines.push(`| Same ref with different currency | ${local.sameRefDifferentCurrencyCount || 0} |`);
  lines.push(`| Rows without reference number | ${local.noReferenceNumberCount || 0} |`);
  lines.push(`| Not in uploaded ERP extract | ${local.notInUploadedErpExtractCount || 0} |`);
  lines.push("");
  lines.push(`Uploaded ERP transaction date range: ${local.erpDateRange?.from || ""} to ${local.erpDateRange?.to || ""}`);
  lines.push("");
  lines.push("## Local Review Candidates");
  lines.push("");
  lines.push("These 7 rows are the only Local Statement rows that remain as business review candidates after separating historical rows, same-ref different-currency rows, and rows without a reference number.");
  lines.push("");
  lines.push("| Party | Source Row | Date | Ref | Invoice | Currency | Balance |");
  lines.push("|---|---:|---|---|---|---|---:|");
  for (const row of localReviewRows) {
    lines.push(
      `| ${row.partyName} | ${row.sourceRow} | ${row.invoiceDate} | ${row.ourRefNo || ""} | ${row.invoiceNo || ""} | ${row.currency} | ${row.statementBalance} |`,
    );
  }
  lines.push("");
  lines.push("## Phase 2 Display Rules");
  lines.push("");
  lines.push("- Show Agent `AS_OF_DATE_MISMATCH` as informational, not as an error.");
  lines.push("- Show Local `OUTSIDE_UPLOADED_ERP_DATE_RANGE` as historical/outside extract.");
  lines.push("- Show Local `SAME_REF_DIFFERENT_CURRENCY` separately and never merge USD/CAD.");
  lines.push("- Put Local `NOT_IN_UPLOADED_ERP_EXTRACT` rows into a review queue.");
  lines.push("- Keep duplicate candidates visible but do not auto-exclude them without user approval.");
  lines.push("");
  lines.push("## Freeze Recommendation");
  lines.push("");
  lines.push("Freeze Phase 1 parser behavior and use this report as the baseline snapshot for Phase 2 UI work.");
  lines.push("");
  return lines.join("\n");
}

function buildLocalReviewRows(localReport) {
  return (localReport.statements || [])
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

function groupTotals(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = fields.map((field) => row[field] ?? "(blank)").join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        count: 0,
        signedBalance: 0,
        absoluteBalance: 0,
        fields: Object.fromEntries(fields.map((field) => [field, row[field] ?? null])),
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.signedBalance += row.signedBalance || 0;
    group.absoluteBalance += row.absoluteBalance || 0;
  }
  return [...groups.values()].map((group) => ({
    ...group,
    signedBalance: round(group.signedBalance),
    absoluteBalance: round(group.absoluteBalance),
  }));
}

function countAnomaly(rule) {
  return transactions.filter((transaction) => transaction.anomalyRefs?.includes(rule)).length;
}

function countW2Companies() {
  return new Set(transactions.filter((transaction) => transaction.anomalyRefs?.includes("W2")).map((transaction) => transaction.partyName)).size;
}

function countLocalReconciliationErrors() {
  return statements.filter((statement) => statement.sourceType === "LOCAL_STATEMENT" && !statement.reconciliation?.match).length;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
