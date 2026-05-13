// tools/test-party-detail-page-step10.mjs
//
// Phase 2 v2.2 Step 10 regression — Trace panel unification (Option C).
//
// Goals verified:
//   1. Single TracePanel component exists and is used by all 3 tabs
//   2. The 3 wrappers (TransactionTracePanel / StatementTracePanel /
//      ReviewTracePanel) still exist as call-site stable APIs but
//      delegate to TracePanel
//   3. TracePanelModel has the agreed Option C shape:
//        source / identity / linkedRecord / details / notes
//      and the Phase 3 reservation is documented but unimplemented
//   4. Hook hygiene boundary fixes are pinned (per absorption note):
//        a. unused focusedTx memo removed
//        b. focusedTxId in transactions rows useMemo deps
//        c. isStrictNotInErp wrapped in useCallback
//        d. StatementLink type alias present
//      AND useCallback is imported

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, '../aging-app/src/components/party/PartyDetailPage.tsx');
const source = readFileSync(sourcePath, 'utf-8');

let pass = 0, fail = 0;
const failures = [];

function check(label, ok, evidence = '') {
  if (ok) { pass++; console.log(`  \u2705 ${label}`); }
  else { fail++; failures.push({ label, evidence }); console.error(`  \u274c ${label}${evidence ? ' \u2014 ' + evidence : ''}`); }
}

// ============================================================
// A. Unified TracePanel exists with Option C shape
// ============================================================
console.log('\n=== A. Unified TracePanel (Option C shape) ===');

check(`TracePanel component defined`,
      source.includes('function TracePanel(') &&
      source.includes('model: TracePanelModel'));
check(`TracePanelModel interface defined`,
      source.includes('interface TracePanelModel'));
check(`TracePanel takes optional onFocusTransaction`,
      /onFocusTransaction\?:\s*\(txId: string\) => void;?/.test(source));

// Section interfaces
check(`TraceSource interface (file/sheet/row)`,
      source.includes('interface TraceSource'));
check(`TraceIdentity interface (fields)`,
      source.includes('interface TraceIdentity'));
check(`TraceLinkedRecord interface`,
      source.includes('interface TraceLinkedRecord'));
check(`TraceDetailGroup interface`,
      source.includes('interface TraceDetailGroup'));
check(`TraceNote interface`,
      source.includes('interface TraceNote'));
check(`TraceEntry interface`,
      source.includes('interface TraceEntry'));

// Model assembles the Option C sections
check(`TracePanelModel.source is OPTIONAL (review items can lack trace)`,
      /source\?:\s*TraceSource/.test(source));
check(`TracePanelModel.identity exists (optional)`,
      /identity\?:\s*TraceIdentity/.test(source));
check(`TracePanelModel.linkedRecord exists (optional)`,
      /linkedRecord\?:\s*TraceLinkedRecord/.test(source));
check(`TracePanelModel.details exists (array of groups)`,
      /details\?:\s*TraceDetailGroup\[\]/.test(source));
check(`TracePanelModel.notes exists (array)`,
      /notes\?:\s*TraceNote\[\]/.test(source));

// ============================================================
// B. Phase 3 reservation present but unimplemented (per Option C)
// ============================================================
console.log('\n=== B. Phase 3 reservation (named only, intentionally not implemented) ===');

check(`Phase 3 reservation comment block present`,
      source.includes('Phase 3 reserved') ||
      source.includes('Phase 3 reservation'));
check(`activity? reserved (commented or in interface)`,
      source.includes('activity?') || source.includes('CollectionActivity'));
check(`status? reserved`,
      /status\?:\s*Collection|status\?\s*--?\s*Collection/.test(source) ||
      source.includes('CollectionStatus'));
check(`nextAction? reserved`,
      source.includes('nextAction?') || source.includes('CollectionNextAction'));

// Critical: Phase 3 enums must NOT be defined yet (avoid premature lock-in)
check(`No CollectionStatus enum/type defined yet`,
      !/^(export\s+)?(type|enum)\s+CollectionStatus\b/m.test(source));
check(`No CollectionActivity type defined yet`,
      !/^(export\s+)?(type|interface)\s+CollectionActivity\b/m.test(source));
check(`No CollectionNextAction type defined yet`,
      !/^(export\s+)?(type|interface)\s+CollectionNextAction\b/m.test(source));

// ============================================================
// C. 3 wrappers still exist (API stability for call sites)
// ============================================================
console.log('\n=== C. Wrapper functions (API stability) ===');

check(`TransactionTracePanel wrapper present`,  source.includes('function TransactionTracePanel('));
check(`StatementTracePanel wrapper present`,    source.includes('function StatementTracePanel('));
check(`ReviewTracePanel wrapper present`,        source.includes('function ReviewTracePanel('));

// All 3 must delegate to TracePanel
const txPanel  = source.slice(source.indexOf('function TransactionTracePanel('),
                              source.indexOf('function TransactionTracePanel(') + 2500);
const stmtPanel = source.slice(source.indexOf('function StatementTracePanel('),
                                source.indexOf('function StatementTracePanel(') + 3500);
const revPanel = source.slice(source.indexOf('function ReviewTracePanel('),
                                source.indexOf('function ReviewTracePanel(') + 3500);

check(`TransactionTracePanel uses <TracePanel`,
      txPanel.includes('<TracePanel'));
check(`StatementTracePanel uses <TracePanel`,
      stmtPanel.includes('<TracePanel'));
check(`ReviewTracePanel uses <TracePanel`,
      revPanel.includes('<TracePanel'));

// All 3 must construct TracePanelModel
check(`TransactionTracePanel builds TracePanelModel`,
      txPanel.includes('TracePanelModel'));
check(`StatementTracePanel builds TracePanelModel`,
      stmtPanel.includes('TracePanelModel'));
check(`ReviewTracePanel builds TracePanelModel`,
      revPanel.includes('TracePanelModel'));

// ============================================================
// D. Hook hygiene boundary fixes pinned (per absorption note)
// ============================================================
console.log('\n=== D. Hook hygiene boundary fixes (Step 9 absorption) ===');

// (a) useCallback imported
check(`useCallback imported from react`,
      /import\s*{[^}]*\buseCallback\b[^}]*}\s*from\s*['"]react['"]/.test(source));

// (b) unused focusedTx memo NOT present
check(`No unused focusedTx memo (was: const focusedTx = useMemo)`,
      !/const\s+focusedTx\s*=\s*useMemo/.test(source));

// (c) Transactions rows useMemo includes focusedTxId in deps
check(`Transactions rows useMemo deps include focusedTxId`,
      source.includes('[detail.transactions, currency, direction, focusedTxId, query, sortMode]'));

// (d) isStrictNotInErp wrapped in useCallback
check(`isStrictNotInErp wrapped in useCallback`,
      /isStrictNotInErp\s*=\s*useCallback\(/.test(source));

// (e) StatementLink type alias present
check(`StatementLink type alias present`,
      /type\s+StatementLink\s*=\s*PartyDetail\['statementLinks'\]\[number\]/.test(source));

// (f) Statements rows useMemo deps use isStrictNotInErp (not strictNotInErpKeys)
check(`Statements rows useMemo deps use isStrictNotInErp callback ref`,
      source.includes('[detail.statementLinks, source, match, currency, query, isStrictNotInErp]'));

// ============================================================
// E. UI invariants preserved (refactor changed nothing user-visible)
// ============================================================
console.log('\n=== E. UI invariants preserved ===');

// Critical labels still present in output (model values)
check(`"Source File" label still rendered (literal)`,
      source.includes("label: 'Source File'"));
check(`"Source Row" label still rendered (literal)`,
      source.includes("label: 'Source Row'"));
check(`"Party Name" label still rendered (v2.1.1 invariant)`,
      source.includes("label: 'Party Name'"));
check(`"Transaction ID" label still rendered`,
      source.includes("label: 'Transaction ID'"));

// rawRow still suppressed (spec §1.7)
check(`rawRow still NOT shown`,
      !source.includes('rawRow') && !source.includes("'Raw Row'") && !source.includes('"Raw Row"'));

// Cross-tab focus jump label preserved
check(`"View this transaction in Transactions tab" preserved`,
      source.includes('View this transaction in Transactions tab'));

// Statement-specific labels
check(`"Statement status fields" section name preserved (Step 7 S6)`,
      source.includes('STATEMENT STATUS FIELDS'));
check(`"Confirmed not in ERP" / "Not in uploaded ERP extract" labels preserved`,
      source.includes('Confirmed not in ERP') &&
      source.includes('Not in uploaded ERP extract'));

// Review-specific
check(`"REASON" prose section name preserved`,
      source.includes("label: 'REASON'"));
check(`"LINKED TRANSACTION" linked record label preserved`,
      source.includes("label: 'LINKED TRANSACTION'"));

// ============================================================
// F. ReviewTracePanel handles missing trace gracefully
//    (3 of 234 review items in baseline have no trace)
// ============================================================
console.log('\n=== F. Defensive: review items without trace ===');

check(`ReviewTracePanel guards item.trace presence`,
      revPanel.includes('item.trace ?'));
check(`TracePanel renders without source when source is undefined`,
      // The conditional spread for source fields
      /model\.source\s*\?\s*\[/.test(source));

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
