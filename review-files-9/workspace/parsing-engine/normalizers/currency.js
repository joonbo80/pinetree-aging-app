export function normalizeCurrency(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).toUpperCase().trim();
  if (text === "USD" || text === "US$" || text === "$") return "USD";
  if (text === "CAD" || text === "C$") return "CAD";
  return null;
}
