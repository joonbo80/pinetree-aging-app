import { SourceType } from "../types.js";

export function applyWarningRules(transactions) {
  addDuplicateWarnings(transactions);
  addCompanyCurrencyWarnings(transactions);
  addSoftDuplicateWarnings(transactions);
  return transactions;
}

function addDuplicateWarnings(transactions) {
  const groups = new Map();
  for (const transaction of transactions) {
    const key = hardDuplicateKey(transaction);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(transaction);
  }
  for (const group of groups.values()) {
    if (group.length > 1 && group.some((transaction) => !transaction.isZeroBalance)) {
      group.forEach((transaction) => pushAnomaly(transaction, "W1"));
    }
  }
}

function hardDuplicateKey(transaction) {
  const identity = identityKey(transaction);
  if (!identity) return null;
  return `${identity}|${transaction.sourceContentHash}`;
}

function identityKey(transaction) {
  if (transaction.sourceType === SourceType.INVOICE && transaction.invoiceNo) {
    return `${transaction.sourceType}|${transaction.invoiceNo}|${transaction.currency}`;
  }
  if (transaction.sourceType === SourceType.CRDR && transaction.crdrNo) {
    return `${transaction.sourceType}|${transaction.crdrNo}|${transaction.currency}`;
  }
  if (transaction.sourceType === SourceType.AP && transaction.sourceInternalId) {
    return `${transaction.sourceType}|${transaction.sourceInternalId}`;
  }
  return null;
}

function addCompanyCurrencyWarnings(transactions) {
  const byCompany = new Map();
  for (const transaction of transactions) {
    if (!transaction.partyName) continue;
    if (!byCompany.has(transaction.partyName)) byCompany.set(transaction.partyName, new Set());
    byCompany.get(transaction.partyName).add(transaction.currency);
  }
  const mixed = new Set([...byCompany].filter(([, currencies]) => currencies.size > 1).map(([company]) => company));
  transactions.forEach((transaction) => {
    if (mixed.has(transaction.partyName)) pushAnomaly(transaction, "W2");
  });
}

function addSoftDuplicateWarnings(transactions) {
  const groups = new Map();
  for (const transaction of transactions) {
    if (!transaction.ourRefNo || transaction.isZeroBalance) continue;
    const key = [
      transaction.ourRefNo,
      transaction.currency,
      transaction.direction,
      transaction.absoluteBalance.toFixed(2),
    ].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(transaction);
  }
  for (const group of groups.values()) {
    const sourceTypes = new Set(group.map((transaction) => transaction.sourceType));
    if (group.length > 1 && sourceTypes.size > 1) {
      group.forEach((transaction) => pushAnomaly(transaction, "W7"));
    }
  }
}

function pushAnomaly(transaction, rule) {
  if (!transaction.anomalyRefs.includes(rule)) transaction.anomalyRefs.push(rule);
}
