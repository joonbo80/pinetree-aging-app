function countAnomaly(entry) {
    if (typeof entry?.count === 'number')
        return entry.count;
    if (Array.isArray(entry?.affectedTransactions))
        return entry.affectedTransactions.length;
    return 1;
}
function summarizeValidation(report) {
    return {
        critical: (report?.critical ?? []).map((entry) => ({
            rule: entry.rule ?? 'CRITICAL',
            message: entry.message ?? entry.reason ?? 'Critical validation issue',
            count: countAnomaly(entry),
        })),
        warnings: (report?.warnings ?? []).map((entry) => ({
            rule: entry.rule ?? 'WARNING',
            message: entry.message ?? 'Validation warning',
            count: countAnomaly(entry),
        })),
        info: (report?.info ?? []).map((entry) => ({
            rule: entry.rule ?? 'INFO',
            message: entry.message ?? 'Validation info',
            count: countAnomaly(entry),
        })),
    };
}
function buildDirectionTotals(transactions) {
    const map = new Map();
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
function buildZeroBalance(transactions) {
    const byTypeCurrency = new Map();
    let count = 0;
    for (const tx of transactions) {
        if (!tx.isZeroBalance)
            continue;
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
function buildAgingBuckets(transactions) {
    const map = new Map();
    for (const tx of transactions) {
        if (tx.direction === 'settled')
            continue;
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
function buildDepartmentSummary(transactions) {
    const map = new Map();
    for (const tx of transactions) {
        if (tx.direction === 'settled')
            continue;
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
function buildTopParties(transactions) {
    const map = new Map();
    for (const tx of transactions) {
        if (tx.direction === 'settled')
            continue;
        if (tx.direction !== 'receivable' && tx.direction !== 'payable')
            continue;
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
function buildDuplicateReview(transactions) {
    const groups = new Map();
    for (const tx of transactions) {
        if (!Array.isArray(tx.anomalyRefs) || !tx.anomalyRefs.includes('W1'))
            continue;
        const key = `${tx.sourceIdentityKey ?? tx.sourceFingerprint}|${tx.sourceContentHash ?? ''}`;
        if (!key)
            continue;
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
function summarizeSkippedRows(skippedRows) {
    const map = new Map();
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
function summarizeStatementMatch(report) {
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
function buildLocalReviewCandidates(localReport) {
    const out = [];
    for (const statement of localReport?.statements ?? []) {
        for (const match of statement.matches ?? []) {
            if (match.differenceType !== 'NOT_IN_UPLOADED_ERP_EXTRACT')
                continue;
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
function countLocalReconciliationErrors(statements) {
    return statements.filter(statement => statement.reconciliation && !statement.reconciliation.match).length;
}
function countStatementCurrencies(statements) {
    return statements.reduce((acc, statement) => {
        const currency = statement.currency ?? 'UNKNOWN';
        acc[currency] = (acc[currency] ?? 0) + 1;
        return acc;
    }, {});
}
function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function toParsingPreviewResult(raw) {
    return {
        specVersion: raw.specVersion,
        schemaVersion: raw.schemaVersion,
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
    };
}
