// utils/partyKey.ts
// Normalize a party display name into a stable URL-safe key.
//
// Phase 2 v2.0 spec §8.2:
//   - Strips Korean and English company-form suffixes
//   - For UI routing only — never use as an authoritative "same party"
//     decision. Any business-level merge goes through the manual alias
//     table that lives in the Phase 1 freeze.
//
// Algorithm (in order):
//   1. Strip Korean suffixes (literal match): (주), 주식회사, (유), 유한회사
//   2. Strip English suffixes (case-insensitive, optional trailing "."):
//      INC, LTD, CORP, CO, LLC
//   3. Lowercase
//   4. Replace whitespace and punctuation with "-"
//   5. Collapse multiple "-" to single
//   6. Trim leading / trailing "-"
//   7. Empty result → "unknown-party"

const KOREAN_SUFFIXES = ['주식회사', '유한회사', '(주)', '(유)'];

const ENGLISH_SUFFIXES = ['INC', 'LTD', 'CORP', 'CO', 'LLC'];

function stripKoreanSuffixes(input: string): string {
  let result = input;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of KOREAN_SUFFIXES) {
      // Korean suffixes can appear anywhere (often at start or end), so
      // remove all literal occurrences.
      if (result.includes(suffix)) {
        result = result.split(suffix).join(' ');
        changed = true;
      }
    }
  }
  return result;
}

function stripEnglishSuffixes(input: string): string {
  // Only strip when the suffix appears as a separate trailing token, with
  // optional trailing ".". Word-boundary aware so "Inco" is not stripped
  // to "Inco" → "" (which would happen with naive .replace).
  let result = input;
  // Apply repeatedly — e.g. "Acme Co Ltd" should become "Acme".
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of ENGLISH_SUFFIXES) {
      // Match: optional separator, suffix, optional ".", end-of-string
      const re = new RegExp(`[\\s,]+${suffix}\\.?\\s*$`, 'i');
      if (re.test(result)) {
        result = result.replace(re, '');
        changed = true;
      }
    }
  }
  return result;
}

/**
 * Normalize a party display name into a URL-safe routing key.
 *
 * IMPORTANT: This is for UI routing only. Two parties sharing a key are
 * NOT automatically considered the same business entity. Use the Phase 1
 * alias table for that decision.
 */
export function partyKey(displayName: string | null | undefined): string {
  if (!displayName) return 'unknown-party';

  let s = String(displayName);

  // 1. Strip Korean suffixes (literal)
  s = stripKoreanSuffixes(s);

  // 2. Strip trailing English suffixes (token-aware, case-insensitive)
  s = stripEnglishSuffixes(s);

  // 3. Lowercase. We use toLocaleLowerCase('en') because the input may
  // contain non-ASCII letters (e.g. 한글) for which we want stable
  // behavior across runtimes.
  s = s.toLocaleLowerCase('en');

  // 4. Replace any run of whitespace, ASCII punctuation, or
  // common CJK punctuation with a single hyphen.
  // Kept characters: letters (any script), digits, hyphen.
  s = s.replace(/[^\p{L}\p{N}-]+/gu, '-');

  // 5. Collapse multiple hyphens, 6. trim leading/trailing
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  // 7. Empty result → unknown-party
  if (!s) return 'unknown-party';

  return s;
}
