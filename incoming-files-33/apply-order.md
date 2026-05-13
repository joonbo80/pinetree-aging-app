# Apply order

This is a partial replacement package. Only App.tsx + 1 new test file.

1. Copy files into the matching workspace paths:

```
v2.2-app-tsx-wireup-fix/aging-app/src/App.tsx
   -> C:\Users\samue\OneDrive\Documents\New project\aging-app\src\App.tsx

v2.2-app-tsx-wireup-fix/tools/test-app-tsx-wireup.mjs
   -> C:\Users\samue\OneDrive\Documents\New project\tools\test-app-tsx-wireup.mjs
```

2. Run new wire-up invariant test FIRST:

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project"
node .\tools\test-app-tsx-wireup.mjs
```

Expected:

```text
PASS: 14    FAIL: 0
```

3. Re-run logo invariant test (must remain unchanged):

```powershell
node .\tools\test-logo-integration.mjs
```

Expected:

```text
PASS: 32    FAIL: 0
```

4. Build:

```powershell
cd aging-app
npm.cmd run build
```

Expected: clean build, no TypeScript errors. The build emits the
bundled PartyDetailPage component (previously unreachable code path).

5. Restart dev server (kill any existing node processes first to
   ensure port 5173 is free):

```powershell
Get-Process node | Stop-Process -Force
cd "C:\Users\samue\OneDrive\Documents\New project\aging-app"
npm.cmd run dev
```

Expected: Vite on http://localhost:5173/ (NOT 5174).

6. In a separate PowerShell window, start API server:

```powershell
cd "C:\Users\samue\OneDrive\Documents\New project\aging-api"
npm.cmd run dev
```

Expected: API on http://127.0.0.1:3001 with CORS allowlist including 5173.

7. Resume Step 13 walkthrough at Scenario 3 (Top Parties click) +
   Scenario 4 (Party Detail deep dive). The previously-broken paths
   should now work:
   - Cursor changes to pointer on Top Parties row hover
   - Click navigates to /party/<partyKey>
   - Direct URL access to /party/<partyKey> shows real Party Detail
     with 4 tabs (Transactions / Statements / Reviews / Duplicates)

No database, parser, baseline data, API server code, logo/favicon
work, or v2.4 spec files are touched.
