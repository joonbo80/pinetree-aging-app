import type { PartyDetail } from '../../parsing-engine/types';

export type PartyCsvTab = 'transactions' | 'statements' | 'reviews' | 'duplicates';

type CsvCell = string | number | boolean | null | undefined;

function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvLine(cells: CsvCell[]): string {
  return cells.map(csvEscape).join(',');
}

function makeFilename(detail: PartyDetail, tab: PartyCsvTab): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `aging-${detail.partyKey}-${tab}-${stamp}.csv`;
}

function rowsToCsv(header: string[], rows: CsvCell[][]): string {
  return '\uFEFF' + [csvLine(header), ...rows.map(csvLine)].join('\r\n') + '\r\n';
}

function triggerDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Defer revocation so the browser download pipeline can consume the
  // blob URL. Immediate revocation can intermittently cancel downloads.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function transactionCsv(detail: PartyDetail): string {
  return rowsToCsv(
    [
      'partyKey',
      'partyName',
      'transactionId',
      'sourceType',
      'direction',
      'currency',
      'signedBalance',
      'absoluteBalance',
      'agingDays',
      'agingBucket',
      'invoiceDate',
      'postDate',
      'ourRefNo',
      'invoiceNo',
      'crdrNo',
      'blNo',
      'sourceFile',
      'sourceSheet',
      'sourceRow',
    ],
    detail.transactions.map(tx => [
      detail.partyKey,
      detail.partyName,
      tx.id,
      tx.sourceType,
      tx.direction,
      tx.currency,
      tx.signedBalance,
      tx.absoluteBalance,
      tx.agingDays,
      tx.agingBucket,
      tx.invoiceDate,
      tx.postDate,
      tx.ourRefNo,
      tx.invoiceNo,
      tx.crdrNo,
      tx.blNo,
      tx.trace.sourceFile,
      tx.trace.sourceSheet,
      tx.trace.sourceRow,
    ]),
  );
}

function statementCsv(detail: PartyDetail): string {
  return rowsToCsv(
    [
      'partyKey',
      'partyName',
      'source',
      'currency',
      'statementBalance',
      'matchType',
      'matchedTransactionId',
      'ourRefNo',
      'invoiceNo',
      'crdrNo',
      'sourceFile',
      'sourceRow',
      'referenceStatus',
      'differenceType',
    ],
    detail.statementLinks.map(link => [
      detail.partyKey,
      detail.partyName,
      link.source,
      link.currency,
      link.statementBalance,
      link.matchType,
      link.matchedTransactionId,
      link.ourRefNo,
      link.invoiceNo,
      link.crdrNo,
      link.sourceFile,
      link.sourceRow,
      link.referenceStatus,
      link.differenceType,
    ]),
  );
}

function reviewCsv(detail: PartyDetail): string {
  return rowsToCsv(
    [
      'partyKey',
      'partyName',
      'reviewItemId',
      'category',
      'reasonCode',
      'reason',
      'currency',
      'amount',
      'transactionId',
      'sourceFile',
      'sourceSheet',
      'sourceRow',
    ],
    detail.reviewItems.map(item => [
      detail.partyKey,
      detail.partyName,
      item.id,
      item.category,
      item.reasonCode,
      item.reason,
      item.currency,
      item.amount,
      item.transactionId,
      item.trace?.sourceFile,
      item.trace?.sourceSheet,
      item.trace?.sourceRow,
    ]),
  );
}

function duplicateCsv(detail: PartyDetail): string {
  return rowsToCsv(
    [
      'partyKey',
      'partyName',
      'identityKey',
      'currency',
      'memberCount',
      'potentialSignedImpact',
      'transactionId',
    ],
    detail.duplicateGroups.flatMap(group =>
      group.transactionIds.map(transactionId => [
        detail.partyKey,
        detail.partyName,
        group.identityKey,
        group.currency,
        group.count,
        group.potentialSignedImpact,
        transactionId,
      ]),
    ),
  );
}

export function exportPartyTabCsv(detail: PartyDetail, tab: PartyCsvTab): void {
  const csv =
    tab === 'transactions' ? transactionCsv(detail) :
    tab === 'statements' ? statementCsv(detail) :
    tab === 'reviews' ? reviewCsv(detail) :
    duplicateCsv(detail);

  triggerDownload(makeFilename(detail, tab), csv);
}
