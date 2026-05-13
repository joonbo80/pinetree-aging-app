import { Direction, SourceType } from "../types.js";

export const ZERO_EPSILON = 0.005;

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function isZeroAmount(value) {
  return Math.abs(Number(value || 0)) < ZERO_EPSILON;
}

export function determineDirection(sourceType, rawBalance) {
  // Phase 1 policy: every zero-balance transaction is settled, regardless of source type.
  if (isZeroAmount(rawBalance)) return Direction.SETTLED;
  if (sourceType === SourceType.AP) {
    return rawBalance < 0 ? Direction.RECEIVABLE : Direction.PAYABLE;
  }
  if (sourceType === SourceType.INVOICE || sourceType === SourceType.CRDR) {
    return rawBalance > 0 ? Direction.RECEIVABLE : Direction.PAYABLE;
  }
  return rawBalance > 0 ? Direction.RECEIVABLE : Direction.PAYABLE;
}

export function calculateSignedBalance(sourceType, rawBalance) {
  if (sourceType === SourceType.AP) {
    return rawBalance < 0 ? Math.abs(rawBalance) : -Math.abs(rawBalance);
  }
  return rawBalance;
}
