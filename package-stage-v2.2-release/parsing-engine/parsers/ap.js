import { AgingBasis, SourceType } from "../types.js";
import { buildTransaction, isEmptyRow } from "./common.js";

export function parseApRow(row, context) {
  if (isEmptyRow(row)) {
    return {
      parseStatus: "skipped",
      reason: "empty_row",
      sourceFile: context.sourceFile,
      sourceSheet: context.sourceSheet,
      sourceType: SourceType.AP,
      sourceRow: context.rowIndex + 1,
      rawRow: row,
    };
  }

  const transaction = buildTransaction({
    sourceType: SourceType.AP,
    row,
    rowIndex: context.rowIndex,
    sourceFile: context.sourceFile,
    sourceSheet: context.sourceSheet,
    importBatchId: context.importBatchId,
    options: context.options,
    ids: {
      vendorInvoiceNo: row[8],
      blNo: row[14],
      ourRefNo: row[15],
      internalId: row[24],
    },
    party: { rawName: row[1], type: "local" },
    amounts: {
      grossAmount: row[4],
      paidAmount: row[5],
      rawBalance: row[7],
      currency: row[19],
    },
    dates: {
      transactionDate: row[0],
      postDate: row[2],
      dueDate: row[3],
      agingBaseDate: row[2],
      agingBasis: AgingBasis.POST_DATE,
    },
    departmentRaw: row[17],
    createdBy: row[20],
    extra: {
      paymentDate: row[6],
      costDescription: row[13] === undefined ? null : String(row[13] || "").trim() || null,
    },
  });

  if (transaction.rawBalance < 0) transaction.anomalyRefs.push("W6");
  return transaction;
}

export function parseApRows(rows, context) {
  return rows.map((row, rowIndex) => parseApRow(row, { ...context, rowIndex }));
}
