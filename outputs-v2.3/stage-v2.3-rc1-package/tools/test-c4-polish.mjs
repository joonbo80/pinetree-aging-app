// tools/test-c4-polish.mjs
//
// C4 selective polish invariants.
// Focus: mojibake cleanup, bundled baseline extraction, Dashboard CTA,
// and build output chunk warning prevention.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const appPath = resolve(root, 'aging-app/src/App.tsx');
const dashboardPath = resolve(root, 'aging-app/src/components/dashboard/Dashboard.tsx');
const vitePath = resolve(root, 'aging-app/vite.config.ts');
const apiPackagePath = resolve(root, 'aging-api/package.json');
const apiHealthPath = resolve(root, 'aging-api/src/routes/health.ts');
const publicBaselinePath = resolve(
  root,
  'aging-app/public/baselines/phase1-v1.3.0.json',
);
const srcBaselinePath = resolve(
  root,
  'aging-app/src/baselines/phase1-v1.3.0.json',
);
const distAssetsPath = resolve(root, 'aging-app/dist/assets');

const app = readFileSync(appPath, 'utf8');
const dashboard = readFileSync(dashboardPath, 'utf8');
const viteConfig = readFileSync(vitePath, 'utf8');
const apiPackage = JSON.parse(readFileSync(apiPackagePath, 'utf8'));
const apiHealth = readFileSync(apiHealthPath, 'utf8');
const appBytes = readFileSync(appPath);

let pass = 0;
let fail = 0;

function check(label, condition) {
  if (condition) {
    pass += 1;
    console.log(`PASS ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}`);
  }
}

function hasMojibake(text) {
  return /Â|â€|Ã|�/.test(text);
}

console.log('=== C4 mojibake cleanup ===');

check('App.tsx has no known mojibake markers', !hasMojibake(app));
check(
  'App.tsx has no UTF-8 BOM',
  !(appBytes[0] === 0xef && appBytes[1] === 0xbb && appBytes[2] === 0xbf),
);
check('Dashboard.tsx has no known mojibake markers', !hasMojibake(dashboard));
check('vite.config.ts has no known mojibake markers', !hasMojibake(viteConfig));

console.log('=== C4 bundled baseline extraction ===');

check(
  'App.tsx no longer statically imports phase1 baseline JSON',
  !/import\s+\w+\s+from\s+['"]\.\/baselines\/phase1-v1\.3\.0\.json['"]/.test(app),
);
check(
  'App.tsx loads bundled baseline via fetch',
  app.includes('async function loadBundledBaseline') &&
    app.includes("baselines/phase1-v1.3.0.json") &&
    app.includes('await fetch'),
);
check('public baseline copy exists', existsSync(publicBaselinePath));
check('source baseline remains for invariant suites', existsSync(srcBaselinePath));
check(
  'public baseline size matches source baseline size',
  existsSync(publicBaselinePath) &&
    existsSync(srcBaselinePath) &&
    statSync(publicBaselinePath).size === statSync(srcBaselinePath).size,
);

console.log('=== C4 Dashboard CTA polish ===');

const ctaMatches = dashboard.match(/Open Collection Workbench/g) ?? [];
check('Dashboard CTA label appears exactly once', ctaMatches.length === 1);
check(
  'Dashboard CTA is rendered as independent block',
  dashboard.includes('className="dashboard-workbench-cta"') &&
    dashboard.indexOf('className="dashboard-workbench-cta"') <
      dashboard.indexOf('<span className="panel-title">Aging Bucket</span>'),
);

console.log('=== C4 API version hygiene ===');

const serviceVersionMatch = apiHealth.match(/SERVICE_VERSION\s*=\s*['"]([^'"]+)['"]/);
check(
  'API health SERVICE_VERSION matches aging-api package version',
  !!serviceVersionMatch && serviceVersionMatch[1] === apiPackage.version,
);

console.log('=== C4 debug hygiene ===');

check(
  'App.tsx has no console logging',
  !/console\.(log|debug|warn|error)/.test(app),
);
check(
  'Dashboard.tsx has no console logging',
  !/console\.(log|debug|warn|error)/.test(dashboard),
);

console.log('=== C4 build output size ===');

if (existsSync(distAssetsPath)) {
  const jsAssets = readdirSync(distAssetsPath)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({
      name,
      size: statSync(resolve(distAssetsPath, name)).size,
    }));
  const largestJs = jsAssets.sort((a, b) => b.size - a.size)[0];
  check('dist has at least one JS asset', jsAssets.length > 0);
  check(
    'largest JS asset is below Vite 500KB warning threshold',
    !!largestJs && largestJs.size < 500 * 1024,
  );
} else {
  check('dist assets directory exists after build', false);
  check('largest JS asset is below Vite 500KB warning threshold', false);
}

console.log(`PASS: ${pass}    FAIL: ${fail}`);
if (fail > 0) {
  process.exitCode = 1;
}
