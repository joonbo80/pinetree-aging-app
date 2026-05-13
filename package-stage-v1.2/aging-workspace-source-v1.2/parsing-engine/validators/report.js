export function buildValidationReport(transactions, rejectedRows) {
  const critical = rejectedRows.map((row) => ({
    rule: row.rule || "CRITICAL",
    message: row.reason,
    sourceFile: row.sourceFile,
    sourceRow: row.sourceRow,
  }));

  const warnings = [
    ...collect(transactions, ["W1", "W3", "W4", "W5", "W6", "W7"]),
    ...collectCompanyCurrencyWarnings(transactions),
  ].sort((a, b) => a.rule.localeCompare(b.rule));
  const info = collect(transactions, ["I1", "I2", "I3"]);
  return { critical, warnings, info };
}

function collect(transactions, rules) {
  return rules
    .map((rule) => {
      const affected = transactions.filter((transaction) => transaction.anomalyRefs.includes(rule)).map((transaction) => transaction.id);
      if (!affected.length) return null;
      return { rule, message: messageFor(rule, affected.length), affectedTransactions: affected };
    })
    .filter(Boolean);
}

function collectCompanyCurrencyWarnings(transactions) {
  const byCompany = new Map();
  for (const transaction of transactions.filter((item) => item.anomalyRefs.includes("W2"))) {
    if (!byCompany.has(transaction.partyName)) {
      byCompany.set(transaction.partyName, { currencies: new Set(), affectedTransactions: [] });
    }
    const group = byCompany.get(transaction.partyName);
    group.currencies.add(transaction.currency);
    group.affectedTransactions.push(transaction.id);
  }
  if (!byCompany.size) return [];
  return [
    {
      rule: "W2",
      message: messageFor("W2", byCompany.size),
      affectedCompanies: [...byCompany.entries()].map(([partyName, group]) => ({
        partyName,
        currencies: [...group.currencies].sort(),
        affectedTransactionCount: group.affectedTransactions.length,
        affectedTransactions: group.affectedTransactions,
      })),
    },
  ];
}

function messageFor(rule, count) {
  const messages = {
    W1: "Duplicate key candidate",
    W2: "Same company has both USD and CAD",
    W3: "Paid amount is greater than gross amount",
    W4: "Invoice balance is negative",
    W5: "Same ourRefNo exists in both INVOICE and CRDR",
    W6: "AP balance is negative, possible refund/credit",
    W7: "Soft duplicate across source types by ref, amount, currency, and direction",
    I1: "agingDays > 90",
    I2: "dueDate is before asOfDate and balance is non-zero",
    I3: "Department code is not mapped",
  };
  const unit = rule === "W2" ? "companies" : "transactions";
  return `${messages[rule] || rule} (${count} ${unit})`;
}
