// scripts/copy-assets.mjs
// Post-build step: copy non-TS assets that tsc does not handle.
// fs.readFileSync at runtime needs the JSON files alongside the JS output.

import { mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const PATTERNS = [/\.json$/];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (PATTERNS.some(p => p.test(entry))) out.push(full);
  }
  return out;
}

const files = walk(SRC);
let copied = 0;
for (const file of files) {
  const rel = relative(SRC, file);
  const dest = join(DIST, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(file, dest);
  console.log(`  copied  ${rel}`);
  copied++;
}
console.log(`[copy-assets] copied ${copied} file(s) to dist/`);
