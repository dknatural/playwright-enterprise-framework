# Enterprise Playwright + TypeScript framework

New to this project? Start with the [Framework Guide](./FRAMEWORK_GUIDE.md).

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
- `npm run test:staging` — load `.env.staging` (if present)
- `npm run zephyr:sync-case -- <manifest.json>` — create or verify a Zephyr test case and its Jira link
- `npm run test:scrum-8:zephyr` — run the SCRUM-8 login/Dashboard test and publish its result to Zephyr
- `npm run test:scrum-9:zephyr` — run the SCRUM-9 login, user-management, sorting, search, validation, and cleanup tests and publish results to Zephyr
- `npm run test:zephyr` — run the SCRUM-7 mapped Chromium test and publish its result to Zephyr
- `npm run test:zephyr:failure-demo` — publish a deliberate failure and screenshot to Zephyr (expected to exit non-zero)
- `npx playwright test tests/jira/JiraAndPlaywrightMCPProject/ac4-playwright-execution-results.spec.ts --project=chromium` — run one SCRUM-7 test
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

### Zephyr Scale result publishing

The `test:zephyr` command creates a named Zephyr test cycle under
`SCRUM-7 Execution History`, runs the mapped Playwright test, and publishes each
annotated test result as a Zephyr execution. Set `ZEPHYR_RUN_NAME` to use a CI build
or release label; otherwise the cycle uses the CI build number or timestamp.
Failed tests
include their available screenshot attachments. A synchronization error fails the
command rather than reporting a successful publish.

The `test:scrum-8:zephyr` command runs the SCRUM-8 valid-login and Dashboard
checks and publishes the result for Zephyr case `SCRUM-T4` in the
`SCRUM-8 Execution History` cycle folder.

The `test:scrum-9:zephyr` command runs the SCRUM-9 end-to-end user-management
tests and publishes executions for cases `SCRUM-T5` through `SCRUM-T12` in the
`SCRUM-9 Execution History` cycle folder. Its dedicated test users are removed
by the tests after verification.

Configure `ZEPHYR_SCALE_API_TOKEN` and `ZEPHYR_SCALE_API_BASE_URL` in the ignored
local `.env` file. The default project is `SCRUM`; set `ZEPHYR_PROJECT_KEY` to
override it. Cases `SCRUM-T2` and `SCRUM-T3` are in the `SCRUM Sprint 2` folder
and linked to Jira story `SCRUM-7`.
The failure-demo command intentionally fails so screenshot publication can be verified.
Never commit or share the API token. CI publishing requires adding the token as a
protected CI secret and setting the same environment variables there.

### Creating or verifying Zephyr test cases

The `zephyr:sync-case` command reads a JSON manifest containing a Jira issue key,
the numeric issue ID returned by Jira MCP, test-case metadata, and ordered test
steps. For example:

```powershell
npm run zephyr:sync-case -- zephyr/SCRUM-8/scrum-8-zephyr-case.json
```

The command reuses a case with an exact matching name or creates one, links it to
the Jira issue, and verifies the link and steps. It does not replace non-empty
steps that differ from the manifest; review those cases manually. Credentials are
read from `.env` and are not written to the manifest. Use the returned Zephyr case
key in the Playwright test's `zephyrCaseKey` annotation.
Case manifests are organized by Jira story under
`zephyr/` at the framework root.

Troubleshooting cycles from initial setup are grouped in Zephyr's
`Archive - Zephyr Setup Diagnostics` folder. Zephyr Scale's documented API does not
support deleting test cases, cycles, or executions; remove them in the Zephyr UI if
permanent deletion is needed. The verified pass and screenshot failure runs remain
under `SCRUM-7 Execution History`.

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
