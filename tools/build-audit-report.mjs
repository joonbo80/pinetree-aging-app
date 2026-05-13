import fs from "node:fs/promises";

const input = process.argv[2];
const outputPrefix = process.argv[3] || "erp-audit";
if (!input) {
  console.error("Usage: node tools/build-audit-report.mjs <parse-result.json> [output-prefix]");
  process.exit(2);
}

const result = JSON.parse(await fs.readFile(input, "utf8"));
const transactions = result.transactions || [];

const audit = {
  generatedAt: new Date().toISOString(),
  source: input,
  versions: {
    specVersion: result.specVersion,
    schemaVersion: result.schemaVersion,
    parserVersion: result.parserVersion,
  },
  uploadSession: result.uploadSession,
  classificationReport: result.classificationReport,
  reconciliationReport: result.reconciliationReport,
  totals: {
    bySourceTypeCurrency: groupTotals(transactions, ["sourceType", "currency"]),
    byDirectionCurrency: groupTotals(transactions, ["direction", "currency"]),
    byDepartmentCurrency: groupTotals(transactions, ["department", "currency"]),
    byCompanyCurrency: topGroups(groupTotals(transactions, ["partyName", "currency"]), 50, "absoluteBalance"),
    agingBuckets: groupTotals(transactions, ["agingBucket", "currency"]),
    zeroBalance: buildZeroBalanceSummary(transactions),
  },
  warnings: buildAnomalySummary(transactions, "W"),
  info: buildAnomalySummary(transactions, "I"),
  duplicateReview: buildDuplicateReview(transactions),
  crossReference: buildCrossReferenceSummary(transactions),
  statements: buildStatementSummary(result),
  skippedRows: buildSkippedRows(result),
  skippedReasonBreakdown: buildSkippedReasonBreakdown(result),
  rejectedRows: result.rejectedRows || [],
};

await fs.writeFile(`${outputPrefix}.json`, JSON.stringify(audit, null, 2), "utf8");
await fs.writeFile(`${outputPrefix}-transactions.csv`, toCsv(transactions.map(transactionRow)), "utf8");
await fs.writeFile(`${outputPrefix}-anomalies.csv`, toCsv(anomalyRows(transactions)), "utf8");
await fs.writeFile(`${outputPrefix}-summary.md`, toMarkdownSummary(audit), "utf8");

console.log(
  JSON.stringify(
    {
      auditJson: `${outputPrefix}.json`,
      summaryMarkdown: `${outputPrefix}-summary.md`,
      transactionsCsv: `${outputPrefix}-transactions.csv`,
      anomaliesCsv: `${outputPrefix}-anomalies.csv`,
      transactionCount: transactions.length,
      warningRules: Object.fromEntries(Object.entries(audit.warnings).map(([rule, value]) => [rule, value.count])),
      infoRules: Object.fromEntries(Object.entries(audit.info).map(([rule, value]) => [rule, value.count])),
    },
    null,
    2,
  ),
);

function groupTotals(rows, fields) {
  const groups = new Map();
  for (const row of rows) {
    const key = fields.map((field) => row[field] ?? "(blank)").join("|");
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        count: 0,
        rawBalance: 0,
        signedBalance: 0,
        absoluteBalance: 0,
        fields: Object.fromEntries(fields.map((field) => [field, row[field] ?? null])),
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.rawBalance += row.rawBalance || 0;
    group.signedBalance += row.signedBalance || 0;
    group.absoluteBalance += row.absoluteBalance || 0;
  }
  return [...groups.values()]
    .map(roundGroup)
    .sort((a, b) => Math.abs(b.absoluteBalance) - Math.abs(a.absoluteBalance));
}

function topGroups(groups, limit, sortField) {
  return [...groups].sort((a, b) => Math.abs(b[sortField] || 0) - Math.abs(a[sortField] || 0)).slice(0, limit);
}

function roundGroup(group) {
  return {
    ...group,
    rawBalance: round(group.rawBalance),
    signedBalance: round(group.signedBalance),
    absoluteBalance: round(group.absoluteBalance),
  };
}

function buildAnomalySummary(rows, prefix) {
  if (prefix === "W") {
    const base = buildStandardAnomalySummary(rows, prefix);
    if (base.W2) base.W2 = buildW2CompanySummary(rows);
    return base;
  }
  return buildStandardAnomalySummary(rows, prefix);
}

function buildStandardAnomalySummary(rows, prefix) {
  const summary = {};
  for (const row of rows) {
    for (const rule of row.anomalyRefs || []) {
      if (!rule.startsWith(prefix)) continue;
      if (!summary[rule]) summary[rule] = { count: 0, sample: [] };
      summary[rule].count += 1;
      if (summary[rule].sample.length < 25) summary[rule].sample.push(transactionRow(row));
    }
  }
  return summary;
}

function buildW2CompanySummary(rows) {
  const byCompany = new Map();
  for (const row of rows.filter((item) => item.anomalyRefs?.includes("W2"))) {
    if (!byCompany.has(row.partyName)) {
      byCompany.set(row.partyName, { partyName: row.partyName, currencies: new Set(), count: 0, sample: [] });
    }
    const group = byCompany.get(row.partyName);
    group.currencies.add(row.currency);
    group.count += 1;
    if (group.sample.length < 10) group.sample.push(transactionRow(row));
  }
  return {
    count: byCompany.size,
    transactionCount: [...byCompany.values()].reduce((sum, group) => sum + group.count, 0),
    sample: [...byCompany.values()]
      .map((group) => ({ ...group, currencies: [...group.currencies].sort() }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
  };
}

function buildDuplicateReview(rows) {
  const groups = new Map();
  for (const row of rows.filter((item) => item.anomalyRefs?.includes("W1"))) {
    const key = `${row.sourceIdentityKey}|${row.sourceContentHash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const duplicateGroups = [...groups.values()].map((group) => ({
    sourceType: group[0].sourceType,
    sourceIdentityKey: group[0].sourceIdentityKey,
    currency: group[0].currency,
    count: group.length,
    duplicateCount: Math.max(0, group.length - 1),
    potentialDuplicateRawBalance: round(group.slice(1).reduce((sum, row) => sum + row.rawBalance, 0)),
    potentialDuplicateSignedBalance: round(group.slice(1).reduce((sum, row) => sum + row.signedBalance, 0)),
    rows: group.map((row) => `${row.sourceType}:${row.sourceRow}`),
    sample: group.map(transactionRow),
  }));
  const sortedGroups = duplicateGroups.sort(
    (a, b) => Math.abs(b.potentialDuplicateSignedBalance) - Math.abs(a.potentialDuplicateSignedBalance),
  );
  return {
    policy: "Phase 1 keeps exact duplicates in parsed totals and flags them for user review only. No automatic exclusion is applied.",
    groupCount: duplicateGroups.length,
    transactionCount: duplicateGroups.reduce((sum, group) => sum + group.count, 0),
    potentialDuplicateRawBalance: round(duplicateGroups.reduce((sum, group) => sum + group.potentialDuplicateRawBalance, 0)),
    potentialDuplicateSignedBalance: round(duplicateGroups.reduce((sum, group) => sum + group.potentialDuplicateSignedBalance, 0)),
    groups: sortedGroups,
    sampleGroups: sortedGroups.slice(0, 10),
  };
}

function buildCrossReferenceSummary(rows) {
  const byRefCurrency = new Map();
  const currenciesByRef = new Map();
  for (const row of rows) {
    if (!row.ourRefNo) continue;
    const key = `${row.ourRefNo}|${row.currency}`;
    if (!byRefCurrency.has(key)) byRefCurrency.set(key, []);
    byRefCurrency.get(key).push(row);
    if (!currenciesByRef.has(row.ourRefNo)) currenciesByRef.set(row.ourRefNo, new Set());
    currenciesByRef.get(row.ourRefNo).add(row.currency);
  }
  const refCurrencyGroups = [...byRefCurrency.entries()].map(([key, group]) => {
    const [ourRefNo, currency] = key.split("|");
    return {
    ourRefNo,
    currency,
    count: group.length,
    sourceTypes: [...new Set(group.map((row) => row.sourceType))],
    rawBalance: round(group.reduce((sum, row) => sum + row.rawBalance, 0)),
    signedBalance: round(group.reduce((sum, row) => sum + row.signedBalance, 0)),
    rows: group.map((row) => `${row.sourceType}:${row.sourceRow}`),
    };
  });
  const multiCurrencyRefs = [...currenciesByRef.entries()]
    .filter(([, currencies]) => currencies.size > 1)
    .map(([ourRefNo, currencies]) => ({ ourRefNo, currencies: [...currencies].sort() }));
  return {
    totalRefs: currenciesByRef.size,
    totalRefCurrencyGroups: refCurrencyGroups.length,
    multiCurrencyRefs: multiCurrencyRefs.length,
    multiCurrencyRefSamples: multiCurrencyRefs.slice(0, 50),
    multiSourceRefCurrencyGroups: refCurrencyGroups.filter((group) => group.sourceTypes.length > 1).length,
    refCurrencyGroups,
    byRef: Object.fromEntries(
      [...currenciesByRef.keys()].map((ourRefNo) => [
        ourRefNo,
        refCurrencyGroups.filter((group) => group.ourRefNo === ourRefNo),
      ]),
    ),
    topMultiSourceRefs: refCurrencyGroups
      .filter((group) => group.sourceTypes.length > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50),
  };
}

function buildStatementSummary(result) {
  const statements = result.statements || [];
  const agentStatements = statements.filter((statement) => statement.sourceType === "AGENT_STATEMENT");
  const localStatements = statements.filter((statement) => statement.sourceType === "LOCAL_STATEMENT");
  const agentMatch = result.statementMatchReport?.agent || {};
  const localMatch = result.statementMatchReport?.local || {};
  return {
    statementCount: statements.length,
    agent: {
      statementCount: agentStatements.length,
      transactionCount: agentStatements.reduce((sum, statement) => sum + (statement.transactions?.length || 0), 0),
      byCurrency: countBy(agentStatements, (statement) => statement.currency || "(blank)"),
      byDirection: countBy(agentStatements, (statement) => statement.direction || "(blank)"),
      reconciliationBadCount: agentStatements.filter((statement) => !statement.reconciliation?.match).length,
      matchedRefCount: agentMatch.matchedRefCount || 0,
      unmatchedRefCount: agentMatch.unmatchedRefCount || 0,
      identityMismatchCount: agentMatch.identityMismatchCount || 0,
      currentBalanceDiffCount: agentMatch.currentBalanceDiffCount || 0,
      settledInErpCount: agentMatch.settledInErpCount || 0,
      changedInErpCount: agentMatch.changedInErpCount || 0,
      asOfDateMismatchCount: agentMatch.asOfDateMismatchCount || 0,
      currentBalanceDiffPolicy:
        "Informational only. Agent Statement balances are historical statement balances; ERP CRDR rawBalance may reflect current settlement status.",
    },
    local: {
      statementCount: localStatements.length,
      transactionCount: localStatements.reduce((sum, statement) => sum + (statement.transactions?.length || 0), 0),
      byCurrency: countBy(localStatements, (statement) => statement.currency || "(blank)"),
      byDirection: countBy(localStatements, (statement) => statement.direction || "(blank)"),
      reconciliationBadCount: localStatements.filter((statement) => !statement.reconciliation?.match).length,
      refFoundCount: localMatch.refFoundCount || 0,
      refMissingCount: localMatch.refMissingCount || 0,
      outsideUploadedErpDateRangeCount: localMatch.outsideUploadedErpDateRangeCount || 0,
      unmatchedWithinUploadedDateRangeCount: localMatch.unmatchedWithinUploadedDateRangeCount || 0,
      sameRefDifferentCurrencyCount: localMatch.sameRefDifferentCurrencyCount || 0,
      noReferenceNumberCount: localMatch.noReferenceNumberCount || 0,
      notInUploadedErpExtractCount: localMatch.notInUploadedErpExtractCount || 0,
      refFoundBalanceDiffCount: localMatch.refFoundBalanceDiffCount || 0,
      exactSignedBalanceMatchCount: localMatch.exactSignedBalanceMatchCount || 0,
      erpDateRange: localMatch.erpDateRange || null,
      matchPolicy:
        "Informational only. Local Statements may include historical rows outside the ERP sample period; totals are validated by statement reconciliation.",
    },
  };
}

function countBy(rows, keyFn) {
  const counts = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function buildSkippedRows(result) {
  const skipped = [];
  for (const [sourceType, report] of Object.entries(result.reconciliationReport || {})) {
    if (report.skippedRowCount) {
      const samples = (result.skippedRows || [])
        .filter((row) => row.sourceType === sourceType || row.sourceFile?.toUpperCase().includes(sourceType))
        .slice(0, 25);
      skipped.push({ sourceType, skippedRowCount: report.skippedRowCount, samples });
    }
  }
  return skipped;
}

function buildSkippedReasonBreakdown(result) {
  const groups = new Map();
  for (const row of result.skippedRows || []) {
    const key = `${row.sourceType || "(unknown)"}|${row.reason || "(unknown)"}`;
    if (!groups.has(key)) {
      groups.set(key, { sourceType: row.sourceType || null, reason: row.reason || null, count: 0, samples: [] });
    }
    const group = groups.get(key);
    group.count += 1;
    if (group.samples.length < 25) group.samples.push(row);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function buildZeroBalanceSummary(rows) {
  const zeroRows = rows.filter((row) => row.isZeroBalance);
  return {
    count: zeroRows.length,
    percentage: rows.length ? round((zeroRows.length / rows.length) * 100) : 0,
    bySourceTypeCurrency: groupTotals(zeroRows, ["sourceType", "currency"]),
    samples: zeroRows.slice(0, 25).map(transactionRow),
  };
}

function transactionRow(row) {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceFile: row.sourceFile,
    sourceSheet: row.sourceSheet,
    sourceRow: row.sourceRow,
    sourceInternalId: row.sourceInternalId,
    partyName: row.partyName,
    currency: row.currency,
    direction: row.direction,
    department: row.department,
    agingBucket: row.agingBucket,
    agingDays: row.agingDays,
    grossAmount: row.grossAmount,
    paidAmount: row.paidAmount,
    rawBalance: row.rawBalance,
    signedBalance: row.signedBalance,
    absoluteBalance: row.absoluteBalance,
    invoiceNo: row.invoiceNo,
    crdrNo: row.crdrNo,
    ourRefNo: row.ourRefNo,
    blNo: row.blNo,
    anomalyRefs: (row.anomalyRefs || []).join(";"),
  };
}

function anomalyRows(rows) {
  return rows.flatMap((row) =>
    (row.anomalyRefs || []).map((rule) => ({
      rule,
      sourceType: row.sourceType,
      sourceFile: row.sourceFile,
      sourceRow: row.sourceRow,
      partyName: row.partyName,
      currency: row.currency,
      direction: row.direction,
      rawBalance: row.rawBalance,
      ourRefNo: row.ourRefNo,
      sourceInternalId: row.sourceInternalId,
    })),
  );
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

function toMarkdownSummary(audit) {
  const lines = [];
  lines.push("# ERP Parsing Audit Summary");
  lines.push("");
  lines.push(`Generated: ${audit.generatedAt}`);
  lines.push(`As of date: ${audit.uploadSession?.asOfDate || ""}`);
  lines.push("");
  lines.push("## Classification");
  lines.push("");
  lines.push("| File | Type | Confidence | Rules |");
  lines.push("|---|---:|---:|---|");
  for (const item of audit.classificationReport || []) {
    lines.push(`| ${item.file} | ${item.detectedType} | ${item.confidence}% | ${(item.rulesPassed || []).join(", ")} |`);
  }
  lines.push("");
  lines.push("## Reconciliation");
  lines.push("");
  lines.push("| Type | Source Rows | Parsed | Skipped | Rejected | Total | Diff |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|");
  for (const [type, report] of Object.entries(audit.reconciliationReport || {})) {
    lines.push(
      `| ${type} | ${report.sourceRowCount} | ${report.parsedRowCount} | ${report.skippedRowCount} | ${report.rejectedRowCount} | ${report.parsedTotal} | ${report.diff} |`,
    );
  }
  lines.push("");
  lines.push("## Direction Totals");
  lines.push("");
  lines.push("| Direction | Currency | Count | Signed Balance | Absolute Balance |");
  lines.push("|---|---|---:|---:|---:|");
  for (const group of audit.totals.byDirectionCurrency) {
    lines.push(
      `| ${group.fields.direction} | ${group.fields.currency} | ${group.count} | ${group.signedBalance} | ${group.absoluteBalance} |`,
    );
  }
  lines.push("");
  lines.push("## Zero Balance");
  lines.push("");
  lines.push(`Zero-balance parsed transactions: ${audit.totals.zeroBalance.count} (${audit.totals.zeroBalance.percentage}%)`);
  lines.push("");
  lines.push("| Type | Currency | Count |");
  lines.push("|---|---|---:|");
  for (const group of audit.totals.zeroBalance.bySourceTypeCurrency) {
    lines.push(`| ${group.fields.sourceType} | ${group.fields.currency} | ${group.count} |`);
  }
  lines.push("");
  lines.push("## Warning Counts");
  lines.push("");
  lines.push("| Rule | Count |");
  lines.push("|---|---:|");
  for (const [rule, detail] of Object.entries(audit.warnings)) lines.push(`| ${rule} | ${detail.count} |`);
  lines.push("");
  lines.push("## Duplicate Review Policy");
  lines.push("");
  lines.push(audit.duplicateReview.policy);
  lines.push("");
  lines.push(`Exact duplicate groups: ${audit.duplicateReview.groupCount}`);
  lines.push(`Exact duplicate transactions: ${audit.duplicateReview.transactionCount}`);
  lines.push(`Potential duplicate signed balance impact: ${audit.duplicateReview.potentialDuplicateSignedBalance}`);
  lines.push("");
  lines.push("| Identity Key | Currency | Count | Potential Signed Impact | Rows |");
  lines.push("|---|---|---:|---:|---|");
  for (const group of audit.duplicateReview.sampleGroups.slice(0, 10)) {
    lines.push(
      `| ${group.sourceIdentityKey} | ${group.currency} | ${group.count} | ${group.potentialDuplicateSignedBalance} | ${group.rows.join(" ")} |`,
    );
  }
  lines.push("");
  lines.push("## Skipped Rows");
  lines.push("");
  lines.push("| Source Type | Reason | Count |");
  lines.push("|---|---|---:|");
  for (const group of audit.skippedReasonBreakdown) {
    lines.push(`| ${group.sourceType} | ${group.reason} | ${group.count} |`);
  }
  lines.push("");
  lines.push("## Info Counts");
  lines.push("");
  lines.push("| Rule | Count |");
  lines.push("|---|---:|");
  for (const [rule, detail] of Object.entries(audit.info)) lines.push(`| ${rule} | ${detail.count} |`);
  lines.push("");
  lines.push("## Statements");
  lines.push("");
  lines.push(`Statement count: ${audit.statements.statementCount}`);
  lines.push(`Agent statements: ${audit.statements.agent.statementCount}`);
  lines.push(`Agent statement transactions: ${audit.statements.agent.transactionCount}`);
  lines.push(`Agent matched CRDR refs: ${audit.statements.agent.matchedRefCount}`);
  lines.push(`Agent unmatched CRDR refs: ${audit.statements.agent.unmatchedRefCount}`);
  lines.push(`Agent identity mismatches: ${audit.statements.agent.identityMismatchCount}`);
  lines.push(`Agent current balance differences: ${audit.statements.agent.currentBalanceDiffCount}`);
  lines.push(`Agent as-of date mismatches: ${audit.statements.agent.asOfDateMismatchCount}`);
  lines.push(`Agent settled in ERP after statement: ${audit.statements.agent.settledInErpCount}`);
  lines.push(`Agent changed in ERP after statement: ${audit.statements.agent.changedInErpCount}`);
  lines.push("");
  lines.push(`Local statements: ${audit.statements.local.statementCount}`);
  lines.push(`Local statement transactions: ${audit.statements.local.transactionCount}`);
  lines.push(`Local reconciliation errors: ${audit.statements.local.reconciliationBadCount}`);
  lines.push(`Local ERP refs found: ${audit.statements.local.refFoundCount}`);
  lines.push(`Local ERP refs missing/historical: ${audit.statements.local.refMissingCount}`);
  lines.push(`Local refs outside uploaded ERP date range: ${audit.statements.local.outsideUploadedErpDateRangeCount}`);
  lines.push(`Local refs not found within uploaded ERP date range: ${audit.statements.local.unmatchedWithinUploadedDateRangeCount}`);
  lines.push(`Local same ref with different currency: ${audit.statements.local.sameRefDifferentCurrencyCount}`);
  lines.push(`Local rows without reference number: ${audit.statements.local.noReferenceNumberCount}`);
  lines.push(`Local refs not in uploaded ERP extract: ${audit.statements.local.notInUploadedErpExtractCount}`);
  lines.push(`Local refs found with balance difference: ${audit.statements.local.refFoundBalanceDiffCount}`);
  lines.push(`Local exact signed-balance matches: ${audit.statements.local.exactSignedBalanceMatchCount}`);
  lines.push(
    `Uploaded ERP transaction date range: ${audit.statements.local.erpDateRange?.from || ""} to ${audit.statements.local.erpDateRange?.to || ""}`,
  );
  lines.push("");
  lines.push("| Local Currency | Statement Count |");
  lines.push("|---|---:|");
  for (const [currency, count] of Object.entries(audit.statements.local.byCurrency)) {
    lines.push(`| ${currency} | ${count} |`);
  }
  lines.push("");
  lines.push("| Currency | Statement Count |");
  lines.push("|---|---:|");
  for (const [currency, count] of Object.entries(audit.statements.agent.byCurrency)) {
    lines.push(`| ${currency} | ${count} |`);
  }
  lines.push("");
  lines.push("## Cross Reference");
  lines.push("");
  lines.push(`Total refs: ${audit.crossReference.totalRefs}`);
  lines.push(`Ref/currency groups: ${audit.crossReference.totalRefCurrencyGroups}`);
  lines.push(`Multi-source ref/currency groups: ${audit.crossReference.multiSourceRefCurrencyGroups}`);
  lines.push(`Refs with both USD and CAD: ${audit.crossReference.multiCurrencyRefs}`);
  lines.push("");
  lines.push("| Ref | Currency | Count | Source Types | Signed Balance | Rows |");
  lines.push("|---|---|---:|---|---:|---|");
  for (const ref of audit.crossReference.topMultiSourceRefs.slice(0, 20)) {
    lines.push(
      `| ${ref.ourRefNo} | ${ref.currency} | ${ref.count} | ${ref.sourceTypes.join("/")} | ${ref.signedBalance} | ${ref.rows.join(" ")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
