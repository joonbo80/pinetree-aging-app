import { AgingBasis, SourceType } from "../types.js";
import { buildTransaction, isEmptyRow } from "./common.js";

export function parseCrdrRow(row, context) {
  if (isEmptyRow(row)) {
    return {
      parseStatus: "skipped",
      reason: "empty_row",
      sourceFile: context.sourceFile,
      sourceSheet: context.sourceSheet,
      sourceType: SourceType.CRDR,
      sourceRow: context.rowIndex + 1,
      rawRow: row,
    };
  }

  return buildTransaction({
    sourceType: SourceType.CRDR,
    row,
    rowIndex: context.rowIndex,
    sourceFile: context.sourceFile,
    sourceSheet: context.sourceSheet,
    importBatchId: context.importBatchId,
    options: context.options,
    ids: {
      crdrNo: row[1],
      blNo: row[10],
      ourRefNo: row[11],
      internalId: row[18],
    },
    party: { rawName: row[2], type: "agent" },
    amounts: {
      grossAmount: row[7],
      paidAmount: row[8],
      rawBalance: row[9],
      drAmount: row[7],
      crAmount: row[8],
      currency: row[16],
    },
    dates: {
      transactionDate: row[0],
      postDate: row[4],
      dueDate: row[6],
      agingBaseDate: row[4],
      agingBasis: AgingBasis.POST_DATE,
    },
    departmentRaw: row[14],
    createdBy: row[17],
    extra: { serviceDate: row[5] },
  });
}

export function parseCrdrRows(rows, context) {
  return rows.map((row, rowIndex) => parseCrdrRow(row, { ...context, rowIndex }));
}
