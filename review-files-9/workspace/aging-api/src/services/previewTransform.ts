import { partyKey } from '../utils/partyKey.js';

type RawResult = Record<string, any>;

function countAnomaly(entry: any): number {
  if (typeof entry?.count === 'number') return entry.count;
  if (Array.isArray(entry?.affectedTransactions)) return entry.affectedTransactions.length;
  return 1;
}

function summarizeValidation(report: any) {
  return {
    critical: (report?.critical ?? []).map((entry: any) => ({
      rule: entry.rule ?? 'CRITICAL',
      message: entry.message ?? entry.reason ?? 'Critical validation issue',
      count: countAnomaly(entry),
    })),
    warnings: (report?.warnings ?? []).map((entry: any) => ({
      rule: entry.rule ?? 'WARNING',
      message: entry.message ?? 'Validation warning',
      count: countAnomaly(entry),
    })),
    info: (report?.info ?? []).map((entry: any) => ({
      rule: entry.rule ?? 'INFO',
      message: entry.message ?? 'Validation info',
      count: countAnomaly(entry),
    })),
  };
}

function buildDirectionTotals(transactions: any[]) {
  const map = new Map<string, { direction: string; currency: string; count: number; signedBalance: number; absoluteBalance: number }>();
  for (const tx of transactions) {
    const direction = tx.direction ?? 'unknown';
    const currency = tx.currency ?? 'UNKNOWN';
    const key = `${direction}|${currency}`;
    const item = map.get(key) ?? { direction, currency, count: 0, signedBalance: 0, absoluteBalance: 0 };
    item.count += 1;
    item.signedBalance += Number(tx.signedBalance ?? tx.balance ?? 0);
    item.absoluteBalance += Number(tx.absoluteBalance ?? Math.abs(Number(tx.signedBalance ?? tx.balance ?? 0)));
    map.set(key, item);
  }
  return [...map.values()].map(item => ({
    ...item,
    signedBalance: round2(item.signedBalance),
    absoluteBalance: round2(item.absoluteBalance),
  }));
}

function buildZeroBalance(transactions: any[]) {
  const byTypeCurrency = new Map<string, { sourceType: string; currency: string; count: number }>();
  let count = 0;
  for (const tx of transactions) {
    if (!tx.isZeroBalance) continue;
    count += 1;
    const sourceType = tx.sourceType ?? 'UNKNOWN';
    const currency = tx.currency ?? 'UNKNOWN';
    const key = `${sourceType}|${currency}`;
    const item = byTypeCurrency.get(key) ?? { sourceType, currency, count: 0 };
    item.count += 1;
    byTypeCurrency.set(key, item);
  }
  return {
    totalCount: count,
    totalPercent: transactions.length ? round2((count / transactions.length) * 100) : 0,
    breakdown: [...byTypeCurrency.values()].map(row => ({
      type: row.sourceType,
      currency: row.currency,
      count: row.count,
    })),
  };
}

function buildAgingBuckets(transactions: any[]) {
  const map = new Map<string, { bucket: string; currency: string; count: number; absoluteBalance: number }>();
  for (const tx of transactions) {
    if (tx.direction === 'settled') continue;
    const bucket = tx.agingBucket ?? '0-30';
    const currency = tx.currency ?? 'UNKNOWN';
    const key = `${bucket}|${currency}`;
    const item = map.get(key) ?? { bucket, currency, count: 0, absoluteBalance: 0 };
    item.count += 1;
    item.absoluteBalance += Number(tx.absoluteBalance ?? Math.abs(Number(tx.signedBalance ?? tx.balance ?? 0)));
    map.set(key, item);
  }
  return [...map.values()].map(item => ({
    ...item,
    absoluteBalance: round2(item.absoluteBalance),
  }));
}

function buildDepartmentSummary(transactions: any[]) {
  const map = new Map<string, {
    department: string;
    departmentLabel: string;
    currency: string;
    direction: string;
    count: number;
    absoluteBalance: number;
  }>();

  for (const tx of transactions) {
    if (tx.direction === 'settled') continue;
    const department = tx.department ?? 'UNKNOWN';
    const departmentLabel = tx.departmentLabel ?? department;
    const currency = tx.currency ?? 'UNKNOWN';
    const direction = tx.direction ?? 'unknown';
    const key = `${department}|${currency}|${direction}`;
    const item = map.get(key) ?? { department, departmentLabel, currency, direction, count: 0, absoluteBalance: 0 };
    item.count += 1;
    item.absoluteBalance += Number(tx.absoluteBalance ?? Math.abs(Number(tx.signedBalance ?? tx.balance ?? 0)));
    map.set(key, item);
  }

  return [...map.values()].map(item => ({
    ...item,
    absoluteBalance: round2(item.absoluteBalance),
  }));
}

function buildTopParties(transactions: any[]) {
  const map = new Map<string, {
    partyName: string;
    currency: string;
    direction: string;
    count: number;
    absoluteBalance: number;
    maxAgingDays: number;
  }>();

  for (const tx of transactions) {
    if (tx.direction === 'settled') continue;
    if (tx.direction !== 'receivable' && tx.direction !== 'payable') continue;
    const partyName = tx.partyName ?? 'UNKNOWN';
    const currency = tx.currency ?? 'UNKNOWN';
    const direction = tx.direction;
    const key = `${partyName}|${currency}|${direction}`;
    const item = map.get(key) ?? { partyName, currency, direction, count: 0, absoluteBalance: 0, maxAgingDays: 0 };
    item.count += 1;
    item.absoluteBalance += Number(tx.absoluteBalance ?? Math.abs(Number(tx.signedBalance ?? tx.balance ?? 0)));
    item.maxAgingDays = Math.max(item.maxAgingDays, Number(tx.agingDays ?? 0));
    map.set(key, item);
  }

  return [...map.values()]
    .map(item => ({ ...item, absoluteBalance: round2(item.absoluteBalance) }))
    .sort((a, b) => b.absoluteBalance - a.absoluteBalance)
    .slice(0, 12);
}

function buildDuplicateReview(transactions: any[]) {
  const groups = new Map<string, any[]>();
  for (const tx of transactions) {
    if (!Array.isArray(tx.anomalyRefs) || !tx.anomalyRefs.includes('W1')) continue;
    const key = `${tx.sourceIdentityKey ?? tx.sourceFingerprint}|${tx.sourceContentHash ?? ''}`;
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, rows]) => rows.length > 1 && rows.some(row => !row.isZeroBalance))
    .map(([identityKey, rows]) => {
      const potentialSignedImpact = rows.slice(1).reduce((sum, tx) => sum + Number(tx.signedBalance ?? 0), 0);
      return {
        identityKey,
        currency: rows[0]?.currency ?? 'UNKNOWN',
        count: rows.length,
        potentialSignedImpact: round2(potentialSignedImpact),
        rows: rows.map(tx => `${tx.sourceType}:${tx.sourceRow}`),
      };
    })
    .sort((a, b) => Math.abs(b.potentialSignedImpact) - Math.abs(a.potentialSignedImpact));

  return {
    policy: 'Phase 1 keeps exact duplicates in parsed totals and flags them for user review only. No automatic exclusion is applied.',
    groupCount: duplicateGroups.length,
    transactionCount: duplicateGroups.reduce((sum, group) => sum + group.count, 0),
    potentialSignedImpact: round2(duplicateGroups.reduce((sum, group) => sum + group.potentialSignedImpact, 0)),
    topGroups: duplicateGroups.slice(0, 10),
  };
}

function summarizeSkippedRows(skippedRows: any[]) {
  const map = new Map<string, { sourceType: string; reason: string; count: number }>();
  for (const row of skippedRows ?? []) {
    const sourceType = row.sourceType ?? 'UNKNOWN';
    const reason = row.skipReason ?? row.reason ?? 'SKIPPED';
    const key = `${sourceType}|${reason}`;
    const item = map.get(key) ?? { sourceType, reason, count: 0 };
    item.count += 1;
    map.set(key, item);
  }
  return [...map.values()];
}

function summarizeStatementMatch(report: any) {
  const agent = report?.agent ?? {};
  const local = report?.local ?? {};
  return {
    agent: {
      statementCount: agent.statementCount ?? 0,
      transactionRefCount: agent.transactionRefCount ?? 0,
      matchedCRDRRefs: agent.matchedCRDRRefs ?? agent.matchedRefCount ?? 0,
      unmatchedCRDRRefs: agent.unmatchedCRDRRefs ?? agent.unmatchedRefCount ?? 0,
      identityMismatches: agent.identityMismatches ?? agent.identityMismatchCount ?? 0,
      currentBalanceDifferences: agent.currentBalanceDifferences ?? agent.currentBalanceDiffCount ?? 0,
      asOfDateMismatches: agent.asOfDateMismatches ?? agent.asOfDateMismatchCount ?? 0,
      settledInErpAfterStatement: agent.settledInErpAfterStatement ?? agent.settledInErpCount ?? 0,
      changedInErpAfterStatement: agent.changedInErpAfterStatement ?? agent.changedInErpCount ?? 0,
      currencies: agent.currencies ?? {},
    },
    local: {
      statementCount: local.statementCount ?? 0,
      transactionRefCount: local.transactionRefCount ?? 0,
      reconciliationErrors: local.reconciliationErrors ?? countLocalReconciliationErrors(local.statements ?? []),
      erpRefsFound: local.erpRefsFound ?? local.refFoundCount ?? 0,
      exactSignedBalanceMatches: local.exactSignedBalanceMatches ?? local.exactSignedBalanceMatchCount ?? 0,
      balanceDifferences: local.balanceDifferences ?? local.refFoundBalanceDiffCount ?? 0,
      outsideUploadedErpDateRange: local.outsideUploadedErpDateRange ?? local.outsideUploadedErpDateRangeCount ?? 0,
      sameRefDifferentCurrency: local.sameRefDifferentCurrency ?? local.sameRefDifferentCurrencyCount ?? 0,
      rowsWithoutReferenceNumber: local.rowsWithoutReferenceNumber ?? local.rowsWithoutRef ?? local.noReferenceNumberCount ?? 0,
      notInUploadedErpExtract: local.notInUploadedErpExtract ?? local.notInUploadedErpExtractCount ?? 0,
      uploadedErpDateRange: local.uploadedErpDateRange ?? local.erpDateRange ?? { from: '', to: '' },
      currencies: local.currencies ?? countStatementCurrencies(local.statements ?? []),
    },
  };
}

function buildLocalReviewCandidates(localReport: any) {
  const out: any[] = [];
  for (const statement of localReport?.statements ?? []) {
    for (const match of statement.matches ?? []) {
      if (match.differenceType !== 'NOT_IN_UPLOADED_ERP_EXTRACT') continue;
      out.push({
        party: statement.partyName,
        sourceFile: statement.sourceFile,
        sourceRow: match.statementRow,
        invoiceDate: match.invoiceDate,
        ourRefNo: match.ourRefNo,
        invoiceNo: match.invoiceNo,
        currency: match.currency,
        balance: match.statementBalance,
        differenceType: match.differenceType,
      });
    }
  }
  return out;
}

function countLocalReconciliationErrors(statements: any[]) {
  return statements.filter(statement => statement.reconciliation && !statement.reconciliation.match).length;
}

function countStatementCurrencies(statements: any[]) {
  return statements.reduce((acc, statement) => {
    const currency = statement.currency ?? 'UNKNOWN';
    acc[currency] = (acc[currency] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ============================================================
// v2 detail builders (Phase 2 v2.0 spec §1)
// ============================================================

/**
 * Build a deterministic, stable PreviewTransaction.id.
 *
 * Same input row always produces the same id. Survives re-parses;
 * survives the user renaming the source Excel file before re-uploading
 * (reviewer rev2 P1 #4).
 *
 * Format: `<sourceType>:<sourceIdentityKey>:<sourceContentHash>:<sourceRow>`
 *
 * Why each part is included:
 *  - sourceType:        distinguishes INVOICE vs CRDR vs AP
 *  - sourceIdentityKey: Phase 1's primary identity (e.g. "INVOICE|17355")
 *                       — survives file rename, survives row reorder
 *  - sourceContentHash: distinguishes "the row I had yesterday" from
 *                       "the row I have today after editing"
 *  - sourceRow:         disambiguates true duplicate rows that share
 *                       identityKey AND contentHash. Without this, the
 *                       80 W1-flagged duplicate transactions would
 *                       collide. Position-based, but only as the LAST
 *                       disambiguator.
 *
 * sourceFile is intentionally NOT in the id — only in trace. Renaming
 * `1.INVOICE_JAN-APR 2026.xls` to `INVOICE_2026Q1.xls` should not
 * invalidate v3 persistence references.
 *
 * Fallback: if sourceContentHash is missing on the raw row, we hash
 * (sourceType, sourceIdentityKey, sourceRow) deterministically.
 */
function deterministicId(tx: any): string {
  const sourceType = String(tx.sourceType ?? 'UNKNOWN');
  const sourceIdentityKey = String(tx.sourceIdentityKey ?? '');
  const sourceRow = Number(tx.sourceRow ?? 0);
  let hashShort = String(tx.sourceContentHash ?? '').slice(0, 12);
  if (!hashShort) {
    const probe = `${sourceType}|${sourceIdentityKey}|${sourceRow}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < probe.length; i++) {
      h ^= probe.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hashShort = h.toString(16).padStart(8, '0');
  }
  return `${sourceType}:${sourceIdentityKey}:${hashShort}:${sourceRow}`;
}

/**
 * Coerce any incoming date-like value to YYYY-MM-DD or null.
 * Spec §8.4: no time, no timezone.
 */
function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const s = String(value);
  // Already YYYY-MM-DD or longer ISO — take first 10 chars
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Fall back: try Date parsing
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Use UTC slice to avoid timezone drift
  return d.toISOString().slice(0, 10);
}

function bucketLabel(b: string): '0-30' | '31-60' | '61-90' | '90+' {
  // Phase 1 already emits these strings; just narrow the type.
  if (b === '0-30' || b === '31-60' || b === '61-90' || b === '90+') return b;
  return '0-30';
}

function toCurrency(value: unknown): 'USD' | 'CAD' {
  return value === 'CAD' ? 'CAD' : 'USD';
}

function toDirection(value: unknown): 'receivable' | 'payable' | 'settled' {
  if (value === 'payable' || value === 'settled') return value;
  return 'receivable';
}

function toSourceType(value: unknown): 'INVOICE' | 'CRDR' | 'AP' {
  if (value === 'CRDR' || value === 'AP') return value;
  return 'INVOICE';
}

/**
 * Project a raw Phase 1 transaction to a PreviewTransaction.
 * `rawRow` is intentionally NOT carried over (spec §1.7).
 */
function toPreviewTransaction(tx: any) {
  const partyDisplay = String(tx.partyName ?? tx.partyNameRaw ?? '');
  return {
    id: deterministicId(tx),
    rawId: String(tx.id ?? ''),
    sourceType: toSourceType(tx.sourceType),

    partyKey: partyKey(partyDisplay),
    partyName: partyDisplay,
    department: tx.department ?? null,

    currency: toCurrency(tx.currency),
    rawBalance: Number(tx.rawBalance ?? 0),
    signedBalance: Number(tx.signedBalance ?? 0),
    absoluteBalance: Number(tx.absoluteBalance ?? Math.abs(Number(tx.signedBalance ?? 0))),
    direction: toDirection(tx.direction),
    isZeroBalance: Boolean(tx.isZeroBalance),

    invoiceDate: toIsoDate(tx.transactionDate),
    dueDate: toIsoDate(tx.dueDate),
    postDate: toIsoDate(tx.postDate),
    agingBasisDate: toIsoDate(tx.agingBaseDate) ?? toIsoDate(tx.transactionDate) ?? '',
    agingDays: Number(tx.agingDays ?? 0),
    agingBucket: bucketLabel(String(tx.agingBucket ?? '0-30')),

    // Reference fields, kept distinct (no overloading)
    ourRefNo: tx.ourRefNo ?? null,
    invoiceNo: tx.invoiceNo ?? null,
    crdrNo: tx.crdrNo ?? null,
    blNo: tx.blNo ?? null,
    vendorInvoiceNo: tx.vendorInvoiceNo ?? null,
    vendorName: tx.vendorName ?? null,

    trace: {
      sourceFile: String(tx.sourceFile ?? ''),
      sourceSheet: String(tx.sourceSheet ?? ''),
      sourceRow: Number(tx.sourceRow ?? 0),
    },

    flags: Array.isArray(tx.anomalyRefs) ? tx.anomalyRefs.map(String) : [],
  };
}

function buildPreviewTransactions(rawTransactions: any[]) {
  return rawTransactions.map(toPreviewTransaction);
}

/**
 * Quick-lookup index for transactions. Indexed by BOTH:
 *   - deterministic `id`   (for FK in v2 payload)
 *   - `rawId`              (for resolving Phase-1 references that use the UUID)
 *
 * Validation report's `affectedTransactions: string[]` and duplicate
 * groups internally reference the Phase 1 UUID. We translate those to
 * deterministic IDs through this index.
 */
function indexById(previewTransactions: ReturnType<typeof buildPreviewTransactions>) {
  const map = new Map<string, ReturnType<typeof buildPreviewTransactions>[number]>();
  for (const t of previewTransactions) {
    map.set(t.id, t);
    if (t.rawId) map.set(t.rawId, t);
  }
  return map;
}

/**
 * Builds the unified ReviewItem[] across all 5 categories.
 * One transaction can appear in multiple categories — that's fine, UI
 * de-duplicates by transactionId at render time.
 */
function buildReviewItems(
  rawValidationReport: any,
  previewTransactions: ReturnType<typeof buildPreviewTransactions>,
  duplicateGroups: ReturnType<typeof buildDuplicateGroupDetails>,
  statementLinks: ReturnType<typeof buildStatementLinks>,
  strictNotInErpRowSet: Set<string>,
) {
  const byId = indexById(previewTransactions);
  const items: any[] = [];
  let nextId = 1;

  const addFromTx = (
    tx: ReturnType<typeof buildPreviewTransactions>[number],
    category: string,
    severity: 'critical' | 'warning' | 'info',
    reason: string,
    reasonCode: string,
    extra: Record<string, unknown> = {},
  ) => {
    items.push({
      id: `R-${String(nextId++).padStart(5, '0')}`,
      category,
      severity,
      reason,
      reasonCode,
      transactionId: tx.id,
      partyKey: tx.partyKey,
      currency: tx.currency,
      amount: tx.signedBalance,
      trace: tx.trace,
      details: extra,
    });
  };

  // --- WARNINGS (W1, W2, W6, plus any other warnings) ---
  for (const w of rawValidationReport?.warnings ?? []) {
    const rule = String(w.rule ?? 'WARNING');
    const reasonCode = `${rule}_${rule === 'W1' ? 'DUPLICATE' : rule === 'W2' ? 'USD_AND_CAD' : rule === 'W6' ? 'AP_NEGATIVE' : 'WARNING'}`;
    const message = String(w.message ?? rule);

    // Three known shapes Phase 1 emits:
    //   - affectedTransactions: string[]  (W1, W6, others)
    //   - affectedCompanies: object[]     (W2 — per company group)
    if (Array.isArray(w.affectedTransactions)) {
      for (const txId of w.affectedTransactions) {
        const tx = byId.get(String(txId));
        if (tx) addFromTx(tx, 'WARNINGS', 'warning', message, reasonCode);
      }
    } else if (Array.isArray(w.affectedCompanies)) {
      // W2: companies with both USD and CAD. We can't link to a single tx;
      // emit a synthetic ReviewItem per company instead.
      for (const c of w.affectedCompanies) {
        items.push({
          id: `R-${String(nextId++).padStart(5, '0')}`,
          category: 'WARNINGS',
          severity: 'warning',
          reason: `${message}: ${c.partyName ?? c.party ?? 'unknown'}`,
          reasonCode,
          transactionId: null,
          partyKey: partyKey(c.partyName ?? c.party ?? ''),
          currency: null,
          amount: null,
          trace: null,
          details: {
            affectedCompany: c,
          },
        });
      }
    }
  }

  // --- AGING_90_PLUS (direction != settled, agingBucket = '90+') ---
  for (const tx of previewTransactions) {
    if (tx.agingBucket === '90+' && tx.direction !== 'settled') {
      addFromTx(
        tx,
        'AGING_90_PLUS',
        'warning',
        `Aging ${tx.agingDays} days (${tx.agingBucket})`,
        'AGING_90_PLUS',
        { agingDays: tx.agingDays },
      );
    }
  }

  // --- DUPLICATES (members of duplicate groups) ---
  for (const group of duplicateGroups) {
    for (const txId of group.transactionIds) {
      const tx = byId.get(txId);
      if (tx) {
        addFromTx(
          tx,
          'DUPLICATES',
          'warning',
          `Duplicate of ${group.identityKey} (group of ${group.count})`,
          'W1_DUPLICATE',
          {
            identityKey: group.identityKey,
            groupSize: group.count,
            potentialSignedImpact: group.potentialSignedImpact,
          },
        );
      }
    }
  }

  // --- NOT_IN_ERP_EXTRACT (strict — Dashboard "Not in ERP: 7" matches this) ---
  //
  // We use the STRICT classification (differenceType === 'NOT_IN_UPLOADED_ERP_EXTRACT')
  // so the count agrees with the Dashboard summary card and with v1's
  // reviewCandidates.local. The broader 95-row population (any
  // referenceStatus 'not_in_uploaded_erp_extract' regardless of other
  // categorization) is still available through `details.statementLinks`
  // for any future broader filter view.
  // Reviewer rev2 P1 #3.
  for (const link of statementLinks) {
    if (link.matchType !== 'NOT_IN_ERP_EXTRACT') continue;
    // Find the underlying raw match to read differenceType. Easiest: re-scan
    // the raw report. But statementLinks doesn't carry the raw value, so
    // the cleanest approach is to filter at link-build time. We approximate
    // by checking the link is one of the 7 strict cases via a separate set.
    if (!strictNotInErpRowSet.has(`${link.sourceFile}|${link.sourceRow}`)) continue;
    items.push({
      id: `R-${String(nextId++).padStart(5, '0')}`,
      category: 'NOT_IN_ERP_EXTRACT',
      severity: 'warning',
      reason: `Local statement ref ${link.invoiceNo ?? link.ourRefNo ?? '(no ref)'} not found in ERP extract`,
      reasonCode: 'NOT_IN_ERP_EXTRACT',
      transactionId: null,
      partyKey: link.partyKey,
      currency: link.currency,
      amount: link.statementBalance,
      trace: {
        sourceFile: link.sourceFile,
        sourceSheet: '',
        sourceRow: link.sourceRow,
      },
      details: {
        source: link.source,
        ourRefNo: link.ourRefNo,
        invoiceNo: link.invoiceNo,
      },
    });
  }

  // --- UNKNOWN_DEPARTMENT ---
  for (const tx of previewTransactions) {
    if (tx.department === null || tx.department === 'UNKNOWN') {
      addFromTx(
        tx,
        'UNKNOWN_DEPARTMENT',
        'info',
        'Department could not be classified',
        'UNKNOWN_DEPARTMENT',
        { rawDepartment: null },
      );
    }
  }

  return items;
}

/**
 * Like the existing buildDuplicateReview() summary, but emits group
 * detail with FK arrays back to PreviewTransaction.id.
 *
 * Uses the same identity logic as buildDuplicateReview so summary and
 * detail counts agree:
 *   - only transactions with W1 anomaly flag
 *   - identity = sourceIdentityKey + sourceContentHash
 *   - drop groups < 2 OR all-zero-balance
 */
function buildDuplicateGroupDetails(rawTransactions: any[]) {
  const groups = new Map<string, { identityKey: string; currency: 'USD' | 'CAD'; transactionIds: string[]; signedImpacts: number[]; zeroFlags: boolean[] }>();

  for (const tx of rawTransactions) {
    if (!Array.isArray(tx.anomalyRefs) || !tx.anomalyRefs.includes('W1')) continue;
    const key: string = `${tx.sourceIdentityKey ?? tx.sourceFingerprint ?? ''}|${tx.sourceContentHash ?? ''}`;
    if (!key) continue;
    const group: { identityKey: string; currency: 'USD' | 'CAD'; transactionIds: string[]; signedImpacts: number[]; zeroFlags: boolean[] } =
      groups.get(key) ?? {
        identityKey: tx.sourceIdentityKey ?? key,  // expose readable key, not the hash combo
        currency: toCurrency(tx.currency),
        transactionIds: [] as string[],
        signedImpacts: [] as number[],
        zeroFlags: [] as boolean[],
      };
    group.transactionIds.push(deterministicId(tx));
    group.signedImpacts.push(Number(tx.signedBalance ?? 0));
    group.zeroFlags.push(Boolean(tx.isZeroBalance));
    groups.set(key, group);
  }

  const result: any[] = [];
  for (const g of groups.values()) {
    if (g.transactionIds.length < 2) continue;
    if (g.zeroFlags.every(z => z)) continue;  // all-zero-balance group: skip
    const potential = round2(g.signedImpacts.slice(1).reduce((a, b) => a + b, 0));
    result.push({
      identityKey: g.identityKey,
      currency: g.currency,
      count: g.transactionIds.length,
      potentialSignedImpact: potential,
      transactionIds: g.transactionIds,
    });
  }

  // Sort by potential impact desc — UI default
  result.sort((a, b) => Math.abs(b.potentialSignedImpact) - Math.abs(a.potentialSignedImpact));
  return result;
}

// ============================================================
// statement link resolution
// ============================================================
//
// LOCAL and AGENT statement matches have DIFFERENT shapes — see
// reviewer findings P0 #1 / #2.
//
// LOCAL match row:
//   { statementRow, ourRefNo, invoiceNo, currency, statementBalance,
//     refFound, referenceStatus,    // 'found' | 'not_in_uploaded_erp_extract'
//     differenceType,               // UPPER_SNAKE: 'AS_OF_DATE_MISMATCH', etc.
//     candidateRows[],              // [{sourceType, sourceRow, ourRefNo, invoiceNo, signedBalance}]
//     ... }
//   → matches against INVOICE rows by ourRefNo + invoiceNo + currency
//
// AGENT match row:
//   { statementRow, crdrNo, crdrSourceRow, statementOurRefNo,
//     matched, identityMatched, currencyMatches,
//     differenceType,               // 'AS_OF_DATE_MISMATCH' or null
//     statementCurrency, crdrCurrency,
//     ... }
//   → matches against CRDR rows by crdrNo + crdrSourceRow + currency

/**
 * Multi-key index for transactions. Keys are scoped by (sourceType,
 * currency, identifier) so the same ourRefNo across USD/CAD or
 * INVOICE/CRDR never collides. (Reviewer finding P1 #3.)
 *
 * The index also exposes a (sourceType, sourceRow) lookup which is the
 * most precise FK Phase 1 hands us via `candidateRows[].sourceRow` and
 * AGENT `crdrSourceRow`.
 */
function buildTxIndex(previewTransactions: ReturnType<typeof buildPreviewTransactions>) {
  const byCurRef = new Map<string, string>();          // sourceType|currency|ourRefNo → tx.id
  const byCurInv = new Map<string, string>();          // sourceType|currency|invoiceNo → tx.id
  const byCurCrdr = new Map<string, string>();         // CRDR|currency|crdrNo → tx.id
  const byTypeRow = new Map<string, string>();         // sourceType|sourceRow → tx.id (Phase 1 uses this directly)

  for (const tx of previewTransactions) {
    const cur = tx.currency;
    const st = tx.sourceType;
    if (tx.ourRefNo) byCurRef.set(`${st}|${cur}|${tx.ourRefNo}`, tx.id);
    if (tx.invoiceNo) byCurInv.set(`${st}|${cur}|${tx.invoiceNo}`, tx.id);
    if (tx.crdrNo && st === 'CRDR') byCurCrdr.set(`CRDR|${cur}|${tx.crdrNo}`, tx.id);
    byTypeRow.set(`${st}|${tx.trace.sourceRow}`, tx.id);
  }

  return { byCurRef, byCurInv, byCurCrdr, byTypeRow };
}

type TxIndex = ReturnType<typeof buildTxIndex>;

/**
 * Map a LOCAL statement match row to a StatementLink.
 *
 * FK resolution strategy (in order):
 *   1. exactSignedBalanceMatches[0]  — Phase 1's authoritative "this is
 *      the row that exactly matches by signed balance". When this exists,
 *      it MUST be preferred over candidateRows because candidateRows may
 *      list other rows sharing the ourRefNo (e.g. zero-balance CRDR rows
 *      at offset 0) which are NOT the exact match.
 *      (Reviewer rev2 P0 #1 — without this priority, 76/162 EXACT_SIGNED
 *      links pointed to the wrong ERP row.)
 *   2. candidateRows[0] — Phase 1 candidate set, when no exact-match
 *      array is available.
 *   3. INVOICE+currency+ourRefNo  (scoped fallback)
 *   4. INVOICE+currency+invoiceNo (scoped fallback)
 *   5. null
 */
function localMatchToLink(stmt: any, m: any, idx: TxIndex) {
  const currency = toCurrency(m.currency ?? stmt.currency ?? 'USD');
  let matchedTransactionId: string | null = null;

  // Strategy 1: exactSignedBalanceMatches[0] — authoritative when present
  const esm = m.exactSignedBalanceMatches;
  if (Array.isArray(esm) && esm.length > 0) {
    const target = esm[0];
    if (target && target.sourceType && typeof target.sourceRow === 'number') {
      matchedTransactionId = idx.byTypeRow.get(`${target.sourceType}|${target.sourceRow}`) ?? null;
    }
  }

  // Strategy 2: candidateRows[0]
  if (!matchedTransactionId) {
    const candidate = Array.isArray(m.candidateRows) && m.candidateRows.length > 0 ? m.candidateRows[0] : null;
    if (candidate && candidate.sourceType && typeof candidate.sourceRow === 'number') {
      matchedTransactionId = idx.byTypeRow.get(`${candidate.sourceType}|${candidate.sourceRow}`) ?? null;
    }
  }

  // Strategy 3/4: scoped reference lookup, INVOICE primary
  if (!matchedTransactionId && m.ourRefNo) {
    matchedTransactionId = idx.byCurRef.get(`INVOICE|${currency}|${m.ourRefNo}`) ?? null;
  }
  if (!matchedTransactionId && m.invoiceNo) {
    matchedTransactionId = idx.byCurInv.get(`INVOICE|${currency}|${m.invoiceNo}`) ?? null;
  }

  return {
    source: 'LOCAL' as const,
    sourceFile: String(stmt.sourceFile ?? ''),
    sourceRow: Number(m.statementRow ?? 0),
    partyKey: partyKey(stmt.partyName ?? ''),
    invoiceNo: m.invoiceNo ?? null,
    ourRefNo: m.ourRefNo ?? null,
    crdrNo: null,
    currency,
    statementBalance: Number(m.statementBalance ?? 0),
    matchedTransactionId,
    matchType: localMatchType(m),
  };
}

/**
 * Map an AGENT statement match row to a StatementLink.
 *
 * FK strategy:
 *   1. crdrSourceRow — Phase 1 explicit row pointer
 *   2. CRDR+currency+crdrNo
 *   3. null
 */
function agentMatchToLink(stmt: any, m: any, idx: TxIndex) {
  const currency = toCurrency(m.crdrCurrency ?? m.statementCurrency ?? stmt.currency ?? 'USD');

  let matchedTransactionId: string | null = null;
  if (typeof m.crdrSourceRow === 'number' && m.crdrSourceRow > 0) {
    matchedTransactionId = idx.byTypeRow.get(`CRDR|${m.crdrSourceRow}`) ?? null;
  }
  if (!matchedTransactionId && m.crdrNo) {
    matchedTransactionId = idx.byCurCrdr.get(`CRDR|${currency}|${m.crdrNo}`) ?? null;
  }

  return {
    source: 'AGENT' as const,
    sourceFile: String(stmt.sourceFile ?? ''),
    sourceRow: Number(m.statementRow ?? 0),
    partyKey: partyKey(stmt.partyName ?? ''),
    invoiceNo: null,
    ourRefNo: m.statementOurRefNo ?? m.crdrOurRefNo ?? null,
    crdrNo: m.crdrNo ?? null,
    currency,
    statementBalance: Number(m.statementBalance ?? 0),
    matchedTransactionId,
    matchType: agentMatchType(m),
  };
}

/**
 * Map a LOCAL match row to v2 StatementMatchType.
 *
 * Real Phase 1 values seen:
 *   referenceStatus: 'found' | 'not_in_uploaded_erp_extract'
 *   differenceType:  'AS_OF_DATE_MISMATCH' | 'NOT_IN_UPLOADED_ERP_EXTRACT' |
 *                    'NO_REFERENCE_NUMBER' | 'OUTSIDE_UPLOADED_ERP_DATE_RANGE' |
 *                    'SAME_REF_DIFFERENT_CURRENCY' | null
 */
function localMatchType(m: any): string {
  const refStatus = String(m.referenceStatus ?? '');
  const diffType = String(m.differenceType ?? '');

  if (refStatus === 'not_in_uploaded_erp_extract') return 'NOT_IN_ERP_EXTRACT';
  if (diffType === 'OUTSIDE_UPLOADED_ERP_DATE_RANGE') return 'OUTSIDE_DATE_RANGE';
  if (diffType === 'SAME_REF_DIFFERENT_CURRENCY') return 'CURRENCY_MISMATCH';
  if (diffType === 'NO_REFERENCE_NUMBER') return 'NO_REFERENCE';
  // exactSignedBalanceMatches is an ARRAY of {sourceType, sourceRow, ...} —
  // not a count. Check length, not truthiness.
  if (Array.isArray(m.exactSignedBalanceMatches) && m.exactSignedBalanceMatches.length > 0) {
    return 'EXACT_SIGNED';
  }
  if (refStatus === 'found' && diffType && diffType !== 'None') return 'BALANCE_DIFFERENCE';
  if (refStatus === 'found') return 'EXACT_SIGNED';
  return 'NO_REFERENCE';
}

/**
 * Map an AGENT match row to v2 StatementMatchType.
 *
 * AGENT rows do NOT have referenceStatus. Their classification rides on:
 *   matched, identityMatched, currencyMatches, currentBalanceStatus,
 *   differenceType
 */
function agentMatchType(m: any): string {
  if (m.identityMatched === false) return 'IDENTITY_MISMATCH';
  if (m.currencyMatches === false) return 'CURRENCY_MISMATCH';
  if (m.currentBalanceStatus === 'settled_in_erp') return 'SETTLED_AFTER_STATEMENT';
  if (m.currentBalanceStatus === 'changed_in_erp') return 'CHANGED_AFTER_STATEMENT';
  if (m.differenceType === 'AS_OF_DATE_MISMATCH') return 'AS_OF_DATE_MISMATCH';
  if (m.matched === false) return 'NO_REFERENCE';
  if (Math.abs(Number(m.balanceDifference ?? 0)) < 0.005) return 'EXACT_SIGNED';
  return 'BALANCE_DIFFERENCE';
}

/**
 * Bridges per-row statement matches (Agent + Local) to ERP transactions.
 */
function buildStatementLinks(rawStatementMatchReport: any, previewTransactions: ReturnType<typeof buildPreviewTransactions>) {
  const idx = buildTxIndex(previewTransactions);
  const links: any[] = [];

  for (const stmt of rawStatementMatchReport?.local?.statements ?? []) {
    for (const m of stmt.matches ?? []) {
      links.push(localMatchToLink(stmt, m, idx));
    }
  }
  for (const stmt of rawStatementMatchReport?.agent?.statements ?? []) {
    for (const m of stmt.matches ?? []) {
      links.push(agentMatchToLink(stmt, m, idx));
    }
  }

  return links;
}

function buildDetails(raw: RawResult) {
  const transactions = buildPreviewTransactions(raw.transactions ?? []);
  const duplicateGroups = buildDuplicateGroupDetails(raw.transactions ?? []);
  const statementLinks = buildStatementLinks(raw.statementMatchReport ?? {}, transactions);

  // Strict NOT_IN_ERP_EXTRACT set — used by buildReviewItems to keep
  // Dashboard "Not in ERP: 7" agreeing with v1 reviewCandidates.local.
  // Strict = differenceType is exactly 'NOT_IN_UPLOADED_ERP_EXTRACT'.
  const strictNotInErpRowSet = new Set<string>();
  for (const stmt of raw.statementMatchReport?.local?.statements ?? []) {
    for (const m of stmt.matches ?? []) {
      if (m.differenceType === 'NOT_IN_UPLOADED_ERP_EXTRACT') {
        strictNotInErpRowSet.add(`${stmt.sourceFile}|${m.statementRow}`);
      }
    }
  }

  const reviewItems = buildReviewItems(
    raw.validationReport ?? {},
    transactions,
    duplicateGroups,
    statementLinks,
    strictNotInErpRowSet,
  );
  return { transactions, reviewItems, duplicateGroups, statementLinks };
}

export function toParsingPreviewResult(raw: RawResult) {
  return {
    specVersion: raw.specVersion,
    schemaVersion: '1.1',  // v2 always emits 1.1
    parserVersion: raw.parserVersion,
    uploadSession: raw.uploadSession,
    classificationReport: raw.classificationReport ?? [],
    reconciliationReport: raw.reconciliationReport ?? {},
    directionTotals: buildDirectionTotals(raw.transactions ?? []),
    agingBuckets: buildAgingBuckets(raw.transactions ?? []),
    departmentSummary: buildDepartmentSummary(raw.transactions ?? []),
    topParties: buildTopParties(raw.transactions ?? []),
    zeroBalance: buildZeroBalance(raw.transactions ?? []),
    validationReport: summarizeValidation(raw.validationReport ?? {}),
    duplicateReview: buildDuplicateReview(raw.transactions ?? []),
    skippedRows: summarizeSkippedRows(raw.skippedRows ?? []),
    statementMatchReport: summarizeStatementMatch(raw.statementMatchReport ?? {}),
    reviewCandidates: {
      local: buildLocalReviewCandidates(raw.statementMatchReport?.local),
    },

    // v2 detail block (Phase 2 v2.0 spec §1)
    details: buildDetails(raw),
  };
}
