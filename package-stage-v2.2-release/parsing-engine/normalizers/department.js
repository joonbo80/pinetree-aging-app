export const DEFAULT_DEPARTMENT_MAP = Object.freeze({
  OIH: "OI",
  OIM: "OI",
  OI: "OI",
  OOH: "OO",
  OOM: "OO",
  OO: "OO",
  AIH: "AI",
  AIM: "AI",
  AI: "AI",
  AOH: "AO",
  AOM: "AO",
  AO: "AO",
  GEN: "GE",
  WRE: "GE",
  GE: "GE",
});

export const DEFAULT_DEPARTMENT_LABEL = Object.freeze({
  OI: "Ocean Import",
  OO: "Ocean Export",
  AI: "Air Import",
  AO: "Air Export",
  GE: "General",
});

export function normalizeDepartment(value, departmentMap = DEFAULT_DEPARTMENT_MAP, departmentLabel = DEFAULT_DEPARTMENT_LABEL) {
  const raw = value === null || value === undefined ? "" : String(value).trim().toUpperCase();
  if (!raw) return { raw, code: null, label: null, mapped: false };
  const code = departmentMap[raw] || null;
  return {
    raw,
    code,
    label: code ? departmentLabel[code] || code : null,
    mapped: Boolean(code),
  };
}
