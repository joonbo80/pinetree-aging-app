// Walkthrough rev4 document-level invariants for v2.3 C1.
//
// Pins the three preflight gap fixes discovered during v2.2 Step 13
// hands-on execution. Each invariant is a regex check against the
// canonical walkthrough markdown path. Negative invariants prevent
// regression to rev3 wording.
//
// Canonical path:
//   docs/walkthroughs/v2.2-step13-walkthrough.md
//
// Expected on rev4 fixed state:  PASS: 17   FAIL: 0
// This represents 7 invariant groups expanded into 17 sub-checks.
// Expected on rev3 broken state: at least 5 of 7 FAIL (swap-test
// proof of invariant authenticity, per v2.2 standing rule).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const walkthroughPath = resolve(
  root,
  'docs/walkthroughs/v2.2-step13-walkthrough.md',
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

// ----------------------------------------------------------------------
// Helper: extract a named section by its "## Heading" or "### Heading"
// up to the next equally-or-higher heading. Used for scoped checks.

function extractSection(text, heading) {
  // Match heading line that *starts with* the given heading text,
  // allowing trailing material like "(5 min)" on the same line.
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:^|\\n)(#{2,4})\\s*${escapedHeading}[^\\n]*\\n([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`,
    'i',
  );
  const m = text.match(re);
  return m ? m[2] : '';
}

const preflight = extractSection(doc, 'Pre-flight setup');
const scenario2 = extractSection(doc, 'Scenario 2 -- Load baseline data');

// ----------------------------------------------------------------------

section('inv-walkthrough-1: rev4 header present');
check(
  'inv-walkthrough-1: header line contains "(rev4)"',
  /^#\s+v2\.2 Step 13[^\n]*\(rev4\)/m.test(doc),
);

// ----------------------------------------------------------------------

section('inv-walkthrough-2: Gap 1 fix -- port 5173 LISTENING check');

const hasFindstrListening = /findstr ":5173"\s*\|\s*findstr LISTENING/i.test(
  preflight,
);
const hasNetTCPListen =
  /Get-NetTCPConnection\s+-LocalPort\s+5173\s+-State\s+Listen/i.test(preflight);
check(
  'inv-walkthrough-2 positive: LISTENING-filtered port check present',
  hasFindstrListening || hasNetTCPListen,
);

// Negative: bare "findstr :5173" not piped to LISTENING in actual
// command lines. We allow occurrences inside an explicit counter-
// example block. To stay safe and simple, accept either no bare
// match at all, or only inside lines that include "avoid" or
// "Do not" framing in the same line. In practice rev4 should have
// the LISTENING-piped form everywhere.
const bareFindstr = /findstr :5173(?!\s*\|\s*findstr LISTENING)/i;
check(
  'inv-walkthrough-2 negative: no bare "findstr :5173" without LISTENING',
  !bareFindstr.test(preflight),
);

// Negative: bulk Stop-Process command should appear only as a
// counter-example with "Avoid" framing. Match a forbidden positive
// recommendation (e.g. "run: Get-Process node | Stop-Process").
// Accept lines that explicitly tell user NOT to use it.
const bulkStopPosLines = preflight
  .split('\n')
  .filter((line) => /Get-Process node\s*\|\s*Stop-Process/i.test(line));
const allBulkLinesAreAvoidance = bulkStopPosLines.every((line) =>
  /\bavoid\b|\bdo not\b|\bnever\b/i.test(line),
);
check(
  'inv-walkthrough-2 negative: bulk Stop-Process appears only inside avoid/do-not framing',
  bulkStopPosLines.length === 0 || allBulkLinesAreAvoidance,
);

// ----------------------------------------------------------------------

section('inv-walkthrough-3: Gap 2 fix -- API server + env vars + 3001');

check(
  'inv-walkthrough-3a: AGING_UPLOAD_TOKEN in preflight',
  /AGING_UPLOAD_TOKEN/.test(preflight),
);
check(
  'inv-walkthrough-3b: AGING_PYTHON in preflight',
  /AGING_PYTHON/.test(preflight),
);
check(
  'inv-walkthrough-3c: AGING_PHASE1_ROOT in preflight',
  /AGING_PHASE1_ROOT/.test(preflight),
);
check(
  'inv-walkthrough-3d: 127.0.0.1:3001 referenced',
  /127\.0\.0\.1:3001/.test(preflight),
);
check(
  'inv-walkthrough-3e: explicit "NOT CONFIGURED" negative check present',
  /NOT CONFIGURED/.test(preflight),
);

// ----------------------------------------------------------------------

section('inv-walkthrough-4: Gap 3 fix -- Confirm Import + PREVIEW');

const confirmImportCount = (scenario2.match(/Confirm Import/g) || []).length;
check(
  'inv-walkthrough-4a: "Confirm Import" appears at least once in Scenario 2',
  confirmImportCount >= 1,
);
check(
  'inv-walkthrough-4b: "PREVIEW (not committed)" phrase in Scenario 2',
  /PREVIEW \(not committed\)/.test(scenario2),
);

// ----------------------------------------------------------------------

section('inv-walkthrough-5: Scenario 2 numbers updated');

check(
  'inv-walkthrough-5a: "282 statement entities" in Scenario 2',
  /282 statement entities/.test(scenario2),
);
check(
  'inv-walkthrough-5b: "439 statement links" in Scenario 2',
  /439 statement links/.test(scenario2),
);
// Negative: vague "282 statements" bare phrase must not appear
// in Scenario 2. (Revision history may contain it, that is outside
// the scenario2 scope.)
check(
  'inv-walkthrough-5c: no bare "282 statements" in Scenario 2',
  !/282 statements(?!\s*entities)/.test(scenario2),
);

// ----------------------------------------------------------------------

section('inv-walkthrough-6: UI server preflight env var');

check(
  'inv-walkthrough-6: VITE_AGING_UPLOAD_TOKEN in preflight',
  /VITE_AGING_UPLOAD_TOKEN/.test(preflight),
);

// ----------------------------------------------------------------------

section('inv-walkthrough-7: dev token security note');

check(
  'inv-walkthrough-7a: "local development only" present',
  /local development only/i.test(doc),
);
check(
  'inv-walkthrough-7b: "Microsoft Entra" OR "Teams SSO" present',
  /Microsoft Entra|Teams SSO/.test(doc),
);

// ----------------------------------------------------------------------

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const item of failures) {
    console.error(`- ${item.label}${item.evidence ? `: ${item.evidence}` : ''}`);
  }
  process.exit(1);
}
