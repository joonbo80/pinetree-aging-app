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
  /**
   * Stable normalized key for navigating to /party/:partyKey.
   * Optional only for backward-compat with payloads predating Phase 2 v2.2 Step 12.
   * v2.2+ producers MUST populate this. UI falls back to deriving from
   * partyName when absent (legacy payload tolerance).
   */
  partyKey?: string;
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
 *
 * --- Schema versioning ---
 *
 * v1 payloads have schemaVersion "1.0" and no `details` field.
 * v2 payloads have schemaVersion "1.1" and MAY include `details`.
 *
 * `details` is optional so v1.x consumers keep working unchanged. v2.0 UI
 * gracefully degrades when `details` is absent (Dashboard cards are
 * non-clickable; a notice is shown instead).
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

  /**
   * v2 only. Drill-down detail block. See Phase 2 v2.0 spec §1.
   *
   * Present when schemaVersion is "1.1" or higher. Absent on v1.x payloads
   * — UI must check `result.details` before navigating to drill-down routes.
   */
  details?: ParsingPreviewDetails;
}

// ============================================================
// v2 detail types (Phase 2 v2.0 spec §1)
// ============================================================

/**
 * Drill-down detail block. UI uses this to render Review Queue rows,
 * Dashboard click-throughs, and Party Detail.
 *
 * Generated by `previewTransform.ts` from raw Phase 1 output. Phase 1
 * itself never sees these types — they are owned by the API/UI projection
 * layer (spec §8.1).
 */
export interface ParsingPreviewDetails {
  transactions: PreviewTransaction[];
  reviewItems: ReviewItem[];
  duplicateGroups: DuplicateGroupDetail[];
  statementLinks: StatementLink[];
}

/**
 * One per ERP row that contributes to a KPI. The unit of drill-down.
 *
 * `trace` is the bridge back to Excel. `rawRow` is intentionally excluded
 * here (spec §1.7) — if a UI later needs raw cell values, fetch via a
 * future `GET /api/upload-session/:id/row/:transactionId` endpoint.
 */
export interface PreviewTransaction {
  // Stable identity
  //
  // `id` is deterministic. It is primarily derived from sourceType +
  // sourceIdentityKey + sourceContentHash. sourceRow is appended only when
  // that base id collides inside the payload. Use this as the FK.
  //
  // `rawId` is the Phase 1 engine UUID for the row. It is non-deterministic
  // across re-parses (regenerated every run). Kept here only for round-trip
  // debugging / linking back to a single Phase 1 run output. NEVER use
  // rawId as a FK across runs or for v3 persistence.
  id: string;
  rawId: string;
  sourceType: 'INVOICE' | 'CRDR' | 'AP';

  // Party
  partyKey: string;                      // normalized for UI routing only (spec §8.2)
  partyName: string;                     // display name as appears in source
  department: string | null;             // 'OI' | 'OO' | 'AI' | 'AO' | 'GE' | null

  // Amount
  currency: 'USD' | 'CAD';
  rawBalance: number;                    // signed as in source
  signedBalance: number;                 // after AP-flip
  absoluteBalance: number;
  direction: 'receivable' | 'payable' | 'settled';
  isZeroBalance: boolean;

  // Dates (all YYYY-MM-DD or null — no time, no timezone, spec §8.4)
  invoiceDate: string | null;
  dueDate: string | null;                // display only
  postDate: string | null;               // for CRDR / AP
  agingBasisDate: string;                // the date used for aging
  agingDays: number;                     // as-of - agingBasisDate
  agingBucket: AgingBucket;              // baked in at parse time, single source of truth

  // Reference fields — these are NOT interchangeable.
  //
  // `ourRefNo`         Pinetree internal reference (PEIN###, PEAE###, etc.)
  //                    Present on INVOICE, CRDR, AP. Used by LOCAL statements.
  // `invoiceNo`        Customer-side invoice number (PEIN### on INVOICE rows;
  //                    different on Local Statement matches)
  // `crdrNo`           CR/DR document number (PECDR###). CRDR rows only.
  //                    Used by AGENT statements as their primary FK.
  // `blNo`             Bill of Lading. Logistics reference. Optional.
  // `vendorInvoiceNo`  Supplier-side invoice number. AP rows only.
  // `vendorName`       AP vendor name. Distinct from partyName.
  ourRefNo: string | null;
  invoiceNo: string | null;
  crdrNo: string | null;
  blNo: string | null;
  vendorInvoiceNo: string | null;
  vendorName: string | null;

  // Trace — the bridge back to Excel
  trace: TraceRef;

  // Flags this row triggered (W1, W2, W6, I1, I2, etc.)
  flags: string[];
}

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

/**
 * Reference back to the originating Excel row. The minimum needed to
 * point at "this row in this file" without shipping the entire raw row
 * data through the wire (spec §1.7).
 */
export interface TraceRef {
  sourceFile: string;                    // e.g. "1.INVOICE_JAN-APR 2026.xls"
  sourceSheet: string;                   // e.g. "Invoice List - Close Open"
  sourceRow: number;                     // 1-based, as seen in Excel
}

/**
 * One per row that needs human attention. Unifies all five Review Queue
 * entry points (spec §1.4).
 *
 * The same source row CAN appear in multiple ReviewItems (e.g. a 90+
 * aging row that's also a duplicate). UI must de-duplicate by
 * `transactionId` when crossing categories.
 */
export interface ReviewItem {
  id: string;
  category: ReviewCategory;
  severity: 'critical' | 'warning' | 'info';
  reason: string;                        // human-readable
  reasonCode: string;                    // machine-readable, e.g. "W1_DUPLICATE"
  transactionId: string | null;          // FK to PreviewTransaction.id when applicable
  // Party identity is split into TWO distinct fields. They are NOT
  // interchangeable. Composition layers must NEVER substitute one for
  // the other (v2.1.1 hotfix — silent partyName ← partyKey corruption
  // in statement-source items).
  //
  // partyKey   URL-safe routing key (kebab-case)         e.g. "win-yan-logistics"
  // partyName  Human-readable display name as in source  e.g. "WIN YAN LOGISTICS"
  partyKey: string | null;
  partyName: string | null;
  currency: 'USD' | 'CAD' | null;
  amount: number | null;
  trace: TraceRef | null;                // null for synthetic items (e.g. statement-only rows)
  details: Record<string, unknown>;      // category-specific extras
}

export type ReviewCategory =
  | 'WARNINGS'                           // W1 / W2 / W6 firings
  | 'AGING_90_PLUS'                      // direction != settled, agingBucket = '90+'
  | 'DUPLICATES'                         // members of duplicateGroups
  | 'NOT_IN_ERP_EXTRACT'                 // local statement rows with no ERP match
  | 'UNKNOWN_DEPARTMENT';                // department null/UNKNOWN

/**
 * Extended duplicate group with FK back to PreviewTransaction.
 *
 * Differs from the existing `duplicateReview.topGroups[]` summary in that
 * it carries `transactionIds[]` instead of `rows: string[]` so the UI can
 * link directly to the contributing transactions.
 */
export interface DuplicateGroupDetail {
  identityKey: string;                   // e.g. "AP|29422"
  currency: 'USD' | 'CAD';
  count: number;
  potentialSignedImpact: number;
  transactionIds: string[];              // FK to PreviewTransaction.id
}

/**
 * Bridges statement rows (Agent and Local) to ERP transactions.
 * Used by Party Detail (v2.2) and the NOT_IN_ERP_EXTRACT review category.
 *
 * AGENT statements use `crdrNo` as the primary reference (matches CRDR
 * transactions). LOCAL statements use `invoiceNo` / `ourRefNo` (matches
 * INVOICE transactions).
 *
 * `matchedTransactionId` is the deterministic PreviewTransaction.id of
 * the ERP row that best matches this statement row, or null if none.
 * The match is resolved using `candidateRows` (Phase 1 already computed
 * this) when available.
 */
export interface StatementLink {
  source: 'AGENT' | 'LOCAL';
  sourceFile: string;
  sourceRow: number;
  // partyKey   URL-safe routing key (kebab-case)
  // partyName  Human-readable display name as in source statement
  // The two are NEVER substitutable. (v2.1.1 hotfix — preserve display
  // name through the projection so statement-source ReviewItems show
  // human-readable names in UI and CSV exports.)
  partyKey: string;
  partyName: string;
  // For LOCAL: the statement's invoice number (left side of the match)
  // For AGENT: the statement's our-ref number (PEAE###)
  invoiceNo: string | null;
  ourRefNo: string | null;
  // For AGENT: the CR/DR document number (right side of the match,
  // matches CRDR transactions). null on LOCAL.
  crdrNo: string | null;
  currency: 'USD' | 'CAD';
  statementBalance: number;
  matchedTransactionId: string | null;   // FK or null when not matched
  matchType: StatementMatchType;
  referenceStatus?: string | null;       // raw Phase 1 status, preserved for broader filters
  differenceType?: string | null;        // raw Phase 1 difference type, preserved for broader filters
}

export type StatementMatchType =
  | 'EXACT_SIGNED'
  | 'BALANCE_DIFFERENCE'
  | 'OUTSIDE_DATE_RANGE'
  | 'CURRENCY_MISMATCH'
  | 'NO_REFERENCE'
  | 'NOT_IN_ERP_EXTRACT'
  | 'AS_OF_DATE_MISMATCH'
  | 'IDENTITY_MISMATCH'
  | 'SETTLED_AFTER_STATEMENT'
  | 'CHANGED_AFTER_STATEMENT';

/**
 * @deprecated Use ParsingPreviewResult. Kept as a type alias for one release
 * to minimize disruption to any external import that referenced the old name.
 * Will be removed in v1.3.
 */
export type ParseResult = ParsingPreviewResult;


// ============================================================
// v2.2 Party Detail (Phase 2 v2.2 spec)
// ============================================================

/**
 * Status badge for a party. Per spec D4 (frozen), only 3 states.
 * "Critical" tier intentionally NOT introduced — the 6 summary cards
 * carry the detail. Status is a binary "is anything wrong here at all"
 * signal plus a third "statement-only" outlier for parties without ERP
 * transactions.
 */
export type PartyStatus = 'Clean' | 'Has issues' | 'Statement only';

/**
 * Department resolution result per spec D3 (frozen).
 * If one department exceeds 60% of party transactions, `dominant` is
 * set. Otherwise `dominant` is null and `breakdown` carries the per-dept
 * counts so the UI can render "Mixed" with detail.
 */
export interface PartyDepartmentSummary {
  dominant: string | null;          // dept code if >= 60% share, else null
  breakdown: Array<{ department: string | null; count: number }>;
}

/**
 * Per-currency net balance. USD and CAD are NEVER summed (spec D5,
 * inherited from v1.1 LOCKED rule — never mix currencies).
 */
export interface PartyCurrencyTotal {
  currency: 'USD' | 'CAD';
  netBalance: number;               // sum of signedBalance for non-settled tx
  agingNinetyPlusCount: number;
}

/**
 * Six-card summary per spec §"Summary Cards".
 */
export interface PartySummaryCounts {
  totalTransactions: number;
  statementRows: number;
  erpMatched: number;               // statement links with matchedTransactionId !== null
  notInErpExtract: number;          // STRICT review items where category === NOT_IN_ERP_EXTRACT
                                    // (per user correction to draft — review-row based, not tx-based)
  duplicateFlags: number;           // duplicate groups touching this party
  warnings: number;                 // review items where category === WARNINGS
}

/**
 * The complete projection of `result.details` filtered by partyKey.
 * Pure function `selectPartyDetail(partyKey, result)` returns this.
 *
 * UI components render purely from this shape — no live re-filtering
 * during scroll or sort.
 *
 * For unknown partyKey, all four arrays are empty and `partyName` is
 * the humanized fallback. The UI uses this to render the "No data for
 * this party" empty state (spec §"Empty States").
 */
export interface PartyDetail {
  // Identity
  partyKey: string;
  partyName: string;                // resolved per spec §"Party Name Authority"
                                    // (tx majority -> statement -> review -> humanized key)
  partyNameVariants: string[];      // distinct variants seen across sources
                                    // (1+ in normal cases; UI may show as footnote)

  // Header
  department: PartyDepartmentSummary;
  status: PartyStatus;
  currencyTotals: PartyCurrencyTotal[];   // 0..2 entries; never summed across

  // Six summary card values
  summary: PartySummaryCounts;

  // Tab data — each is the full unfiltered set; UI applies its own
  // filter/sort state.
  transactions: PreviewTransaction[];
  statementLinks: StatementLink[];
  reviewItems: ReviewItem[];
  duplicateGroups: DuplicateGroupDetail[];
}

