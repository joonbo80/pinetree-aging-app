# Apply order

This is a full replacement/new-file package.

1. Copy files into the matching workspace paths.
2. Run:

```powershell
cd aging-app
npm.cmd run build
```

3. Run:

```powershell
cd ..
node .\tools\test-logo-integration.mjs
```

Expected:

```text
PASS: 25    FAIL: 0
```

No database, parser, API, or v2.4 spec files are touched.
