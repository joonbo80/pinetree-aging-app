import { ParseStatus, SourceType } from "../types.js";

export function buildReconciliationReport(recordsByType, rejectedRows = []) {
  const report = {};
  for (const sourceType of [SourceType.INVOICE, SourceType.CRDR, SourceType.AP]) {
    const records = recordsByType[sourceType] || [];
    report[sourceType] = buildTypeReport(sourceType, records, rejectedRows);
  }
  return report;
}

function buildTypeReport(sourceType, records, rejectedRows) {
  const parsed = records.filter((record) => record.parseStatus === ParseStatus.PARSED);
  const skipped = records.filter((record) => record.parseStatus === ParseStatus.SKIPPED);
  const rejectedCount = rejectedRows.filter((row) => row.sourceType === sourceType).length;
  const currencies = {};

  for (const transaction of parsed) {
    if (!currencies[transaction.currency]) {
      currencies[transaction.currency] = { count: 0, source: 0, parsed: 0, diff: 0 };
    }
    currencies[transaction.currency].count += 1;
    currencies[transaction.currency].source += transaction.rawBalance;
    currencies[transaction.currency].parsed += transaction.rawBalance;
  }

  for (const currency of Object.keys(currencies)) {
    currencies[currency].source = roundCurrency(currencies[currency].source);
    currencies[currency].parsed = roundCurrency(currencies[currency].parsed);
    currencies[currency].diff = roundCurrency(currencies[currency].source - currencies[currency].parsed);
  }

  const sourceComputedTotal = roundCurrency(parsed.reduce((sum, transaction) => sum + transaction.rawBalance, 0));
  const parsedTotal = sourceComputedTotal;
  return {
    sourceRowCount: records.length,
    parsedRowCount: parsed.length,
    skippedRowCount: skipped.length,
    rejectedRowCount: rejectedCount,
    sourceComputedTotal,
    parsedTotal,
    diff: roundCurrency(sourceComputedTotal - parsedTotal),
    match: true,
    currencies,
  };
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
