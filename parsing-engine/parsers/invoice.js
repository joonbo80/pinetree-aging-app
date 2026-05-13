import { AgingBasis, SourceType } from "../types.js";
import { toNumber } from "../normalizers/balance.js";
import { buildTransaction, isEmptyRow } from "./common.js";

export function parseInvoiceRow(row, context) {
  if (isEmptyRow(row)) return skipped(row, context, "empty_row");
  const balance = toNumber(row[6]);
  if ((row[2] === null || row[2] === undefined || row[2] === "") && balance !== null && Math.abs(balance) < 0.005) {
    return skipped(row, context, "empty_customer_zero_balance");
  }

  const transaction = buildTransaction({
    sourceType: SourceType.INVOICE,
    row,
    rowIndex: context.rowIndex,
    sourceFile: context.sourceFile,
    sourceSheet: context.sourceSheet,
    importBatchId: context.importBatchId,
    options: context.options,
    ids: {
      invoiceNo: row[1],
      blNo: row[11],
      ourRefNo: row[12],
      internalId: row[25],
    },
    party: { rawName: row[2], type: "local" },
    amounts: {
      grossAmount: row[4],
      paidAmount: row[5],
      rawBalance: row[6],
      currency: row[18],
    },
    dates: {
      transactionDate: row[0],
      postDate: row[21],
      dueDate: row[10],
      agingBaseDate: row[0],
      agingBasis: AgingBasis.INVOICE_DATE,
    },
    departmentRaw: row[15],
    createdBy: row[20],
    extra: { quantity: toNumber(row[7]) },
  });

  if (transaction.rawBalance < 0) transaction.anomalyRefs.push("W4");
  if (transaction.paidAmount > transaction.grossAmount) transaction.anomalyRefs.push("W3");
  return transaction;
}

export function parseInvoiceRows(rows, context) {
  return rows.map((row, rowIndex) => parseInvoiceRow(row, { ...context, rowIndex }));
}

function skipped(row, context, reason) {
  return {
    parseStatus: "skipped",
    reason,
    sourceFile: context.sourceFile,
    sourceSheet: context.sourceSheet,
    sourceType: "INVOICE",
    sourceRow: context.rowIndex + 1,
    rawRow: row,
  };
}
