// tools/test-party-detail-page-step12.mjs
//
// Phase 2 v2.2 Step 12 regression — Dashboard Top Parties links to
// /party/:partyKey.
//
// Goals verified:
//   1. TopPartySummary type accepts optional partyKey (extension only,
//      no breaking change to v2.0/v2.1 producers)
//   2. Dashboard accepts onOpenParty callback (callback-prop pattern,
//      not react-router import — keeps Dashboard router-free per v2.0
//      decision)
//   3. Dashboard has partyName -> partyKey fallback map for legacy
//      payloads
//   4. TopPartyTable renders rows as buttons when onOpenParty + key
//      are available, plain text otherwise (graceful degrade)
//   5. Real-data: all 12 baseline topParties resolve to a partyKey
//      via the fallback map (no orphans)
//   6. v2.1.1 invariant carries: partyName visible on every link
//   7. Aria-label on each link button for screen reader context

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = resolve(__dirname, '../aging-app/src/baselines/phase1-v1.3.0.json');
const dashboardPath = resolve(__dirname, '../aging-app/src/components/dashboard/Dashboard.tsx');
const typesPath = resolve(__dirname, '../aging-app/src/parsing-engine/types.ts');

const result = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const dashSource = readFileSync(dashboardPath, 'utf-8');
const typesSource = readFileSync(typesPath, 'utf-8');

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) { pass++; console.log(`  \u2705 ${label}`); }
  else { fail++; failures.push({ label, evidence }); console.error(`  \u274c ${label}${evidence ? ' \u2014 ' + evidence : ''}`); }
}

// ============================================================
// A. TopPartySummary type extension (additive only)
// ============================================================
console.log('\n=== A. TopPartySummary type extension ===');

check(`TopPartySummary has optional partyKey`,
      /export interface TopPartySummary[\s\S]{0,400}partyKey\?:\s*string/.test(typesSource));
check(`partyKey is OPTIONAL (not required, preserves backward compat)`,
      /partyKey\?:\s*string/.test(typesSource));
check(`TopPartySummary still has partyName (not replaced)`,
      /export interface TopPartySummary[\s\S]{0,400}partyName:\s*string/.test(typesSource));

// ============================================================
// B. Dashboard onOpenParty callback prop pattern
// ============================================================
console.log('\n=== B. Callback-prop pattern (no react-router in Dashboard) ===');

check(`DashboardProps has onOpenParty callback`,
      /onOpenParty\?:\s*\(partyKey:\s*string\)\s*=>\s*void/.test(dashSource));
check(`Dashboard does NOT import react-router-dom`,
      !dashSource.includes("from 'react-router-dom'"));
check(`Dashboard uses callback pattern (consistent with onOpenReview)`,
      dashSource.includes('onOpenParty?:') && dashSource.includes('onOpenReview:'));

// ============================================================
// C. partyName -> partyKey fallback map
// ============================================================
console.log('\n=== C. Fallback resolution map ===');

check(`Dashboard builds nameToKey map`,
      dashSource.includes('const nameToKey = new Map<string, string>()'));
check(`nameToKey populated from details.transactions`,
      dashSource.includes('result.details?.transactions'));
check(`resolvePartyKey function exists`,
      dashSource.includes('const resolvePartyKey'));
check(`resolvePartyKey prefers row.partyKey over fallback`,
      /row\.partyKey\s*\?\?\s*nameToKey\.get\(row\.partyName\)/.test(dashSource));

// ============================================================
// D. TopPartyTable renders link button
// ============================================================
console.log('\n=== D. Link button rendering ===');

check(`TopPartyTable accepts onOpenParty + resolvePartyKey props`,
      /TopPartyTable\([\s\S]{0,500}onOpenParty\?:[\s\S]{0,200}resolvePartyKey:/.test(dashSource));
check(`row uses canLink check (graceful degrade)`,
      dashSource.includes('const canLink = onOpenParty && key !== null'));
check(`row renders <button> when canLink, plain text otherwise`,
      dashSource.includes('canLink ? (') &&
      /onClick=\{\(\)\s*=>\s*onOpenParty!\(key!\)\}/.test(dashSource));
check(`button has aria-label with party name (a11y)`,
      /aria-label=\{`Open party detail for \$\{row\.partyName\}`\}/.test(dashSource));
check(`partyName still visible inside link (v2.1.1 invariant)`,
      /<button[\s\S]{0,500}<b>\{row\.partyName\}<\/b>/.test(dashSource));

// ============================================================
// E. Real-data: all 12 topParties resolve to a partyKey
// ============================================================
console.log('\n=== E. Real-data resolution (no orphans) ===');

const top = result.topParties ?? [];
check(`baseline has 12 topParties`, top.length === 12);

// Build the same map the component builds
const nameToKey = new Map();
for (const tx of result.details?.transactions ?? []) {
  if (!nameToKey.has(tx.partyName)) {
    nameToKey.set(tx.partyName, tx.partyKey);
  }
}

const unresolved = top.filter(row => {
  const key = row.partyKey ?? nameToKey.get(row.partyName);
  return !key;
});
check(`all 12 topParties resolve to a partyKey`, unresolved.length === 0,
      `${unresolved.length} unresolved`);

// And: each resolved key is a real party in details
const allKeys = new Set();
for (const t of result.details?.transactions ?? []) allKeys.add(t.partyKey);
const orphan = top.filter(row => {
  const key = row.partyKey ?? nameToKey.get(row.partyName);
  return key && !allKeys.has(key);
});
check(`every resolved partyKey exists in details.transactions`, orphan.length === 0,
      `${orphan.length} orphan keys`);

// ============================================================
// F. Empty topParties — graceful render (no crash)
// ============================================================
console.log('\n=== F. Empty topParties handling ===');

check(`empty rows still render the empty-state cell`,
      dashSource.includes('rows.length === 0') &&
      /<td colSpan=\{3\}[\s\S]{0,80}No rows\./.test(dashSource));

// ============================================================
// G. Schema 1.0 / details-missing tolerance
// ============================================================
console.log('\n=== G. Schema 1.0 tolerance ===');

// If result.details is missing, nameToKey is empty — but a v2.2+
// payload should populate row.partyKey directly so links still work.
check(`details.transactions read uses optional chaining`,
      dashSource.includes('result.details?.transactions ?? []'));

// ============================================================
console.log(`\n${'='.repeat(60)}`);
console.log(`PASS: ${pass}    FAIL: ${fail}`);
console.log(`${'='.repeat(60)}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const f of failures) {
    console.error(`  - ${f.label}`);
    if (f.evidence) console.error(`    ${f.evidence}`);
  }
  process.exit(1);
}
