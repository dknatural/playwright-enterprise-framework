# Enterprise Playwright + TypeScript framework

## Quick start

1. Install Node.js 22+ and ensure a PostgreSQL test database and application are available.
2. Run `npm install` and `npx playwright install` (or `npx playwright install --with-deps` on Linux).
3. Copy `.env.example` to `.env` and configure test environment values. Never commit `.env`.
4. Run `npm run typecheck` then `npm test`.

## Commands

- `npm test` — Chromium, visible browser
- `npm run test:ui` — Chromium project
- `npm run test:headed` — Chromium, visible browser, one worker
- `npm run test:debug` — Playwright Inspector
- `npm run test:hybrid` — hybrid tests
- `npm run test:staging` — load `.env.staging` (if present)
- `npx playwright test tests/hybrid/user-workflow.spec.ts --project=chromium` — one test file
- `npx playwright test -g "create user" --project=chromium` — title filter
- `npm run report` — open HTML report
- `npm run allure:clean` — clear previous Allure results before a fresh run
- `npm run allure:generate` — generate the Allure HTML report from the latest run
- `npm run allure:open` — open the generated Allure report (requires Java 17+)
- `npm run allure:failure-demo` — run the passing login test and an intentional
  failure in visible Chromium to demonstrate the screenshot attachment; this command
  is expected to exit with a failure.

Clear old results, run tests, then generate the HTML report. Failed tests include
a screenshot attachment in Allure. Playwright trace capture is disabled.
Both CI pipelines archive the Allure report and raw results alongside Playwright
HTML, JUnit, and trace artifacts. The Allure command-line report generator requires
Java 17+.

## Application contract (adapt to your system)

- UI `/login` with accessible Email, Password fields and Sign in button.
- POST `/api/users` creates a user and returns `{ id, email, displayName, status }` with HTTP 201.
- GET `/api/users/:id` returns that user.
- DELETE `/api/users/:id` deletes the user.
- Database table `users(id, email, display_name, status)`.
- Created users are immediately active and can log in with their supplied password.
- UI displays the user's `displayName` after login.

These are **example contracts**, not a runnable demo backend. Tests will not pass until connected to an application matching them. Ensure the API token has limited test-only privileges.

## Architecture and reliability notes

- UI page objects own selectors; tests own assertions and workflows.
- API clients use Playwright's isolated `request` fixture and optional bearer token.
- DB helper uses parameterized SQL and supports explicit transactions.
- Each test creates uniquely named users and deletes them in `finally`.
- Do not mutate production data or store secrets in source control.
- For larger suites, replace per-test DB pools with a worker-scoped fixture; use migrations and disposable test environments.
- Do not log raw API responses containing secrets; redact tokens in CI artifacts.
- Do not rely on fixed sleeps; use locators and `expect.poll` for eventual consistency.
- Browser retries in CI are for diagnosing flakes, not hiding defects.

## Production adoption checklist

Add authentication-state setup, accessibility checks, linting, dependency pinning with a committed lockfile, containerized test databases, test-data factories, API schema validation, coverage mapping, and CI network controls appropriate to your system.

## CI/CD: GitHub Actions and Jenkins

The workflows **run automated tests**; they do not deploy the application. Run them
against an isolated, seeded QA/staging environment. Never point write-capable hybrid
tests at production. Local `npm test` runs visible Chromium; CI explicitly runs
headless browser projects. Both pipelines run `npm ci`, typecheck, and Playwright, generate
Allure reports, and preserve JUnit XML, Allure, and Playwright HTML/trace artifacts.

### GitHub Actions (`.github/workflows/playwright.yml`)

1. Run `npm install` locally when dependencies change and commit the generated `package-lock.json`; both CI pipelines use `npm ci`.
2. In GitHub **Settings → Environments**, create `staging` and optionally `qa`.
3. For each environment, configure **variables**: `BASE_URL`, `API_BASE_URL`,
   `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_SSL`.
4. Configure **secrets**: `API_TOKEN`, `DB_PASSWORD`, `ORANGEHRM_USERNAME`, and
   `ORANGEHRM_PASSWORD`. Use restricted test credentials.
5. Push to `main`, open a PR, or run **Actions → Playwright CI → Run workflow**.
   PRs from forks run typechecking only, since secrets are unavailable.
6. Download per-browser Allure, Playwright HTML, JUnit, and trace reports from the
   workflow's **Artifacts** section. Java 17 is configured for Allure report generation.

If the test app or database is accessible only on a private network, use a
properly secured self-hosted runner (or a VPN/private connectivity solution).
The GitHub-hosted runner cannot automatically reach a localhost-only application.

### Jenkins (`Jenkinsfile`)

1. Use a Jenkins agent with Docker available, Pipeline and Credentials Binding
   plugins, and permission to run the Playwright container.
2. Create Jenkins **Secret text** credentials named `pw-api-token`,
   `pw-db-password`, `orangehrm-username`, and `orangehrm-password` (or update their
   IDs in the Jenkinsfile).
3. Configure non-secret variables `BASE_URL`, `API_BASE_URL`, `DB_HOST`,
   `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_SSL` at the job/folder level. For different
   target environments, supply environment-specific values using separate jobs
   or approved configuration management; `TARGET_ENV` alone does not change URLs.
4. Create a Pipeline or Multibranch Pipeline job from SCM, pointing to `Jenkinsfile`.
5. Build with parameters `TARGET_ENV` and `BROWSER`.
6. Open the build's **Test Result** and **Artifacts** to inspect JUnit, Allure, and
   Playwright reports and traces. The pipeline installs Java 17 for Allure generation.

Jenkins uses the official Playwright image to supply browser dependencies. Keep
its image tag aligned with `@playwright/test` in the lockfile. Jenkins' `cleanWs`
step requires the Workspace Cleanup plugin; remove it if unavailable. The HTML
Publisher plugin is optional; uncomment `publishHTML` to expose HTML reports.

### Important safeguards

- CI credentials must be scoped to test environments and rotated regularly.
- GitHub `environment` protection rules can require approval for QA execution.
- Don't allow untrusted PR code to execute with production or staging secrets.
- Test retries are diagnostics, not a substitute for eliminating flaky tests.
- For fully reproducible pipelines, pin action revisions and container digests.
