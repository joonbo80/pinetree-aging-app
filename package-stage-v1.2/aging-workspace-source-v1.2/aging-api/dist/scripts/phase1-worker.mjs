import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');
const phase1Root = process.env.AGING_PHASE1_ROOT
  ? resolve(process.env.AGING_PHASE1_ROOT)
  : resolve(apiRoot, '..');

const [, , manifestPath, outputPath] = process.argv;
if (!manifestPath || !outputPath) {
  console.error('Usage: phase1-worker.mjs <manifest.json> <output.json>');
  process.exit(2);
}

const manifest = JSON.parse(stripBom(await readFile(manifestPath, 'utf-8')));
const workbookOutput = resolve(dirname(outputPath), 'workbooks.json');
const python = process.env.AGING_PYTHON || 'python';
const extractor = resolve(phase1Root, 'tools/extract_workbook.py');

await runPythonExtractor({
  python,
  extractor,
  phase1Root,
  workbookOutput,
  files: manifest.files.map(file => file.storedPath),
});

const workbooks = JSON.parse(await readFile(workbookOutput, 'utf-8'));
for (let i = 0; i < workbooks.length; i += 1) {
  const uploaded = manifest.files[i];
  if (uploaded) {
    workbooks[i].name = uploaded.originalName;
  }
}

const engineModuleUrl = pathToFileURL(resolve(phase1Root, 'parsing-engine/index.js')).href;
const { ParsingEngine } = await import(engineModuleUrl);
const engine = new ParsingEngine({
  asOfDate: manifest.asOfDate,
  user: manifest.user,
});

const rawResult = await engine.process(workbooks);
rawResult.uploadSession.importBatchId = manifest.importBatchId;
rawResult.uploadSession.files = rawResult.uploadSession.files.map((file, index) => ({
  ...file,
  sizeBytes: manifest.files[index]?.sizeBytes ?? null,
}));

await writeFile(outputPath, JSON.stringify(rawResult), 'utf-8');

async function runPythonExtractor({ python, extractor, phase1Root, workbookOutput, files }) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(python, [
      extractor,
      '--output',
      workbookOutput,
      ...files,
    ], {
      cwd: phase1Root,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf-8');
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-64 * 1024);
    });
    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`Workbook extractor failed with code ${code}. ${stderr}`.trim()));
    });
  });
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
