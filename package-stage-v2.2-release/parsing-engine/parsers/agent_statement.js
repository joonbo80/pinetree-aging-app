import { randomUUID } from "node:crypto";
import { Direction, SourceType } from "../types.js";
import { normalizeCompanyName } from "../normalizers/company_name.js";
import { normalizeCurrency } from "../normalizers/currency.js";
import { normalizeDate } from "../normalizers/date.js";
import { toNumber } from "../normalizers/balance.js";

export function parseAgentStatementWorkbook(workbook, context) {
  const sheet = workbook.sheets?.[0];
  if (!sheet) return [];
  const blocks = splitAgentBlocks(sheet.rows);
  return blocks.map((block, index) => parseAgentBlock(block, index, workbook, sheet, context)).filter(Boolean);
}

function splitAgentBlocks(rows) {
  const starts = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (rowText(rows[i]).includes("AGENT STATEMENT")) starts.push(i);
  }
  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? rows.length,
    rows: rows.slice(start, starts[index + 1] ?? rows.length),
  }));
}

function parseAgentBlock(block, index, workbook, sheet, context) {
  const companyInfo = extractCompany(block.rows, context.options.aliasTable);
  if (!companyInfo.raw) return null;

  const transactionRows = [];
  const subtotals = [];
  let currency = null;
  let direction = null;
  let dueToText = null;
  let statementDate = null;
  let period = { from: null, to: null };
  let departments = [];
  let currentDepartment = null;
  let grandTotal = null;

  for (let i = 0; i < block.rows.length; i += 1) {
    const row = block.rows[i];
    const text = rowText(row);
    if (text.includes("STATEMENT DATE")) statementDate = extractDateFromRow(row);
    if (text.includes("PERIOD")) period = extractPeriodFromRow(row);
    if (text.includes("DEPARTMENTS")) departments = extractDepartments(row);

    if (isTransactionRow(row)) {
      transactionRows.push(parseAgentTransactionRow(row, block.start + i, currentDepartment));
      continue;
    }

    if (text.includes("SUB TOTAL")) {
      currentDepartment = extractDepartmentLabel(row) || currentDepartment;
      const subtotal = extractAgentTotal(row);
      if (subtotal) {
        subtotal.departmentLabel = currentDepartment;
        subtotals.push(subtotal);
      }
    }

    if (text.includes("GRAND TOTAL")) {
      grandTotal = extractAgentTotal(row);
      currency = extractCurrency(row) || currency;
    }

    if (text.includes("DUE TO")) {
      dueToText = text;
      direction = text.includes("PINETREE") ? Direction.RECEIVABLE : Direction.PAYABLE;
    }
  }

  currency = currency || inferCurrencyFromRows(block.rows);
  direction = direction || Direction.RECEIVABLE;
  const computed = sumTransactions(transactionRows);
  const totals = grandTotal || computed;
  const declaredVsComputed = grandTotal ? round((grandTotal.balance || 0) - computed.balance) : null;

  return {
    id: randomUUID(),
    sourceType: SourceType.AGENT_STATEMENT,
    sourceFile: workbook.name,
    sourceSheet: sheet.name,
    sourceStartRow: block.start + 1,
    sourceEndRow: block.end,
    importBatchId: context.importBatchId,
    blockIndex: index,
    partyName: companyInfo.normalized,
    partyNameRaw: companyInfo.raw,
    partyAddress: extractAddress(block.rows),
    statementDate,
    period,
    departments,
    currency,
    direction,
    dueToText,
    transactionRefs: transactionRows.map((transaction) => transaction.crdrNo).filter(Boolean),
    transactions: transactionRows,
    subtotals,
    totals: {
      dr: round(totals.dr || 0),
      cr: round(totals.cr || 0),
      payment: round(totals.payment || 0),
      balance: round(totals.balance || 0),
      recordCount: totals.recordCount ?? transactionRows.length,
    },
    reconciliation: {
      declaredTotal: grandTotal ? round(grandTotal.balance || 0) : null,
      sourceComputedTotal: round(computed.balance),
      parsedTotal: round(computed.balance),
      declaredVsComputed,
      computedVsParsed: 0,
      recordCountDeclared: grandTotal?.recordCount ?? null,
      recordCountParsed: transactionRows.length,
      match: grandTotal ? Math.abs(declaredVsComputed) < 0.005 && (grandTotal.recordCount ?? transactionRows.length) === transactionRows.length : true,
    },
  };
}

function extractCompany(rows, aliasTable) {
  for (const row of rows) {
    if (String(row?.[1] || "").trim().toUpperCase() === "TO" && String(row?.[2] || "").trim() === ":") {
      const company = normalizeCompanyName(row[3], aliasTable);
      return { raw: company.raw, normalized: company.normalized };
    }
  }
  return { raw: "", normalized: "" };
}

function extractAddress(rows) {
  const parts = [];
  let inAddress = false;
  for (const row of rows) {
    if (String(row?.[1] || "").trim().toUpperCase() === "TO") {
      inAddress = true;
      continue;
    }
    if (!inAddress) continue;
    const text = String(row?.[3] || "").trim();
    if (!text) continue;
    if (/TEL\s*:|STATEMENT DATE|PERIOD|DEPARTMENTS|OPEN \/ ALL|REMIT AMOUNT/i.test(rowText(row))) break;
    parts.push(text);
  }
  return parts.join(" ");
}

function extractDateFromRow(row) {
  for (const value of row) {
    const date = normalizeDate(value);
    if (date) return date;
  }
  const text = rowText(row);
  const match = text.match(/[A-Z]+ \d{1,2}, \d{4}/i);
  return match ? normalizeDate(match[0]) : null;
}

function extractPeriodFromRow(row) {
  const dates = row.map(normalizeDate).filter(Boolean);
  if (dates.length >= 2) return { from: dates[0], to: dates[1] };
  const text = rowText(row);
  const matches = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
  const normalized = matches.map(normalizeDate).filter(Boolean);
  return { from: normalized[0] || null, to: normalized[1] || null };
}

function extractDepartments(row) {
  const text = rowText(row);
  const match = text.match(/\b(OI|OO|AI|AO|GE)(?:\s*,\s*(OI|OO|AI|AO|GE))*/i);
  if (!match) return [];
  return match[0].split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function isTransactionRow(row) {
  return Boolean(normalizeDate(row?.[0]) && /^PE/i.test(String(row?.[3] || "")) && /^PECDR/i.test(String(row?.[13] || "")));
}

function parseAgentTransactionRow(row, zeroBasedRow, departmentLabel) {
  return {
    sourceRow: zeroBasedRow + 1,
    date: normalizeDate(row[0]),
    ourRefNo: clean(row[3]),
    blNo: clean(row[9]),
    crdrNo: clean(row[13]),
    dr: toNumber(row[15]) ?? 0,
    cr: toNumber(row[17]) ?? 0,
    payment: toNumber(row[18]) ?? 0,
    balance: toNumber(row[19]) ?? 0,
    departmentLabel,
  };
}

function extractAgentTotal(row) {
  const recordCount = toNumber(row[12]) ?? findRecordCount(row);
  const dr = toNumber(row[15]) ?? 0;
  const cr = toNumber(row[17]) ?? 0;
  const payment = toNumber(row[18]) ?? 0;
  const balance = toNumber(row[19]) ?? 0;
  return { recordCount, dr, cr, payment, balance };
}

function findRecordCount(row) {
  const recordIndex = row.findIndex((value) => String(value || "").toLowerCase().includes("record"));
  if (recordIndex > 0) return toNumber(row[recordIndex - 1]);
  return null;
}

function extractDepartmentLabel(row) {
  const labels = ["AIR EXPORT", "AIR IMPORT", "OCEAN EXPORT", "OCEAN IMPORT", "GENERAL"];
  const text = rowText(row);
  return labels.find((label) => text.includes(label)) || null;
}

function extractCurrency(row) {
  for (const value of row) {
    const currency = normalizeCurrency(value);
    if (currency) return currency;
  }
  return null;
}

function inferCurrencyFromRows(rows) {
  for (const row of rows) {
    const currency = extractCurrency(row);
    if (currency) return currency;
  }
  return null;
}

function sumTransactions(transactions) {
  return {
    recordCount: transactions.length,
    dr: round(transactions.reduce((sum, item) => sum + item.dr, 0)),
    cr: round(transactions.reduce((sum, item) => sum + item.cr, 0)),
    payment: round(transactions.reduce((sum, item) => sum + item.payment, 0)),
    balance: round(transactions.reduce((sum, item) => sum + item.balance, 0)),
  };
}

function rowText(row) {
  return (row || []).map((value) => String(value ?? "").trim()).filter(Boolean).join(" ").toUpperCase();
}

function clean(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
