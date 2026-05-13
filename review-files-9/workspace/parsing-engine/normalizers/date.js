const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toIsoDate(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 25000 && value <= 60000) return excelSerialToIsoDate(value);
    return null;
  }

  const text = String(value).trim();
  if (!text || text.toLowerCase() === "nan" || text.toLowerCase() === "nat") return null;

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return safeIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const short = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (short) {
    const yy = Number(short[3]);
    const year = yy <= 30 ? 2000 + yy : 1900 + yy;
    return safeIso(year, Number(short[1]), Number(short[2]));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return toIsoDate(parsed);
  return null;
}

export function calculateAgingDays(baseDateIso, asOfDateIso) {
  if (!baseDateIso || !asOfDateIso) return null;
  const base = parseIsoUtc(baseDateIso);
  const asOf = parseIsoUtc(asOfDateIso);
  if (!base || !asOf) return null;
  return Math.floor((asOf.getTime() - base.getTime()) / MS_PER_DAY);
}

export function agingBucket(days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null;
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function excelSerialToIsoDate(serial) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return toIsoDate(new Date(excelEpoch + Math.round(serial) * MS_PER_DAY));
}

function safeIso(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return toIsoDate(date);
}

function parseIsoUtc(iso) {
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}
