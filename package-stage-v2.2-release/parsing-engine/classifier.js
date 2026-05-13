import { SourceType } from "./types.js";
import { normalizeDate } from "./normalizers/date.js";
import { normalizeCurrency } from "./normalizers/currency.js";
import { toNumber } from "./normalizers/balance.js";

export function classifyWorkbook(workbook) {
  const firstSheet = workbook.sheets?.[0] || { name: "", rows: [] };
  const sheetName = firstSheet.name || "";
  const rows = firstSheet.rows || [];
  const rulesPassed = [];
  let detectedType = SourceType.UNKNOWN;

  const sheetType = classifyBySheetName(sheetName, rows);
  if (sheetType !== SourceType.UNKNOWN) {
    detectedType = sheetType;
    rulesPassed.push("sheet_name");
  }

  const patternType = classifyByPattern(rows);
  if (patternType !== SourceType.UNKNOWN) {
    if (detectedType === SourceType.UNKNOWN) detectedType = patternType;
    if (detectedType === patternType) rulesPassed.push("col1_pattern");
  }

  const apVerified = isAp(rows, firstSheet.columnCount);
  if (apVerified) {
    if (detectedType === SourceType.UNKNOWN) detectedType = SourceType.AP;
    if (detectedType === SourceType.AP) rulesPassed.push("ap_heuristic");
  }

  const agentVerified = isAgentStatement(rows, firstSheet.columnCount, sheetName);
  if (agentVerified) {
    if (detectedType === SourceType.UNKNOWN) detectedType = SourceType.AGENT_STATEMENT;
    if (detectedType === SourceType.AGENT_STATEMENT) rulesPassed.push("agent_heuristic");
  }

  const localVerified = isLocalStatement(rows, firstSheet.columnCount, sheetName);
  if (localVerified) {
    if (detectedType === SourceType.UNKNOWN) detectedType = SourceType.LOCAL_STATEMENT;
    if (detectedType === SourceType.LOCAL_STATEMENT) rulesPassed.push("local_heuristic");
  }

  const columnType = classifyByColumnCount(firstSheet.columnCount, rows, sheetName);
  if (columnType !== SourceType.UNKNOWN) {
    if (detectedType === SourceType.UNKNOWN) detectedType = columnType;
    if (detectedType === columnType) rulesPassed.push("column_count");
  }

  return {
    file: workbook.name,
    detectedType,
    confidence: confidenceFor(rulesPassed, detectedType),
    rulesPassed,
    requiresUserSelection: detectedType === SourceType.UNKNOWN,
  };
}

function classifyBySheetName(sheetName, rows) {
  if (sheetName.includes("Invoice List")) return SourceType.INVOICE;
  if (sheetName.includes("CR DR")) return SourceType.CRDR;
  if (sheetName.includes("Cost List")) return SourceType.AP;
  const text = rows.slice(0, 80).flat().join(" ").toUpperCase();
  if (sheetName === "Sheet1" && text.includes("AGENT STATEMENT")) return SourceType.AGENT_STATEMENT;
  if (sheetName === "Sheet1" && text.includes("LOCAL STATEMENT")) return SourceType.LOCAL_STATEMENT;
  return SourceType.UNKNOWN;
}

function classifyByPattern(rows) {
  const values = rows
    .slice(0, 5)
    .map((row) => String(row?.[1] || "").trim())
    .filter(Boolean);
  if (values.length && values.every((value) => /^PEIN\d+/i.test(value))) return SourceType.INVOICE;
  if (values.length && values.every((value) => /^PECDR\d+/i.test(value))) return SourceType.CRDR;
  return SourceType.UNKNOWN;
}

function classifyByColumnCount(columnCount, rows, sheetName) {
  const text = rows.slice(0, 80).flat().join(" ").toUpperCase();
  if (columnCount >= 19 && columnCount <= 21 && sheetName === "Sheet1" && text.includes("LOCAL STATEMENT")) {
    return SourceType.LOCAL_STATEMENT;
  }
  if (columnCount === 26) return SourceType.INVOICE;
  if (columnCount === 19) return SourceType.CRDR;
  if (columnCount === 25) return SourceType.AP;
  if (columnCount === 20 && text.includes("AGENT STATEMENT")) return SourceType.AGENT_STATEMENT;
  return SourceType.UNKNOWN;
}

export function isAp(rows, columnCount) {
  const row = rows.find((candidate) => candidate?.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
  if (!row) return false;
  return Boolean(
    normalizeDate(row[0]) &&
      String(row[1] || "").trim() &&
      columnCount === 25 &&
      toNumber(row[4]) !== null &&
      toNumber(row[5]) !== null &&
      toNumber(row[7]) !== null &&
      normalizeCurrency(row[19]),
  );
}

export function isLocalStatement(rows, columnCount, sheetName) {
  if (sheetName !== "Sheet1" || columnCount < 19 || columnCount > 21) return false;
  const text = rows.slice(0, 80).flat().join(" ").toUpperCase();
  return Boolean(
    text.includes("LOCAL STATEMENT") &&
      text.includes("STATEMENT DATE") &&
      text.includes("TOTAL") &&
      rows.slice(0, 20).some((row) => String(row?.[1] || "").trim().toUpperCase() === "TO") &&
      rows.slice(0, 80).some((row) => row.some((cell) => normalizeCurrency(cell))),
  );
}

export function isAgentStatement(rows, columnCount, sheetName) {
  if (sheetName !== "Sheet1" || columnCount !== 20) return false;
  const text = rows.slice(0, 120).flat().join(" ").toUpperCase();
  return Boolean(
    text.includes("AGENT STATEMENT") &&
      text.includes("STATEMENT DATE") &&
      text.includes("GRAND TOTAL") &&
      text.includes("DUE TO") &&
      rows.slice(0, 120).some((row) => row.some((cell) => /^PECDR/i.test(String(cell || "").trim()))),
  );
}

function confidenceFor(rulesPassed, detectedType) {
  if (detectedType === SourceType.UNKNOWN) return 0;
  const hasSheet = rulesPassed.includes("sheet_name");
  const hasPattern =
    rulesPassed.includes("col1_pattern") ||
    rulesPassed.includes("ap_heuristic") ||
    rulesPassed.includes("agent_heuristic") ||
    rulesPassed.includes("local_heuristic");
  const hasColumn = rulesPassed.includes("column_count");
  if (hasSheet && hasPattern && hasColumn) return 100;
  if (hasSheet && hasPattern) return 90;
  if (hasSheet) return 70;
  if (hasPattern) return 60;
  if (hasColumn) return 40;
  return 0;
}
