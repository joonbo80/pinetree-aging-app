// Logo + favicon integration invariants.
// Keeps the logo work pinned to the v2.2 logo micro-spec:
// - Pinetree logo remains an external company-site link.
// - Header image is bundled from src/assets.
// - Browser favicon files exist and are referenced by index.html.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const app = join(root, 'aging-app');
const headerPath = join(app, 'src/components/Header.tsx');
const cssPath = join(app, 'src/styles/global.css');
const htmlPath = join(app, 'index.html');
const publicDir = join(app, 'public');
const assetsDir = join(app, 'src/assets');
const distDir = join(app, 'dist');

const header = readFileSync(headerPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const html = readFileSync(htmlPath, 'utf8');

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

function fileExists(path, minBytes = 1) {
  return existsSync(path) && statSync(path).size >= minBytes;
}

console.log('\n=== Logo asset files ===');
check('header logo asset exists', fileExists(join(assetsDir, 'pte-logo-header.png'), 1000));
check('favicon 16 source exists', fileExists(join(assetsDir, 'pte-favicon-16.png'), 100));
check('favicon 32 source exists', fileExists(join(assetsDir, 'pte-favicon-32.png'), 100));
check('favicon 48 source exists', fileExists(join(assetsDir, 'pte-favicon-48.png'), 100));
check('public favicon.ico exists', fileExists(join(publicDir, 'favicon.ico'), 1000));
check('public favicon 16 exists', fileExists(join(publicDir, 'pte-favicon-16.png'), 100));
check('public favicon 32 exists', fileExists(join(publicDir, 'pte-favicon-32.png'), 100));

console.log('\n=== index.html references ===');
check('title contains Pinetree Express', /<title>[^<]*Pinetree Express[^<]*<\/title>/.test(html));
check('title contains AGING APP', /<title>[^<]*AGING APP[^<]*<\/title>/.test(html));
check('index references favicon.ico', html.includes('href="/favicon.ico"'));
check('index references 32px png favicon', html.includes('href="/pte-favicon-32.png"'));
check('index references 16px png favicon', html.includes('href="/pte-favicon-16.png"'));

console.log('\n=== Header behavior ===');
check('Header imports pte logo asset', header.includes("import pteLogoHeader from '../assets/pte-logo-header.png'"));
check('Header renders logo image', /<img[\s\S]*src=\{pteLogoHeader\}/.test(header));
check('Header logo has non-empty alt text', /<img[\s\S]*alt="Pinetree Express"/.test(header));
check('Header external href preserved', header.includes('href="https://pinetreeexpress.com"'));
check('Header external target preserved', header.includes('target="_blank"'));
check('Header noopener noreferrer preserved', header.includes('rel="noopener noreferrer"'));
check('Header does not route logo to dashboard', !/href=\{?['"`]\/dashboard/.test(header));
check('Old PINETREE text marker removed', !/>PINETREE</.test(header));

console.log('\n=== Header CSS ===');
check('Logo image class styled', css.includes('.app-brand-logo-img'));
check('Old diamond pseudo marker removed', !css.includes('.app-brand-logo::before'));
check('Logo focus-visible style exists', css.includes('.app-brand-logo:focus-visible'));

console.log('\n=== Optional dist verification ===');
if (existsSync(distDir)) {
  const assetFiles = readdirSync(join(distDir, 'assets'), { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name);
  check('dist includes bundled pte logo asset', assetFiles.some(name => /^pte-logo-header-.*\.png$/.test(name)));
  check('dist favicon.ico exists', fileExists(join(distDir, 'favicon.ico'), 1000));
} else {
  console.log('SKIP dist checks (run npm run build to enable)');
}

console.log(`\nPASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  console.error('\nFailures:');
  for (const item of failures) {
    console.error(`- ${item.label}${item.evidence ? `: ${item.evidence}` : ''}`);
  }
  process.exit(1);
}
