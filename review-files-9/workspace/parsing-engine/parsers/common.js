import { ParseRowError, ParseStatus } from "../types.js";
import { normalizeDate } from "../normalizers/date.js";
import { normalizeCurrency } from "../normalizers/currency.js";
import { normalizeCompanyName } from "../normalizers/company_name.js";
import { normalizeDepartment } from "../normalizers/department.js";
import { calculateSignedBalance, determineDirection, isZeroAmount, toNumber } from "../normalizers/balance.js";
import { calculateAgingDays, agingBucket } from "../utils/aging.js";
import { makeSourceContentHash, makeSourceIdentityKey, makeUuid } from "../utils/fingerprint.js";

export function buildTransaction({
  sourceType,
  row,
  rowIndex,
  sourceFile,
  sourceSheet,
  importBatchId,
  options,
  ids,
  party,
  amounts,
  dates,
  departmentRaw,
  createdBy,
  extra = {},
}) {
  const rawBalance = toNumber(amounts.rawBalance);
  if (rawBalance === null) throw new ParseRowError("C2", "Balance is NaN or invalid");

  const currency = normalizeCurrency(amounts.currency);
  if (!currency) throw new ParseRowError("C1", `Invalid currency: ${amounts.currency}`);

  const company = normalizeCompanyName(party.rawName, options.aliasTable);
  const zeroBalance = isZeroAmount(rawBalance);
  if (!company.normalized && !zeroBalance) {
    throw new ParseRowError("C3", "Company is empty while balance is non-zero");
  }

  if (!company.normalized && zeroBalance) {
    return {
      parseStatus: ParseStatus.SKIPPED,
      reason: "empty_company_zero_balance",
      sourceFile,
      sourceSheet,
      sourceType,
      sourceRow: rowIndex + 1,
      rawRow: row,
    };
  }

  const transactionDate = normalizeDate(dates.transactionDate);
  const postDate = normalizeDate(dates.postDate);
  const dueDate = normalizeDate(dates.dueDate);
  const agingBaseDate = normalizeDate(dates.agingBaseDate);
  if (!agingBaseDate) throw new ParseRowError("C_DATE", "Required aging base date is missing");

  const department = normalizeDepartment(departmentRaw, options.departmentMap, options.departmentLabel);
  const signedBalance = calculateSignedBalance(sourceType, rawBalance);
  const direction = determineDirection(sourceType, rawBalance);
  const agingDays = calculateAgingDays(agingBaseDate, options.asOfDate);
  const internalId = cleanId(ids.internalId);
  const sourceIdentityKey = makeSourceIdentityKey(sourceType, internalId, [
    ids.invoiceNo,
    ids.crdrNo,
    ids.ourRefNo,
    ids.blNo,
    currency,
  ]);

  const transaction = {
    id: makeUuid(),
    sourceIdentityKey,
    sourceContentHash: makeSourceContentHash([
      sourceType,
      internalId,
      currency,
      rawBalance,
      ids.ourRefNo,
    ]),
    sourceFile,
    sourceSheet,
    sourceType,
    sourceRow: rowIndex + 1,
    sourceInternalId: internalId,
    importBatchId,
    importAsOfDate: options.asOfDate,
    rawRow: row,
    ourRefNo: cleanString(ids.ourRefNo),
    crdrNo: cleanString(ids.crdrNo),
    invoiceNo: cleanString(ids.invoiceNo),
    vendorInvoiceNo: cleanString(ids.vendorInvoiceNo),
    blNo: cleanString(ids.blNo),
    partyName: company.normalized,
    partyNameRaw: company.raw,
    partyType: party.type,
    currency,
    grossAmount: toNumber(amounts.grossAmount) ?? Math.abs(rawBalance),
    paidAmount: toNumber(amounts.paidAmount) ?? 0,
    rawBalance,
    signedBalance,
    absoluteBalance: Math.abs(rawBalance),
    isZeroBalance: zeroBalance,
    direction,
    drAmount: amounts.drAmount === undefined ? null : toNumber(amounts.drAmount),
    crAmount: amounts.crAmount === undefined ? null : toNumber(amounts.crAmount),
    transactionDate,
    postDate,
    dueDate,
    agingBaseDate,
    agingBasis: dates.agingBasis,
    agingDays,
    agingBucket: agingBucket(agingDays),
    department: department.code,
    departmentRaw: department.raw,
    departmentLabel: department.label,
    createdBy: cleanString(createdBy),
    parseStatus: ParseStatus.PARSED,
    anomalyRefs: [],
    normalization: {
      companyRules: company.rules,
      dateRules: [],
      currencyRules: [],
    },
    ...extra,
  };

  if (!department.mapped && department.raw) transaction.anomalyRefs.push("I3");
  if (agingDays !== null && agingDays > 90) transaction.anomalyRefs.push("I1");
  if (dueDate && dueDate < options.asOfDate && !zeroBalance) transaction.anomalyRefs.push("I2");

  return transaction;
}

export function isEmptyRow(row) {
  return !row || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
}

export function cleanString(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function cleanId(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned.endsWith(".0") ? cleaned.slice(0, -2) : cleaned;
}
