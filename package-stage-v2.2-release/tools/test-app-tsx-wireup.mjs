// App.tsx wire-up invariants for v2.2.
// Pins the BLOCKER-2 fixes that absorbed Step 12 components but left
// the App.tsx wiring incomplete. These invariants catch the "components
// pass their own tests but App.tsx never connects them" failure mode
// (silent-corruption family member: component-level invariants do not
// catch wire-up layer regressions).
//
// Each check below catches one specific bug seen during Step 13
// hands-on walkthrough:
//   inv-wire-1: Dashboard onOpenParty prop missing -> Top Parties rows
//               render as plain text (no <button>), click does nothing
//   inv-wire-2: /party/:partyKey route uses PlaceholderPage instead of
//               real PartyDetailPage -> direct URL shows "No data
//               loaded yet" even when baseline is loaded
//   inv-wire-3: PartyDetailPage import missing -> route element cannot
//               reference the real component
//   inv-wire-4: result prop forwarded to PartyDetailPage -> component
//               cannot access loaded baseline data without it

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appTsxPath = resolve(root, 'aging-app/src/App.tsx');
const app = readFileSync(appTsxPath, 'utf8');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) {
    pass++;
    console.log(`PASS ${label}`);
  } else {
    fail++;
    failures.push({ label, evidence });
    console.error(`FAIL ${label}${evidence ? ` -- ${evidence}` : ''}`);
  }
}

console.log('\n=== App.tsx imports ===');
check(
  'inv-wire-3: PartyDetailPage import present',
  /import\s*\{\s*PartyDetailPage\s*\}\s*from\s*['"]\.\/components\/party\/PartyDetailPage['"]/
    .test(app),
);
check(
  'imports unchanged: Dashboard import still present',
  /import\s*\{\s*Dashboard\s*\}\s*from\s*['"]\.\/components\/dashboard\/Dashboard['"]/
    .test(app),
);
check(
  'imports unchanged: ReviewQueuePage import still present',
  /import\s*\{\s*ReviewQueuePage\s*\}\s*from\s*['"]\.\/components\/review\/ReviewQueuePage['"]/
    .test(app),
);

console.log('\n=== Dashboard wire-up ===');
check(
  'inv-wire-1: Dashboard receives onOpenParty prop',
  /onOpenParty=\{[^}]*navigate\(`\/party\/\$\{partyKey\}`\)/.test(app),
);
check(
  'Dashboard onOpenParty uses partyKey route segment',
  /onOpenParty=\{[^}]*\/party\/\$\{partyKey\}/.test(app),
);
check(
  'Dashboard onOpenParty does NOT route to /dashboard (negative invariant)',
  !/onOpenParty=\{[^}]*navigate\(['"`]\/dashboard/.test(app),
);

console.log('\n=== /party/:partyKey route ===');
check(
  'inv-wire-2: /party/:partyKey route uses PartyDetailPage',
  /<Route\s+path="\/party\/:partyKey"\s+element=\{<PartyDetailPage\b/.test(app),
);
check(
  'inv-wire-2 negative: /party/:partyKey route does NOT use PlaceholderPage',
  !/<Route\s+path="\/party\/:partyKey"\s+element=\{<PlaceholderPage/.test(app),
);
check(
  'inv-wire-4: PartyDetailPage receives result prop',
  /<PartyDetailPage\s+result=\{result\}\s*\/>/.test(app),
);

console.log('\n=== Other routes unchanged ===');
check(
  'route /dashboard still uses Dashboard',
  /<Route\s+path="\/dashboard"/.test(app) && /<Dashboard\b/.test(app),
);
check(
  'route /review still uses ReviewQueuePage',
  /<Route\s+path="\/review"\s+element=\{<ReviewQueuePage\b/.test(app),
);
check(
  'route /review/:type still uses ReviewQueuePage',
  /<Route\s+path="\/review\/:type"\s+element=\{<ReviewQueuePage\b/.test(app),
);

console.log('\n=== Result prop forwarding consistency ===');
check(
  'Dashboard receives result prop',
  /<Dashboard\s[\s\S]*?result=\{result\}/.test(app),
);
check(
  'ReviewQueuePage receives result prop',
  /<ReviewQueuePage\s+result=\{result\}\s*\/>/.test(app),
);

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const item of failures) {
    console.error(`- ${item.label}${item.evidence ? `: ${item.evidence}` : ''}`);
  }
  process.exit(1);
}
