export function normalizeCompanyName(rawName, aliasTable = []) {
  const raw = rawName === null || rawName === undefined ? "" : String(rawName).trim();
  if (!raw) return { raw, normalized: "", rules: [] };

  const rules = [];
  let normalized = raw.toUpperCase();
  if (normalized !== raw) rules.push("uppercase");

  const withoutParen = normalized.replace(/\(.+?\)/g, " ");
  if (withoutParen !== normalized) rules.push("remove_parentheses");
  normalized = withoutParen;

  const withoutPunctuation = normalized.replace(/[.,'"`]/g, "");
  if (withoutPunctuation !== normalized) rules.push("remove_punctuation");
  normalized = withoutPunctuation;

  const withoutSuffix = normalized.replace(/\b(CO\s*LTD|CORP|INC|LTD|LIMITED)\b$/g, "");
  if (withoutSuffix !== normalized) rules.push("remove_suffix");
  normalized = withoutSuffix.replace(/\s+/g, " ").trim();

  const alias = findAlias(normalized, aliasTable);
  if (alias) {
    rules.push("alias_lookup");
    normalized = alias;
  }

  return { raw, normalized, rules };
}

function findAlias(value, aliasTable) {
  for (const entry of aliasTable || []) {
    const canonical = entry.canonicalName || entry.canonical || "";
    const aliases = entry.aliases || [];
    const candidates = [canonical, ...aliases].map((item) => normalizeAliasText(item));
    if (candidates.includes(normalizeAliasText(value))) return canonical.toUpperCase().trim();
  }
  return null;
}

function normalizeAliasText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\(.+?\)/g, " ")
    .replace(/[.,'"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
