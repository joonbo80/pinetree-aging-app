// parsing-engine/types.ts
// Phase 1 Spec v1.2.1 — type definitions imported by UI

export type SourceType =
  | 'INVOICE' | 'CRDR' | 'AP'
  | 'AGENT_STATEMENT' | 'LOCAL_STATEMENT'
  | 'PDF_METADATA' | 'UNKNOWN';

export type ClassificationRule =
  | 'sheet_name' | 'col1_pattern' | 'column_count'
  | 'ap_heuristic' | 'agent_heuristic' | 'local_heuristic'
  | 'body_text' | 'file_extension';

export interface ClassificationResult {
  file: string;
  detectedType: SourceType;
  confidence: number;
  rulesPassed: ClassificationRule[];
  sourceSheet: string;
  requiresUserSelection: boolean;
  isMetadataOnly?: boolean;
  error?: string;
}

export interface ReconciliationCurrency {
  count: number;
  source: number;
  parsed: number;
  diff: number;
}

export interface ReconciliationEntry {
  sourceRowCount: number;
  parsedRowCount: number;
  skippedRowCount: number;
  rejectedRowCount: number;
  sourceComputedTotal: number;
  parsedTotal: number;
  diff: number;
  match: boolean;
  currencies: Record<string, ReconciliationCurrency>;
}

export interface DirectionTotal {
  direction: 'receivable' | 'payable' | 'settled';
  currency: 'USD' | 'CAD';
  count: number;
  signedBalance: number;
  absoluteBalance: number;
}

export interface AgingBucketSummary {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  currency: 'USD' | 'CAD';
  count: number;
  absoluteBalance: number;
}

export interface DepartmentSummary {
  department: string;
  departmentLabel: string;
  currency: 'USD' | 'CAD';
  direction: 'receivable' | 'payable' | 'settled';
  count: number;
  absoluteBalance: number;
}

export interface TopPartySummary {
  partyName: string;
  currency: 'USD' | 'CAD';
  direction: 'receivable' | 'payable';
  count: number;
  absoluteBalance: number;
  maxAgingDays: number;
}

export interface ZeroBalanceBreakdown {
  totalCount: number;
  totalPercent: number;
  breakdown: { type: string; currency: string; count: number }[];
}

export interface ValidationItem {
  rule: string;
  message: string;
  count: number;
}

export interface ValidationReport {
  critical: ValidationItem[];
  warnings: ValidationItem[];
  info: ValidationItem[];
}

export interface DuplicateGroup {
  identityKey: string;
  currency: string;
  count: number;
  potentialSignedImpact: number;
  rows: string[];
}

export interface DuplicateReview {
  policy: string;
  groupCount: number;
  transactionCount: number;
  potentialSignedImpact: number;
  topGroups: DuplicateGroup[];
}

export interface AgentStatementMatch {
  statementCount: number;
  transactionRefCount: number;
  matchedCRDRRefs: number;
  unmatchedCRDRRefs: number;
  identityMismatches: number;
  currentBalanceDifferences: number;
  asOfDateMismatches: number;
  settledInErpAfterStatement: number;
  changedInErpAfterStatement: number;
  currencies: Record<string, number>;
}

export interface LocalStatementMatch {
  statementCount: number;
  transactionRefCount: number;
  reconciliationErrors: number;
  erpRefsFound: number;
  exactSignedBalanceMatches: number;
  balanceDifferences: number;
  outsideUploadedErpDateRange: number;
  sameRefDifferentCurrency: number;
  rowsWithoutReferenceNumber: number;
  notInUploadedErpExtract: number;
  uploadedErpDateRange: { from: string; to: string };
  currencies: Record<string, number>;
}

export interface StatementMatchReport {
  agent: AgentStatementMatch;
  local: LocalStatementMatch;
}

export interface ReviewCandidate {
  party: string;
  sourceFile: string;
  sourceRow: number;
  invoiceDate: string;
  ourRefNo: string;
  invoiceNo: string;
  currency: string;
  balance: number;
  differenceType: string;
}

/**
 * Result returned by the API's /api/parse-demo (and the future /api/parse-upload).
 *
 * IMPORTANT: This is a *preview* result, not the raw Phase 1 parser output.
 * The raw Phase 1 result contains full transactions[], statements[], rejectedRows[]
 * arrays which are intentionally NOT included here — Phase 2 v1.1 only needs
 * summary metrics for the Upload + Parsing Preview screen.
 *
 * The API server is responsible for converting raw Phase 1 output to this shape.
 * See docs/api-contract.md for the full contract.
 */
export interface ParsingPreviewResult {
  specVersion: string;
  schemaVersion: string;
  parserVersion: string;
  uploadSession: {
    importBatchId: string;
    timestamp: string;
    user: string;
    asOfDate: string;
    files: { name: string; type: string; recordCount: number; sizeBytes: number }[];
  };
  classificationReport: ClassificationResult[];
  reconciliationReport: Record<string, ReconciliationEntry>;
  directionTotals: DirectionTotal[];
  agingBuckets?: AgingBucketSummary[];
  departmentSummary?: DepartmentSummary[];
  topParties?: TopPartySummary[];
  zeroBalance: ZeroBalanceBreakdown;
  validationReport: ValidationReport;
  duplicateReview: DuplicateReview;
  skippedRows: { sourceType: string; reason: string; count: number }[];
  statementMatchReport: StatementMatchReport;
  reviewCandidates: { local: ReviewCandidate[] };
}

/**
 * @deprecated Use ParsingPreviewResult. Kept as a type alias for one release
 * to minimize disruption to any external import that referenced the old name.
 * Will be removed in v1.3.
 */
export type ParseResult = ParsingPreviewResult;
