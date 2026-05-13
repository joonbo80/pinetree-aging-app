import assert from "node:assert/strict";
import { ParsingEngine } from "../parsing-engine/index.js";
import { classifyWorkbook } from "../parsing-engine/classifier.js";
import { normalizeDate } from "../parsing-engine/normalizers/date.js";

const asOfDate = "2026-05-01";
const engine = new ParsingEngine({ asOfDate });

await test("normalizeDate handles ISO, MM-DD-YY, MM/DD/YY, and Excel serial", () => {
  assert.equal(normalizeDate("2026-04-30"), "2026-04-30");
  assert.equal(normalizeDate("03-02-26"), "2026-03-02");
  assert.equal(normalizeDate("03/21/25"), "2025-03-21");
  assert.equal(normalizeDate(46142), "2026-04-30");
});

await test("classifier detects ERP workbook types", () => {
  assert.equal(classifyWorkbook(workbook("Invoice List - Close Open", [invoiceRow()])).detectedType, "INVOICE");
  assert.equal(classifyWorkbook(workbook("CR DR List", [crdrRow()])).detectedType, "CRDR");
  assert.equal(classifyWorkbook(workbook("Cost List - Close Open", [apRow()])).detectedType, "AP");
});

await test("INVOICE row parses into receivable transaction", async () => {
  const result = await engine.process([workbook("Invoice List - Close Open", [invoiceRow()])]);
  assert.equal(result.transactions.length, 1);
  const transaction = result.transactions[0];
  assert.equal(transaction.sourceType, "INVOICE");
  assert.equal(transaction.invoiceNo, "PEIN019475");
  assert.equal(transaction.partyName, "WIG BEAUTY OUTLET");
  assert.equal(transaction.currency, "CAD");
  assert.equal(transaction.direction, "receivable");
  assert.equal(transaction.signedBalance, 87.83);
  assert.equal(transaction.agingDays, 1);
  assert.equal(result.reconciliationReport.INVOICE.parsedRowCount, 1);
});

await test("INVOICE empty company with zero balance is skipped", async () => {
  const row = invoiceRow();
  row[2] = "";
  row[4] = 0;
  row[5] = 0;
  row[6] = 0;
  const result = await engine.process([workbook("Invoice List - Close Open", [row])]);
  assert.equal(result.transactions.length, 0);
  assert.equal(result.reconciliationReport.INVOICE.skippedRowCount, 1);
});

await test("CRDR negative balance becomes payable", async () => {
  const row = crdrRow();
  row[7] = -4415;
  row[8] = 0;
  row[9] = -4415;
  const result = await engine.process([workbook("CR DR List", [row])]);
  const transaction = result.transactions[0];
  assert.equal(transaction.direction, "payable");
  assert.equal(transaction.signedBalance, -4415);
  assert.equal(transaction.absoluteBalance, 4415);
});

await test("AP positive balance becomes negative signedBalance", async () => {
  const result = await engine.process([workbook("Cost List - Close Open", [apRow()])]);
  const transaction = result.transactions[0];
  assert.equal(transaction.sourceType, "AP");
  assert.equal(transaction.direction, "payable");
  assert.equal(transaction.rawBalance, 79.88);
  assert.equal(transaction.signedBalance, -79.88);
});

await test("AP negative balance raises W6 and receivable direction", async () => {
  const row = apRow();
  row[7] = -50;
  const result = await engine.process([workbook("Cost List - Close Open", [row])]);
  const transaction = result.transactions[0];
  assert.equal(transaction.direction, "receivable");
  assert.equal(transaction.signedBalance, 50);
  assert.ok(transaction.anomalyRefs.includes("W6"));
});

await test("unknown department still raises I3 after WRE mapping", async () => {
  const row = invoiceRow();
  row[15] = "CST";
  const result = await engine.process([workbook("Invoice List - Close Open", [row])]);
  const transaction = result.transactions[0];
  assert.equal(transaction.department, null);
  assert.ok(transaction.anomalyRefs.includes("I3"));
});

await test("WRE maps to GE", async () => {
  const row = invoiceRow();
  row[15] = "WRE";
  const result = await engine.process([workbook("Invoice List - Close Open", [row])]);
  const transaction = result.transactions[0];
  assert.equal(transaction.department, "GE");
  assert.ok(!transaction.anomalyRefs.includes("I3"));
});

await test("AGENT STATEMENT parser extracts block and matches CRDR", async () => {
  const crdr = crdrRow();
  crdr[1] = "PECDR016585";
  crdr[2] = "ALL CARE LOGIX CO.,LTD.";
  crdr[9] = 746.44;
  crdr[11] = "PEAE008961";
  crdr[16] = "USD";
  const result = await engine.process([workbook("CR DR List", [crdr]), agentWorkbook()]);
  assert.equal(result.statements.length, 1);
  const statement = result.statements[0];
  assert.equal(statement.partyName, "ALL CARE LOGIX");
  assert.equal(statement.currency, "USD");
  assert.equal(statement.direction, "receivable");
  assert.equal(statement.transactions.length, 1);
  assert.equal(statement.reconciliation.match, true);
  assert.equal(result.statementMatchReport.agent.statementCount, 1);
  assert.equal(result.statementMatchReport.agent.matchedRefCount, 1);
});

await test("LOCAL STATEMENT parser extracts transactions and reconciles total", async () => {
  const result = await engine.process([localWorkbook()]);
  assert.equal(result.statements.length, 1);
  const statement = result.statements[0];
  assert.equal(statement.sourceType, "LOCAL_STATEMENT");
  assert.equal(statement.partyName, "BEST LINK PAVING");
  assert.equal(statement.currency, "CAD");
  assert.equal(statement.direction, "receivable");
  assert.equal(statement.transactions.length, 1);
  assert.equal(statement.transactions[0].invoiceNo, "PEIN019247");
  assert.equal(statement.totals.balance, 275);
  assert.equal(statement.reconciliation.match, true);
});

async function test(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function workbook(sheetName, rows) {
  return {
    name: `${sheetName}.xls`,
    sheets: [{ name: sheetName, columnCount: rows[0].length, rows }],
  };
}

function invoiceRow() {
  const row = Array(26).fill(null);
  row[0] = "2026-04-30";
  row[1] = "PEIN019475";
  row[2] = "WIG BEAUTY OUTLET";
  row[4] = 87.83;
  row[5] = 0;
  row[6] = 87.83;
  row[7] = 1;
  row[11] = "328144";
  row[12] = "TRU-00376";
  row[15] = "GEN";
  row[18] = "CAD";
  row[20] = "DANNY";
  row[21] = "2026-04-30";
  row[25] = 17355;
  return row;
}

function crdrRow() {
  const row = Array(19).fill(null);
  row[0] = "2026-04-30";
  row[1] = "PECDR016797";
  row[2] = "SINO LOGISTICS (MALAYSIA)";
  row[4] = "2026-04-30";
  row[5] = "2026-04-23";
  row[6] = "2026-06-12";
  row[7] = 35;
  row[8] = 0;
  row[9] = 35;
  row[10] = "SWYYZ041614";
  row[11] = "PEOI009472";
  row[14] = "OIH";
  row[16] = "USD";
  row[17] = "ALYSHA";
  row[18] = 14116;
  return row;
}

function apRow() {
  const row = Array(25).fill(null);
  row[0] = "2026-04-30";
  row[1] = "TOTAL CUSTOMS SERVICES IN";
  row[2] = "2026-04-30";
  row[3] = "2026-04-30";
  row[4] = 79.88;
  row[5] = 0;
  row[7] = 79.88;
  row[8] = "3055675471";
  row[13] = "CUSTOMS CLEARANCE CO";
  row[14] = "328144";
  row[15] = "TRU-00376";
  row[17] = "GEN";
  row[19] = "CAD";
  row[20] = "DANNY";
  row[24] = 29944;
  return row;
}

function agentWorkbook() {
  const rows = Array.from({ length: 24 }, () => Array(20).fill(null));
  rows[3][12] = "AGENT STATEMENT";
  rows[4][1] = "TO";
  rows[4][2] = ":";
  rows[4][3] = "ALL CARE LOGIX CO.,LTD.";
  rows[4][13] = "STATEMENT DATE";
  rows[4][15] = "April 24, 2026";
  rows[6][13] = "PERIOD";
  rows[6][15] = "03/01/2026 - 03/31/2026";
  rows[7][13] = "DEPARTMENTS";
  rows[7][15] = "OI,OO,AI,AO,GE";
  rows[13][0] = "DATE";
  rows[13][3] = "OUR REF. NO";
  rows[13][9] = "B/L NO.";
  rows[13][13] = "CRDR NO.";
  rows[13][15] = "DR (+)";
  rows[13][17] = "CR (-)";
  rows[13][18] = "PAYMENT";
  rows[13][19] = "BALANCE";
  rows[15][0] = "03-02-26";
  rows[15][3] = "PEAE008961";
  rows[15][9] = "ACL-2602051";
  rows[15][13] = "PECDR016585";
  rows[15][15] = 746.44;
  rows[15][17] = 0;
  rows[15][18] = 0;
  rows[15][19] = 746.44;
  rows[17][6] = "AIR EXPORT";
  rows[17][9] = "SUB TOTAL";
  rows[17][12] = 1;
  rows[17][13] = "Record(s).";
  rows[17][15] = 746.44;
  rows[17][17] = 0;
  rows[17][18] = 0;
  rows[17][19] = 746.44;
  rows[18][3] = "GRAND TOTAL";
  rows[18][6] = 1;
  rows[18][8] = "Record(s).";
  rows[18][13] = "USD";
  rows[18][15] = 746.44;
  rows[18][17] = 0;
  rows[18][18] = 0;
  rows[18][19] = 746.44;
  rows[19][1] = "DUE TO PINETREE EXPRESS INT'L FREIGHT FORWARDING CO.";
  return { name: "AGENT STATEMENT.xls", sheets: [{ name: "Sheet1", columnCount: 20, rows }] };
}

function localWorkbook() {
  const rows = Array.from({ length: 24 }, () => Array(19).fill(null));
  rows[4][11] = "LOCAL STATEMENT";
  rows[5][1] = "TO";
  rows[5][2] = ":";
  rows[5][3] = "BEST LINK PAVING";
  rows[5][13] = "REPORT TYPE";
  rows[5][16] = "Local Invoice,Accounts Payable";
  rows[9][13] = "STATEMENT DATE";
  rows[9][16] = "April 24, 2026";
  rows[10][13] = "STATEMENT PERIOD";
  rows[10][16] = "03/01/2025 - 03/31/2026";
  rows[14][13] = "DEPARTMENTS";
  rows[14][16] = "OI,AI,AO,OO,GE";
  rows[15][0] = "INV. DATE";
  rows[15][3] = "ETD";
  rows[15][9] = "B/L NO.";
  rows[16][6] = "REF. NO.";
  rows[16][12] = "INVOICE NO.";
  rows[16][13] = "CUR";
  rows[16][15] = "CHARGE";
  rows[16][17] = "PAYMENT";
  rows[16][18] = "BALANCE";
  rows[17][0] = "DUE DATE";
  rows[17][3] = "ETA";
  rows[17][9] = "CUSTOMER REF. NO.";
  rows[18][0] = "03/25/26";
  rows[18][12] = "PEIN019247";
  rows[18][13] = "CAD";
  rows[18][14] = 275;
  rows[18][18] = 275;
  rows[19][0] = "03/25/26";
  rows[20][12] = "TOTAL";
  rows[20][13] = "CAD";
  rows[20][14] = 275;
  rows[20][16] = 0;
  rows[20][18] = 275;
  return { name: "LOCAL STATEMENT.xls", sheets: [{ name: "Sheet1", columnCount: 19, rows }] };
}
