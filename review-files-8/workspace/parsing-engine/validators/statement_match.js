import { SourceType } from "../types.js";

export function buildStatementMatchReport(statements, transactions) {
  const crdrByNo = new Map(
    transactions
      .filter((transaction) => transaction.sourceType === SourceType.CRDR && transaction.crdrNo)
      .map((transaction) => [transaction.crdrNo, transaction]),
  );

  const agentStatements = statements.filter((statement) => statement.sourceType === SourceType.AGENT_STATEMENT);
  const agent = agentStatements.map((statement) => buildAgentStatementMatch(statement, crdrByNo));
  const localStatements = statements.filter((statement) => statement.sourceType === SourceType.LOCAL_STATEMENT);
  const erpDateRange = buildErpDateRange(transactions);
  const local = localStatements.map((statement) => buildLocalStatementMatch(statement, transactions, erpDateRange));
  return {
    agent: {
      statementCount: agentStatements.length,
      transactionRefCount: agent.reduce((sum, item) => sum + item.transactionRefCount, 0),
      matchedRefCount: agent.reduce((sum, item) => sum + item.matchedRefCount, 0),
      unmatchedRefCount: agent.reduce((sum, item) => sum + item.unmatchedRefCount, 0),
      identityMismatchCount: agent.reduce((sum, item) => sum + item.identityMismatchCount, 0),
      currentBalanceDiffCount: agent.reduce((sum, item) => sum + item.currentBalanceDiffCount, 0),
      asOfDateMismatchCount: agent.reduce((sum, item) => sum + item.asOfDateMismatchCount, 0),
      settledInErpCount: agent.reduce((sum, item) => sum + item.settledInErpCount, 0),
      changedInErpCount: agent.reduce((sum, item) => sum + item.changedInErpCount, 0),
      statements: agent,
    },
    local: {
      statementCount: localStatements.length,
      transactionRefCount: local.reduce((sum, item) => sum + item.transactionRefCount, 0),
      refFoundCount: local.reduce((sum, item) => sum + item.refFoundCount, 0),
      refMissingCount: local.reduce((sum, item) => sum + item.refMissingCount, 0),
      outsideUploadedErpDateRangeCount: local.reduce((sum, item) => sum + item.outsideUploadedErpDateRangeCount, 0),
      unmatchedWithinUploadedDateRangeCount: local.reduce((sum, item) => sum + item.unmatchedWithinUploadedDateRangeCount, 0),
      sameRefDifferentCurrencyCount: local.reduce((sum, item) => sum + item.sameRefDifferentCurrencyCount, 0),
      noReferenceNumberCount: local.reduce((sum, item) => sum + item.noReferenceNumberCount, 0),
      notInUploadedErpExtractCount: local.reduce((sum, item) => sum + item.notInUploadedErpExtractCount, 0),
      refFoundBalanceDiffCount: local.reduce((sum, item) => sum + item.refFoundBalanceDiffCount, 0),
      exactSignedBalanceMatchCount: local.reduce((sum, item) => sum + item.exactSignedBalanceMatchCount, 0),
      erpDateRange,
      statements: local,
    },
  };
}

function buildAgentStatementMatch(statement, crdrByNo) {
  const matches = statement.transactions.map((item) => {
    const crdr = crdrByNo.get(item.crdrNo);
    const currentBalanceDiff = crdr ? round(item.balance - crdr.rawBalance) : null;
    return {
      crdrNo: item.crdrNo,
      statementRow: item.sourceRow,
      matched: Boolean(crdr),
      crdrSourceRow: crdr?.sourceRow ?? null,
      statementDate: statement.statementDate,
      statementAsOf: statement.statementDate,
      erpAsOf: crdr?.importAsOfDate ?? null,
      statementBalance: item.balance,
      crdrRawBalance: crdr?.rawBalance ?? null,
      currentBalanceDiff,
      balanceDifference: currentBalanceDiff,
      differenceType: currentBalanceDifferenceType(item, crdr, currentBalanceDiff),
      crdrIsZeroBalance: crdr?.isZeroBalance ?? null,
      currentBalanceStatus: currentBalanceStatus(item, crdr),
      statementOurRefNo: item.ourRefNo,
      crdrOurRefNo: crdr?.ourRefNo ?? null,
      ourRefMatches: crdr ? item.ourRefNo === crdr.ourRefNo : null,
      statementCurrency: statement.currency,
      crdrCurrency: crdr?.currency ?? null,
      currencyMatches: crdr ? statement.currency === crdr.currency : null,
      identityMatched: crdr ? item.ourRefNo === crdr.ourRefNo && statement.currency === crdr.currency : false,
    };
  });

  const identityMismatchCount = matches.filter((match) => match.matched && !match.identityMatched).length;
  const currentBalanceDiffCount = matches.filter(
    (match) => match.matched && Math.abs(match.currentBalanceDiff) >= 0.005,
  ).length;
  const asOfDateMismatchCount = matches.filter((match) => match.differenceType === "AS_OF_DATE_MISMATCH").length;
  const settledInErpCount = matches.filter((match) => match.currentBalanceStatus === "settled_in_erp").length;
  const changedInErpCount = matches.filter((match) => match.currentBalanceStatus === "changed_in_erp").length;

  return {
    statementId: statement.id,
    sourceFile: statement.sourceFile,
    blockIndex: statement.blockIndex,
    partyName: statement.partyName,
    currency: statement.currency,
    direction: statement.direction,
    transactionRefCount: matches.length,
    matchedRefCount: matches.filter((match) => match.matched).length,
    unmatchedRefCount: matches.filter((match) => !match.matched).length,
    identityMismatchCount,
    currentBalanceDiffCount,
    asOfDateMismatchCount,
    settledInErpCount,
    changedInErpCount,
    currencyMismatchCount: matches.filter((match) => match.matched && !match.currencyMatches).length,
    ourRefMismatchCount: matches.filter((match) => match.matched && !match.ourRefMatches).length,
    reconciliation: statement.reconciliation,
    matches,
  };
}

function currentBalanceDifferenceType(item, crdr, currentBalanceDiff) {
  if (!crdr) return "UNMATCHED_CRDR";
  if (Math.abs(currentBalanceDiff) < 0.005) return null;
  return "AS_OF_DATE_MISMATCH";
}

function currentBalanceStatus(item, crdr) {
  if (!crdr) return "unmatched";
  const diff = round(item.balance - crdr.rawBalance);
  if (Math.abs(diff) < 0.005) return "same";
  if (crdr.isZeroBalance) return "settled_in_erp";
  return "changed_in_erp";
}

function buildLocalStatementMatch(statement, transactions, erpDateRange) {
  const matches = statement.transactions.map((item) => {
    const candidates = findLocalCandidates(item, transactions);
    const sameRefDifferentCurrencyCandidates = findSameRefDifferentCurrencyCandidates(item, transactions);
    const exactMatches = candidates.filter((candidate) => Math.abs(candidate.signedBalance - item.balance) < 0.005);
    const outsideUploadedErpDateRange = isOutsideDateRange(item.invoiceDate, erpDateRange);
    return {
      statementRow: item.sourceRow,
      ourRefNo: item.ourRefNo,
      invoiceNo: item.invoiceNo,
      statementDate: statement.statementDate,
      statementAsOf: statement.statementDate,
      erpAsOf: candidates[0]?.importAsOfDate ?? null,
      invoiceDate: item.invoiceDate,
      statementBalance: item.balance,
      currency: item.currency,
      refFound: candidates.length > 0,
      referenceStatus: candidates.length > 0 ? "found" : "not_in_uploaded_erp_extract",
      sameRefDifferentCurrency: candidates.length === 0 && sameRefDifferentCurrencyCandidates.length > 0,
      outsideUploadedErpDateRange,
      differenceType: localDifferenceType(
        item,
        candidates,
        exactMatches,
        sameRefDifferentCurrencyCandidates,
        outsideUploadedErpDateRange,
      ),
      exactSignedBalanceMatches: exactMatches.map((candidate) => transactionPointer(candidate)),
      candidateCount: candidates.length,
      candidateRows: candidates.slice(0, 20).map(transactionPointer),
      sameRefDifferentCurrencyCandidates: sameRefDifferentCurrencyCandidates.slice(0, 20).map(transactionPointer),
    };
  });

  return {
    statementId: statement.id,
    sourceFile: statement.sourceFile,
    blockIndex: statement.blockIndex,
    partyName: statement.partyName,
    currency: statement.currency,
    direction: statement.direction,
    transactionRefCount: matches.length,
    refFoundCount: matches.filter((match) => match.refFound).length,
    refMissingCount: matches.filter((match) => !match.refFound).length,
    outsideUploadedErpDateRangeCount: matches.filter((match) => !match.refFound && match.outsideUploadedErpDateRange).length,
    unmatchedWithinUploadedDateRangeCount: matches.filter(
      (match) => !match.refFound && !match.outsideUploadedErpDateRange,
    ).length,
    sameRefDifferentCurrencyCount: matches.filter((match) => match.differenceType === "SAME_REF_DIFFERENT_CURRENCY").length,
    noReferenceNumberCount: matches.filter((match) => match.differenceType === "NO_REFERENCE_NUMBER").length,
    notInUploadedErpExtractCount: matches.filter((match) => match.differenceType === "NOT_IN_UPLOADED_ERP_EXTRACT").length,
    refFoundBalanceDiffCount: matches.filter((match) => match.refFound && !match.exactSignedBalanceMatches.length).length,
    exactSignedBalanceMatchCount: matches.filter((match) => match.exactSignedBalanceMatches.length > 0).length,
    reconciliation: statement.reconciliation,
    matches,
  };
}

function buildErpDateRange(transactions) {
  const dates = transactions.map((transaction) => transaction.transactionDate).filter(Boolean).sort();
  return {
    from: dates[0] || null,
    to: dates.at(-1) || null,
  };
}

function isOutsideDateRange(date, range) {
  if (!date || !range.from || !range.to) return false;
  return date < range.from || date > range.to;
}

function localDifferenceType(item, candidates, exactMatches, sameRefDifferentCurrencyCandidates, outsideUploadedErpDateRange) {
  if (candidates.length && exactMatches.length) return null;
  if (candidates.length) return "AS_OF_DATE_MISMATCH";
  if (!item.ourRefNo) return "NO_REFERENCE_NUMBER";
  if (sameRefDifferentCurrencyCandidates.length) return "SAME_REF_DIFFERENT_CURRENCY";
  if (outsideUploadedErpDateRange) return "OUTSIDE_UPLOADED_ERP_DATE_RANGE";
  return "NOT_IN_UPLOADED_ERP_EXTRACT";
}

function findLocalCandidates(item, transactions) {
  const ref = item.ourRefNo;
  const invoiceNo = item.invoiceNo;
  return transactions.filter((transaction) => {
    if (transaction.currency !== item.currency) return false;
    if (ref && transaction.ourRefNo === ref) return true;
    if (invoiceNo && transaction.invoiceNo === invoiceNo) return true;
    return false;
  });
}

function findSameRefDifferentCurrencyCandidates(item, transactions) {
  if (!item.ourRefNo) return [];
  return transactions.filter((transaction) => transaction.ourRefNo === item.ourRefNo && transaction.currency !== item.currency);
}

function transactionPointer(transaction) {
  return {
    sourceType: transaction.sourceType,
    sourceRow: transaction.sourceRow,
    ourRefNo: transaction.ourRefNo,
    invoiceNo: transaction.invoiceNo,
    signedBalance: transaction.signedBalance,
  };
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
