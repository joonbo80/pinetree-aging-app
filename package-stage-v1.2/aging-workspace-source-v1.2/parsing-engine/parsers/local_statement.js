import { randomUUID } from "node:crypto";
import { Direction, SourceType } from "../types.js";
import { normalizeCompanyName } from "../normalizers/company_name.js";
import { normalizeCurrency } from "../normalizers/currency.js";
import { normalizeDate } from "../normalizers/date.js";
import { isZeroAmount, toNumber } from "../normalizers/balance.js";

export function parseLocalStatementWorkbook(workbook, context) {
  const sheet = workbook.sheets?.[0];
  if (!sheet) return [];
  const blocks = splitLocalBlocks(sheet.rows);
  return blocks.map((block, index) => parseLocalBlock(block, index, workbook, sheet, context)).filter(Boolean);
}

function splitLocalBlocks(rows) {
  const starts = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (!rowText(rows[i]).includes("LOCAL STATEMENT")) continue;
    const nextRowsText = rows
      .slice(i, i + 8)
      .map(rowText)
      .join(" ");
    if (/\bTO\s+:/.test(nextRowsText) || rows.slice(i, i + 8).some(isToRow)) starts.push(i);
  }
  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? rows.length,
    rows: rows.slice(start, starts[index + 1] ?? rows.length),
  }));
}

function parseLocalBlock(block, index, workbook, sheet, context) {
  const companyInfo = extractCompany(block.rows, context.options.aliasTable);
  if (!companyInfo.raw) return null;

  const statementDate = extractLabeledDate(block.rows, "STATEMENT DATE");
  const period = extractPeriod(block.rows);
  const departments = extractDepartments(block.rows);
  const reportType = extractLabeledValue(block.rows, "REPORT TYPE");
  const customerId = extractLabeledValue(block.rows, "CUSTOMER ID");
  const previousBalance = extractPreviousBalance(block.rows);
  const totals = extractLocalTotal(block.rows);
  const aging = extractAging(block.rows);
  const transactions = [];

  for (let i = 0; i < block.rows.length; i += 1) {
    const row = block.rows[i];
    if (!isLocalTransactionRow(row)) continue;
    transactions.push(parseLocalTransactionRow(row, block.start + i));
  }

  const computed = sumLocalTransactions(transactions, previousBalance?.balance ?? 0);
  const declaredTotal = totals?.balance ?? computed.balance;
  const declaredVsComputed = round(declaredTotal - computed.balance);

  return {
    id: randomUUID(),
    sourceType: SourceType.LOCAL_STATEMENT,
    sourceFile: workbook.name,
    sourceSheet: sheet.name,
    sourceStartRow: block.start + 1,
    sourceEndRow: block.end,
    importBatchId: context.importBatchId,
    blockIndex: index,
    partyName: companyInfo.normalized,
    partyNameRaw: companyInfo.raw,
    partyAddress: extractAddress(block.rows),
    customerId,
    reportType,
    statementDate,
    period,
    departments,
    currency: totals?.currency || previousBalance?.currency || transactions.find((item) => item.currency)?.currency || null,
    direction: directionFromBalance(declaredTotal),
    previousBalance,
    transactionRefs: transactions.map((transaction) => transaction.ourRefNo).filter(Boolean),
    transactions,
    aging,
    totals: {
      charge: round(totals?.charge ?? transactions.reduce((sum, item) => sum + item.charge, 0)),
      payment: round(totals?.payment ?? transactions.reduce((sum, item) => sum + item.payment, 0)),
      balance: round(declaredTotal),
      recordCount: transactions.length,
    },
    reconciliation: {
      declaredTotal: round(declaredTotal),
      sourceComputedTotal: round(computed.balance),
      parsedTotal: round(computed.balance),
      declaredVsComputed,
      computedVsParsed: 0,
      previousBalance: previousBalance?.balance ?? 0,
      recordCountParsed: transactions.length,
      match: Math.abs(declaredVsComputed) < 0.01,
    },
  };
}

function isToRow(row) {
  return String(row?.[1] || "").trim().toUpperCase() === "TO" && String(row?.[2] || "").trim() === ":";
}

function extractCompany(rows, aliasTable) {
  const row = rows.find(isToRow);
  if (!row) return { raw: "", normalized: "" };
  const company = normalizeCompanyName(row[3], aliasTable);
  return { raw: company.raw, normalized: company.normalized };
}

function extractAddress(rows) {
  const parts = [];
  let inAddress = false;
  for (const row of rows) {
    if (isToRow(row)) {
      inAddress = true;
      continue;
    }
    if (!inAddress) continue;
    const text = String(row?.[3] || "").trim();
    if (!text) continue;
    if (/TEL\s*:|STATEMENT DATE|STATEMENT PERIOD|DATE TYPE|CUSTOMER ID|DEPARTMENTS/i.test(rowText(row))) break;
    parts.push(text);
  }
  return parts.join(" ");
}

function extractLabeledDate(rows, label) {
  const value = extractLabeledValue(rows, label);
  return normalizeDate(value);
}

function extractLabeledValue(rows, label) {
  for (const row of rows) {
    const labelIndex = row.findIndex((cell) => String(cell || "").trim().toUpperCase() === label);
    if (labelIndex < 0) continue;
    for (let i = labelIndex + 1; i < row.length; i += 1) {
      const value = String(row[i] ?? "").trim();
      if (value && value !== ":") return value;
    }
  }
  return null;
}

function extractPeriod(rows) {
  const value = extractLabeledValue(rows, "STATEMENT PERIOD");
  if (!value) return { from: null, to: null };
  const matches = String(value).match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
  return { from: normalizeDate(matches[0]) || null, to: normalizeDate(matches[1]) || null };
}

function extractDepartments(rows) {
  const value = extractLabeledValue(rows, "DEPARTMENTS") || "";
  const match = String(value).match(/\b(OI|OO|AI|AO|GE)(?:\s*,\s*(OI|OO|AI|AO|GE))*/i);
  if (!match) return [];
  return match[0].split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function extractPreviousBalance(rows) {
  const row = rows.find((candidate) => rowText(candidate).includes("PREVIOUS BALANCE"));
  if (!row) return null;
  const amount = lastNumber(row);
  return {
    currency: findCurrency(row),
    balance: round(amount ?? 0),
  };
}

function extractLocalTotal(rows) {
  const totalRows = rows.filter((row) => row.some((cell) => String(cell || "").trim().toUpperCase() === "TOTAL"));
  const row = totalRows.at(-1);
  if (!row) return null;
  const currency = findCurrency(row);
  const amounts = numbersAfterCurrency(row);
  return {
    currency,
    charge: round(amounts[0] ?? 0),
    payment: round(amounts.length > 2 ? amounts[amounts.length - 2] : 0),
    balance: round(amounts.at(-1) ?? 0),
  };
}

function extractAging(rows) {
  const totalBalanceIndex = rows.findIndex((row) => rowText(row).includes("TOTAL BALANCE"));
  if (totalBalanceIndex < 0) return null;
  const amountRow = rows.slice(totalBalanceIndex, totalBalanceIndex + 5).find((row) => row.filter((cell) => toNumber(cell) !== null).length >= 4);
  if (!amountRow) return null;
  return {
    current: toNumber(amountRow[3]) ?? 0,
    days1To30: toNumber(amountRow[7]) ?? 0,
    days31To60: toNumber(amountRow[10]) ?? 0,
    days61To90: toNumber(amountRow[12]) ?? toNumber(amountRow[13]) ?? 0,
    days90Plus: toNumber(amountRow[15]) ?? toNumber(amountRow[17]) ?? 0,
    totalBalance: lastNumber(amountRow) ?? 0,
  };
}

function isLocalTransactionRow(row) {
  return Boolean(normalizeDate(row?.[0]) && findCurrency(row) && (clean(row?.[6]) || clean(row?.[10]) || clean(row?.[12])));
}

function parseLocalTransactionRow(row, zeroBasedRow) {
  const currency = findCurrency(row);
  const amounts = numbersAfterCurrency(row);
  const balance = amounts.at(-1) ?? 0;
  return {
    sourceRow: zeroBasedRow + 1,
    invoiceDate: normalizeDate(row[0]),
    dueDate: normalizeDate(row[0]),
    etd: normalizeDate(row[3]),
    ourRefNo: clean(row[6]) || (/^PE/i.test(String(row[10] || "")) ? clean(row[10]) : null),
    blNo: /^PE/i.test(String(row[10] || "")) ? null : clean(row[10]) || clean(row[9]),
    invoiceNo: clean(row[12]),
    currency,
    charge: round(amounts[0] ?? 0),
    payment: round(amounts.length > 2 ? amounts[amounts.length - 2] : 0),
    balance: round(balance),
    direction: directionFromBalance(balance),
  };
}

function sumLocalTransactions(transactions, previousBalance) {
  return {
    charge: round(transactions.reduce((sum, item) => sum + item.charge, 0)),
    payment: round(transactions.reduce((sum, item) => sum + item.payment, 0)),
    balance: round(previousBalance + transactions.reduce((sum, item) => sum + item.balance, 0)),
  };
}

function directionFromBalance(balance) {
  if (isZeroAmount(balance)) return Direction.SETTLED;
  return balance > 0 ? Direction.RECEIVABLE : Direction.PAYABLE;
}

function findCurrency(row) {
  for (const cell of row || []) {
    const currency = normalizeCurrency(cell);
    if (currency) return currency;
  }
  return null;
}

function numbersAfterCurrency(row) {
  const currencyIndex = (row || []).findIndex((cell) => normalizeCurrency(cell));
  if (currencyIndex < 0) return [];
  return row.slice(currencyIndex + 1).map(toNumber).filter((value) => value !== null);
}

function lastNumber(row) {
  const values = (row || []).map(toNumber).filter((value) => value !== null);
  return values.length ? values.at(-1) : null;
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
