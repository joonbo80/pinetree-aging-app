// components/aging/exportCsv.ts
//
// Pure CSV builder for the v2.3 Statement Collection Workbench.
// Round 6 scope: party-rollup-level CSV export only. Orphan
// NOT_IN_ERP_EXTRACT statement rows remain in Review Queue workflow.

import type { AgingFilterState } from '../../hooks/useAgingFilters';
import type { AgingReportData, PartyRollup, TabId } from '../../selectors/agingReport';
import { filterAgingTabData } from './agingFilterLogic.ts';

export type AgingCsvScope = 'filtered' | 'all';

export interface BuildAgingCsvOptions {
  report: AgingReportData;
  scope: AgingCsvScope;
  filters?: AgingFilterState;
}

export interface AgingCsvResult {
  filename: string;
  content: string;
  byteSize: number;
  rowCount: number;
}

const UTF8_BOM = '\uFEFF';

const CSV_COLUMNS = [
  'Tab',
  'PartyKey',
  'PartyName',
  'Currency',
  'Direction',
  'OpenAmount',
  'OldestAgingDays',
  'InvoiceCount',
  'StatementStatus',
  'ActionReadiness',
  'PriorityBand',
  'HighAmount',
  'NinetyPlus',
  'HasDuplicate',
  'MissingDueDate',
] as const;

interface CsvRow {
  tab: TabId;
  row: PartyRollup;
}

export function buildAgingCsv({
  report,
  scope,
  filters,
}: BuildAgingCsvOptions): AgingCsvResult {
  const rows = collectCsvRows(report, scope, filters);
  const body = [
    CSV_COLUMNS.join(','),
    ...rows.map(({ tab, row }) => serializeCsvRow(tab, row)),
  ].join('\r\n');
  const content = `${UTF8_BOM}${body}\r\n`;
  const filename = `aging-${report.asOfDate || 'unknown'}-${buildFilterSummary(
    scope,
    filters,
  )}.csv`;
  const encoder = new TextEncoder();

  return {
    filename,
    content,
    byteSize: encoder.encode(content).byteLength,
    rowCount: rows.length,
  };
}

export function collectCsvRows(
  report: AgingReportData,
  scope: AgingCsvScope,
  filters?: AgingFilterState,
): CsvRow[] {
  return (['current', 'overdue', 'cleared'] as TabId[]).flatMap((tab) => {
    const tabData =
      scope === 'filtered' && filters
        ? filterAgingTabData(report.tabs[tab], filters)
        : report.tabs[tab];
    return tabData.parties.map((row) => ({ tab, row }));
  });
}

export function buildFilterSummary(
  scope: AgingCsvScope,
  filters?: AgingFilterState,
) {
  if (scope === 'all' || !filters) return 'all';

  const parts: string[] = [];
  parts.push(...[...filters.currencies].sort());
  parts.push(
    ...[...filters.directions]
      .map((direction) =>
        direction === 'receivable'
          ? 'AR'
          : direction === 'payable'
            ? 'AP'
            : 'Settled',
      )
      .sort(),
  );
  parts.push(...[...filters.signals].sort());

  return parts.length === 0 ? 'all' : parts.join('-');
}

export function escapeCsvField(value: string | number | boolean | null) {
  const text = value === null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serializeCsvRow(tab: TabId, row: PartyRollup) {
  const values = [
    formatTab(tab),
    row.partyKey,
    row.partyName,
    row.currency,
    formatDirection(row.direction),
    formatDecimal(row.openAmount),
    row.oldestAgingDays,
    row.invoiceCount,
    row.statementStatus,
    row.actionReadiness,
    row.priorityBand,
    Math.abs(row.openAmount) >= 10000,
    row.ninetyPlusCount > 0,
    row.actionReadiness === 'CheckDuplicate',
    row.actionReadiness === 'MissingDueDate',
  ];

  return values.map(escapeCsvField).join(',');
}

function formatTab(tab: TabId) {
  switch (tab) {
    case 'current':
      return 'Current';
    case 'overdue':
      return 'Overdue';
    case 'cleared':
      return 'Cleared';
  }
}

function formatDirection(direction: PartyRollup['direction']) {
  switch (direction) {
    case 'receivable':
      return 'AR';
    case 'payable':
      return 'AP';
    case 'settled':
      return 'Settled';
  }
}

function formatDecimal(value: number) {
  return value.toFixed(2);
}
