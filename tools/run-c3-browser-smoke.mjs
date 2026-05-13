import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9300 + Math.floor(Math.random() * 200);
const appUrl = 'http://localhost:5173/';
const downloadDir = resolve(root, '.codex-downloads-c3');
const profileDir = join(tmpdir(), `c3-smoke-chrome-${Date.now()}`);

let seq = 0;
const pending = new Map();
let ws;
let chrome;
const events = [];
const failures = [];

function log(message) {
  console.log(message);
}

function check(name, condition, detail = '') {
  if (condition) {
    log(`PASS ${name}${detail ? ` -- ${detail}` : ''}`);
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    log(`FAIL ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

function delay(ms) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

async function httpJson(url, method = 'GET') {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
  return res.json();
}

async function waitFor(fn, timeoutMs = 10000, intervalMs = 150) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await delay(intervalMs);
  }
  throw new Error('Timed out waiting for condition');
}

function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveSend, reject) => {
    pending.set(id, { resolve: resolveSend, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }
    }, 15000);
  });
}

async function evaluate(expression, awaitPromise = true) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.exception?.value
      || result.exceptionDetails.text
      || 'Runtime.evaluate failed';
    throw new Error(String(detail));
  }
  return result.result?.value;
}

async function clickText(text) {
  return evaluate(`
    (() => {
      const matches = [...document.querySelectorAll('button, a')]
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return (el.textContent || '').includes(${JSON.stringify(text)}) &&
            !el.disabled &&
            rect.width > 0 &&
            rect.height > 0;
        });
      const target = matches[matches.length - 1];
      if (!target) return false;
      target.click();
      return true;
    })()
  `);
}

async function visibleTextIncludes(text) {
  return evaluate(`document.body.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})`);
}

async function navigate(url) {
  await send('Page.navigate', { url });
  await waitFor(async () => {
    const state = await evaluate('document.readyState');
    return state === 'complete' || state === 'interactive';
  });
}

async function setSnapshotFile(filePath) {
  const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
  const node = await send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'input[accept="application/json,.json"]',
  });
  if (!node.nodeId) throw new Error('Snapshot file input not found');
  await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [filePath] });
}

async function main() {
  if (!existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
  if (existsSync(downloadDir)) rmSync(downloadDir, { recursive: true, force: true });
  mkdirSync(downloadDir, { recursive: true });

  chrome = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--headless=old',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    appUrl,
  ], { stdio: 'ignore' });

  await waitFor(async () => {
    try {
      return await httpJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      return null;
    }
  }, 15000);

  const page = await waitFor(async () => {
    const targets = await httpJson(`http://127.0.0.1:${port}/json/list`);
    return targets.find(t => t.type === 'page' && /^https?:/.test(t.url));
  }, 15000);
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  ws.addEventListener('message', event => {
    const raw = typeof event.data === 'string'
      ? event.data
      : Buffer.from(event.data).toString('utf8');
    const message = JSON.parse(raw);
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result ?? {});
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' || message.method === 'Runtime.exceptionThrown') {
      events.push(message);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  log('=== C3 browser smoke ===');
  await navigate(appUrl);
  log(`Current URL: ${await evaluate('location.href')}`);
  await evaluate('localStorage.clear(); sessionStorage.clear();');
  await navigate(appUrl);
  await delay(2000);

  const initialText = await evaluate('document.body.innerText.slice(0, 1000)');
  log(`Initial text: ${initialText.replace(/\\s+/g, ' ').slice(0, 500)}`);
  if (!initialText.trim()) {
    log(`Console/event count before first click: ${events.length}`);
    for (const event of events.slice(0, 5)) {
      log(JSON.stringify(event).slice(0, 500));
    }
  }
  check('initial page shows Load Baseline Demo', await visibleTextIncludes('Load Baseline Demo'));

  check('click Load Baseline Demo', await clickText('Load Baseline Demo'));
  await waitFor(() => visibleTextIncludes('Confirm Import'), 15000);
  check('baseline preview reaches Confirm Import', await visibleTextIncludes('Confirm Import'));
  check('click Confirm Import opens modal', await clickText('Confirm Import'));
  await waitFor(() => visibleTextIncludes('This will load the parsed data into the workspace.'), 5000);
  check('confirm modal body visible', await visibleTextIncludes('This will load the parsed data into the workspace.'));
  check('click Confirm Import in modal', await clickText('Confirm Import'));
  try {
    await waitFor(() => visibleTextIncludes('Open Collection Workbench'), 15000);
  } catch (err) {
    const text = await evaluate('document.body.innerText.slice(0, 2000)');
    log(`After confirm text: ${text.replace(/\\s+/g, ' ').slice(0, 1000)}`);
    throw err;
  }
  check('dashboard appears after confirm', await visibleTextIncludes('Open Collection Workbench'));
  log(`Snapshot storage length after confirm: ${await evaluate(`(localStorage.getItem('agingApp.committedSnapshot.v1') || '').length`)}`);

  await navigate(`${appUrl}aging`);
  try {
    await waitFor(() => visibleTextIncludes('Statement Collection Workbench'), 10000);
  } catch (err) {
    const text = await evaluate('document.body.innerText.slice(0, 2000)');
    log(`After /aging navigation text: ${text.replace(/\\s+/g, ' ').slice(0, 1000)}`);
    log(`After /aging URL: ${await evaluate('location.href')}`);
    throw err;
  }
  check('aging workbench visible', await visibleTextIncludes('Statement Collection Workbench'));
  const agingText = await evaluate('document.body.innerText.slice(0, 2000)');
  log(`Aging text: ${agingText.replace(/\\s+/g, ' ').slice(0, 800)}`);
  check('current count 21 visible', await visibleTextIncludes('Current') && await visibleTextIncludes('21'));
  check('overdue count 463 visible', await visibleTextIncludes('Overdue') && await visibleTextIncludes('463'));
  check('no due date count 118 visible', await visibleTextIncludes('118'));
  check('cleared count 628 visible', await visibleTextIncludes('Cleared') && await visibleTextIncludes('628'));

  await navigate(`${appUrl}aging`);
  try {
    await waitFor(() => visibleTextIncludes('Statement Collection Workbench'), 10000);
  } catch (err) {
    const text = await evaluate('document.body.innerText.slice(0, 2000)');
    log(`After hard-load text: ${text.replace(/\\s+/g, ' ').slice(0, 1000)}`);
    throw err;
  }
  check('/aging hard-load restores snapshot', await visibleTextIncludes('Statement Collection Workbench') && await visibleTextIncludes('463'));
  check('snapshot storage remains available after hard-load', Boolean(await evaluate(`localStorage.getItem('agingApp.committedSnapshot.v1')`)));

  await navigate(appUrl);
  await waitFor(() => visibleTextIncludes('Export Snapshot'), 10000);
  check('snapshot export button visible', await visibleTextIncludes('Export Snapshot'));
  check('click Export Snapshot', await clickText('Export Snapshot'));
  await delay(1000);
  const downloaded = readdirSync(downloadDir).filter(name => name.endsWith('.json'));
  check('snapshot file downloaded', downloaded.length >= 1, downloaded.join(', '));
  const snapshotFile = resolve(downloadDir, downloaded[0]);
  const snapshotRaw = readFileSync(snapshotFile, 'utf8');
  const snapshotJson = JSON.parse(snapshotRaw);
  check('downloaded snapshot envelope version', snapshotJson.snapshotVersion === 'v2.3-c3-snapshot-v1');
  check('downloaded snapshot keeps 1230 transactions', snapshotJson.summary?.transactionCount === 1230);
  check('downloaded snapshot size is non-empty', statSync(snapshotFile).size > 1000000, `${statSync(snapshotFile).size} bytes`);

  check('click Clear', await clickText('Clear'));
  await waitFor(() => visibleTextIncludes('No data loaded yet'), 10000);
  check('clear returns to no data state', await visibleTextIncludes('No data loaded yet'));

  await setSnapshotFile(snapshotFile);
  await waitFor(() => visibleTextIncludes('Open Collection Workbench'), 10000);
  check('import snapshot navigates to dashboard', await visibleTextIncludes('Open Collection Workbench'));
  check('snapshot import notice shown', await visibleTextIncludes('Snapshot imported'));

  check('open workbench after snapshot import', await clickText('Open Collection Workbench'));
  await navigate(`${appUrl}aging`);
  await waitFor(() => visibleTextIncludes('Statement Collection Workbench'), 10000);
  check('workbench restored after snapshot import', await visibleTextIncludes('Statement Collection Workbench') && await visibleTextIncludes('463'));

  const redFlags = events.filter(event => {
    if (event.method === 'Runtime.exceptionThrown') return true;
    const args = event.params?.args ?? [];
    const text = args.map(a => a.value ?? a.description ?? '').join(' ');
    return /NaN|undefined|\[object Object\]/.test(text);
  });
  check('no console exceptions / NaN / undefined smell', redFlags.length === 0, `${redFlags.length} events`);

  log(`\nDownload dir: ${downloadDir}`);
  log(`PASS: ${33 - failures.length}    FAIL: ${failures.length}`);
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
}

main().finally(async () => {
  try { ws?.close(); } catch {}
  try { chrome?.kill(); } catch {}
});
