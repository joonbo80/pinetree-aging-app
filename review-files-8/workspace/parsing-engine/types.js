export const SPEC_VERSION = "1.3.0";
export const SCHEMA_VERSION = "1.0";
export const PARSER_VERSION = "1.3.0";

export const SourceType = Object.freeze({
  INVOICE: "INVOICE",
  CRDR: "CRDR",
  AP: "AP",
  AGENT_STATEMENT: "AGENT_STATEMENT",
  LOCAL_STATEMENT: "LOCAL_STATEMENT",
  PDF_METADATA: "PDF_METADATA",
  UNKNOWN: "UNKNOWN",
});

export const ParseStatus = Object.freeze({
  PARSED: "parsed",
  SKIPPED: "skipped",
  REJECTED: "rejected",
});

export const Direction = Object.freeze({
  RECEIVABLE: "receivable",
  PAYABLE: "payable",
  SETTLED: "settled",
});

export const AgingBasis = Object.freeze({
  INVOICE_DATE: "INVOICE_DATE",
  POST_DATE: "POST_DATE",
  STATEMENT_DATE: "STATEMENT_DATE",
});

export class ParseRowError extends Error {
  constructor(rule, message, details = {}) {
    super(message);
    this.name = "ParseRowError";
    this.rule = rule;
    this.details = details;
  }
}
