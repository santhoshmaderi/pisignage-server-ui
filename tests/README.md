# E2E tests (Playwright)

End-to-end smoke tests for the pisignage v2 UI. See `TEST_PLAN.md` for the full
scenario list (⚙️ = automated here, 📝 = manual).

## Prerequisites
1. **pisignage-open-server running on `:3000`** with the v2 build deployed:
   ```
   npm run deploy:local        # builds and copies into ../pisignage-open-server/public/v2
   ```
   (Start the server however you normally do.)
2. Login is **pi / pi**. For richer coverage, have ≥1 registered player and ≥1
   asset so the data-dependent (📝) flows have something to act on.

## One-time setup
```
npm install                   # installs @playwright/test (added to devDependencies)
npx playwright install chromium
```

## Run
```
npm run test:e2e              # headless against http://localhost:3000/v2/
npm run test:e2e:ui           # Playwright UI mode (watch/debug)
npm run test:report           # open the last HTML report
```

Target a different host/port:
```
E2E_BASE_URL=http://192.168.0.10:3000/v2/ npm run test:e2e
```

## Notes
- Auth: the app keeps its Basic-auth header in **sessionStorage** (`pisignage.basicAuth`),
  which Playwright's `storageState` does not persist — so `tests/helpers.ts`
  seeds it via `addInitScript` (`seedAuth`) before each authed test. `auth.spec.ts`
  also exercises the real login form via `loginViaUI`.
- The automated specs are **read-only / non-destructive** (they open dialogs and
  close them, never create or delete records). Mutating flows are marked 📝 in
  `TEST_PLAN.md` and should be run manually or extended with cleanup.
- Failures capture screenshots, video, and a trace (`npm run test:report`).
