import { randomUUID } from "node:crypto";
import { classifyWorkbook } from "./classifier.js";
import { DEFAULT_DEPARTMENT_LABEL, DEFAULT_DEPARTMENT_MAP } from "./normalizers/department.js";
import { parseInvoiceRow } from "./parsers/invoice.js";
import { parseCrdrRow } from "./parsers/crdr.js";
import { parseApRow } from "./parsers/ap.js";
import { parseAgentStatementWorkbook } from "./parsers/agent_statement.js";
import { parseLocalStatementWorkbook } from "./parsers/local_statement.js";
import { ParseRowError, ParseStatus, SCHEMA_VERSION, PARSER_VERSION, SourceType, SPEC_VERSION } from "./types.js";
import { applyWarningRules } from "./validators/warning.js";
import { buildReconciliationReport } from "./validators/reconciliation.js";
import { buildValidationReport } from "./validators/report.js";
import { buildStatementMatchReport } from "./validators/statement_match.js";

export class ParsingEngine {
  constructor(options = {}) {
    if (!options.asOfDate) throw new Error("ParsingEngine requires asOfDate for reproducible aging results");
    if (options.agingBaseDateMode && !["auto", "source_default"].includes(options.agingBaseDateMode)) {
      throw new Error('agingBaseDateMode must be "auto" or "source_default"');
    }
    this.options = {
      aliasTable: [],
      validationLevel: "strict",
      departmentMap: DEFAULT_DEPARTMENT_MAP,
      departmentLabel: DEFAULT_DEPARTMENT_LABEL,
      agingBaseDateMode: "auto",
      ...options,
    };
  }

  classify(workbook) {
    return classifyWorkbook(workbook);
  }

  async preview(workbooks) {
    return this.process(workbooks, { preview: true });
  }

  async process(workbooks, { preview = false } = {}) {
    const importBatchId = randomUUID();
    const timestamp = new Date().toISOString();
    const classificationReport = workbooks.map((workbook) => this.classify(workbook));
    const transactions = [];
    const statements = [];
    const rejectedRows = [];
    const skippedRows = [];
    const recordsByType = { INVOICE: [], CRDR: [], AP: [] };

    for (let index = 0; index < workbooks.length; index += 1) {
      const workbook = workbooks[index];
      const classification = classificationReport[index];
      if (classification.detectedType === SourceType.UNKNOWN) continue;
      if (classification.detectedType === SourceType.PDF_METADATA) continue;
      if (classification.detectedType === SourceType.AGENT_STATEMENT) {
        statements.push(...parseAgentStatementWorkbook(workbook, { importBatchId, options: this.options }));
        continue;
      }
      if (classification.detectedType === SourceType.LOCAL_STATEMENT) {
        statements.push(...parseLocalStatementWorkbook(workbook, { importBatchId, options: this.options }));
        continue;
      }
      if (![SourceType.INVOICE, SourceType.CRDR, SourceType.AP].includes(classification.detectedType)) {
        statements.push(buildStatementPlaceholder(workbook, classification, importBatchId));
        continue;
      }

      const parsedRecords = this.parseWorkbookRows(workbook, classification.detectedType, importBatchId, rejectedRows);
      recordsByType[classification.detectedType].push(...parsedRecords);
      transactions.push(...parsedRecords.filter((record) => record.parseStatus === ParseStatus.PARSED));
      skippedRows.push(...parsedRecords.filter((record) => record.parseStatus === ParseStatus.SKIPPED));
    }

    applyWarningRules(transactions);

    return {
      specVersion: SPEC_VERSION,
      schemaVersion: SCHEMA_VERSION,
      parserVersion: PARSER_VERSION,
      uploadSession: {
        importBatchId,
        timestamp,
        user: this.options.user || null,
        asOfDate: this.options.asOfDate,
        preview,
        files: workbooks.map((workbook, index) => ({
          name: workbook.name,
          type: classificationReport[index].detectedType,
          recordCount: workbook.sheets?.[0]?.rows?.length || 0,
        })),
      },
      classificationReport,
      transactions,
      statements,
      reconciliationReport: buildReconciliationReport(recordsByType, rejectedRows),
      statementMatchReport: buildStatementMatchReport(statements, transactions),
      validationReport: buildValidationReport(transactions, rejectedRows),
      skippedRows,
      rejectedRows,
    };
  }

  parseWorkbookRows(workbook, sourceType, importBatchId, rejectedRows) {
    const sheet = workbook.sheets?.[0];
    if (!sheet) return [];
    const context = {
      sourceFile: workbook.name,
      sourceSheet: sheet.name,
      importBatchId,
      options: this.options,
    };

    const parser = parserFor(sourceType);
    return sheet.rows.map((row, rowIndex) => {
      try {
        return parser(row, { ...context, rowIndex });
      } catch (error) {
        const rejected = {
          sourceFile: workbook.name,
          sourceSheet: sheet.name,
          sourceType,
          sourceRow: rowIndex + 1,
          rule: error instanceof ParseRowError ? error.rule : "PARSE_ERROR",
          reason: error.message,
          rawRow: row,
          timestamp: new Date().toISOString(),
        };
        rejectedRows.push(rejected);
        return {
          parseStatus: ParseStatus.REJECTED,
          sourceFile: workbook.name,
          sourceSheet: sheet.name,
          sourceType,
          sourceRow: rowIndex + 1,
          rawRow: row,
        };
      }
    });
  }
}

function parserFor(sourceType) {
  if (sourceType === SourceType.INVOICE) return parseInvoiceRow;
  if (sourceType === SourceType.CRDR) return parseCrdrRow;
  if (sourceType === SourceType.AP) return parseApRow;
  throw new Error(`No parser for ${sourceType}`);
}

function buildStatementPlaceholder(workbook, classification, importBatchId) {
  return {
    id: randomUUID(),
    sourceType: classification.detectedType,
    sourceFile: workbook.name,
    importBatchId,
    parseStatus: "metadata_only",
    note: "Statement parsing will be expanded after ERP parser stabilization",
  };
}

export { classifyWorkbook } from "./classifier.js";
