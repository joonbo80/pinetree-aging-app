// tools/test-v2.3-f1-walkthrough.mjs
//
// F1 document-level invariants for the v2.3 hands-on walkthrough.
// The main correction pinned here is J's Step 21 catch:
// bucket breakdown is read-only summary only; no bucket click filter.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const walkthroughPath = resolve(
  root,
  'docs/walkthroughs/v2.3-f1-hands-on-walkthrough.md',
);
const doc = readFileSync(walkthroughPath, 'utf8');

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

function section(name) {
  console.log(`\n=== ${name} ===`);
}

function extractSection(text, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:^|\\n)(#{2,4})\\s*${escapedHeading}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`,
    'i',
  );
  const match = text.match(re);
  return match ? match[2] : '';
}

const preflight = extractSection(doc, 'Pre-flight');
const scenario7 = extractSection(doc, 'Scenario 7 - Step 21, Overdue Aging Breakdown');
const signoff = extractSection(doc, 'Sign-off Conditions');

section('f1-1: canonical document header');
check('F1 title present', /^# v2\.3 F1 Hands-on Walkthrough/m.test(doc));
check('date is 2026-05-13', /Date: 2026-05-13/.test(doc));
check('v2.3 Overall Spec rev5 referenced', /v2\.3 Overall Spec rev5, frozen/.test(doc));

section('f1-2: preflight links C1/C2/C4');
check('C1 17/0 expected', /test-walkthrough-rev4\.mjs/.test(preflight) && /PASS: 17\s+FAIL: 0/.test(preflight));
check('C2 total 228/0 expected', /Expected total: `PASS: 228\s+FAIL: 0`/.test(preflight));
check('C4 16/0 expected', /test-c4-polish\.mjs/.test(preflight) && /PASS: 16\s+FAIL: 0/.test(preflight));
check('production build step present', /npm\.cmd run build/.test(preflight));
check('old bundle warning prevention pinned', /no Vite chunk-size warning/.test(preflight));
check('LISTENING-only port check present', /Get-NetTCPConnection\s+-LocalPort\s+5173\s+-State\s+Listen/.test(preflight));
check('API token env var present', /AGING_UPLOAD_TOKEN/.test(preflight));
check('UI token env var present', /VITE_AGING_UPLOAD_TOKEN/.test(preflight));

section('f1-3: baseline and C2 counts pinned');
check('baseline transactions 1,230 pinned', /Transactions\s*\|\s*1,230/.test(doc));
check('statement entities 282 pinned', /Statement entities\s*\|\s*282/.test(doc));
check('statement links 439 pinned', /Statement links\s*\|\s*439/.test(doc));
check('review items 234 pinned', /Review items\s*\|\s*234/.test(doc));
check('duplicate groups 40 pinned', /Duplicate groups\s*\|\s*40/.test(doc));
check('Current 21 pinned', /Current\s*\|\s*21/.test(doc));
check('Overdue 463 pinned', /Overdue\s*\|\s*463/.test(doc));
check('No Due Date open 118 pinned', /No Due Date, open\s*\|\s*118/.test(doc));
check('Cleared 628 pinned', /Cleared\s*\|\s*628/.test(doc));
check('Total coverage 1,230 pinned', /Total coverage\s*\|\s*1,230/.test(doc));

section('f1-4: Step 21 correction pinned');
check('Step 21 section exists', scenario7.length > 0);
check('Step 21 says read-only', /Step 21 is read-only/.test(scenario7));
check('Step 21 forbids bucket click filtering', /Do not test or document bucket-click filtering/.test(scenario7));
check('Step 21 requires no bucket click behavior', /There is no bucket click to filter behavior/.test(scenario7));
check('0-30 bucket count 213 pinned', /0-30\s*\|\s*213/.test(scenario7));
check('31-60 bucket count 204 pinned', /31-60\s*\|\s*204/.test(scenario7));
check('61-90 bucket count 33 pinned', /61-90\s*\|\s*33/.test(scenario7));
check('90+ bucket count 13 pinned', /90\+\s*\|\s*13/.test(scenario7));
check('USD/CAD separation required', /USD\/CAD separation/.test(scenario7));
check('AR/AP separation required', /AR\/AP separation/.test(scenario7));
check('negative: no bucket click arrow filter wording', !/Bucket click\s*(?:->|→)\s*filter/i.test(doc));

section('f1-5: release-candidate signoff');
check('signoff requires C1 17/0', /C1 invariants pass `17 \/ 0`/.test(signoff));
check('signoff requires C2 228/0', /C2 invariants pass `228 \/ 0`/.test(signoff));
check('signoff requires C4 16/0', /C4 invariants pass `16 \/ 0`/.test(signoff));
check('signoff requires no BLOCKER findings', /no BLOCKER findings/.test(signoff));
check('signoff preserves Step 21 correction', /Step 21 remains read-only/.test(signoff));

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const item of failures) {
    console.error(`- ${item.label}${item.evidence ? `: ${item.evidence}` : ''}`);
  }
  process.exit(1);
}
