# Playwright Framework Guide

This guide explains how the framework is organized, how its main pieces work
together, and what can be cleaned up safely. It is written for someone new to
this project.

## 1. What this framework does

This is a TypeScript and Playwright test framework. Its main current use is
automating the OrangeHRM demo UI and publishing Jira story test results to
Zephyr Scale.

The project also contains reusable API and PostgreSQL helpers. Those helpers
are generic framework scaffolding; the current OrangeHRM UI tests do not use
them. The API and database contract described in the README is an example, not
a backend that this repository provides.

The usual flow is:

1. A Playwright test opens the application and performs a user scenario.
2. Page objects provide reusable screen actions and locators.
3. Playwright checks the expected results.
4. For a Zephyr run, the test's case-key annotation connects it to a Zephyr
   test case.
5. The Zephyr runner creates a cycle, and the reporter publishes and verifies
   each mapped execution.

## 2. Folder structure

```text
playwright-enterprise-framework/
|-- .github/
|   |-- agents/
|   |   |-- Master.agent.md
|   |   |-- TestGenerator.agent.md
|   |   `-- Healer.agent.md
|   `-- workflows/
|       `-- playwright.yml
|-- config/
|   `-- env.ts
|-- scripts/
|   |-- run-zephyr.mjs
|   `-- sync-zephyr-test-case.mjs
|-- src/
|   |-- api/
|   |   `-- api.client.ts
|   |-- db/
|   |   `-- db.util.ts
|   |-- fixtures/
|   |   `-- base.test.ts
|   |-- models/
|   |   `-- user.model.ts
|   |-- pages/
|   |   |-- base.page.ts
|   |   |-- login.page.ts
|   |   `-- admin-users.page.ts
|   |-- reporters/
|   |   `-- zephyr.reporter.ts
|   `-- utils/
|       `-- test-data.ts
|-- tests/
|   |-- orangehrm/
|   |   `-- login.spec.ts
|   `-- jira/
|       `-- JiraAndPlaywrightMCPProject/
|           |-- scrum-8-orangehrm-login.spec.ts
|           |-- scrum-9-orangehrm-admin.spec.ts
|           |-- ac4-playwright-execution-results.spec.ts
|           `-- ac6-failure-reporting.spec.ts
|-- zephyr/
|   |-- SCRUM-8/
|   |   `-- scrum-8-zephyr-case.json
|   `-- SCRUM-9/
|       `-- ... Zephyr case manifests ...
|-- .env.example
|-- package.json
|-- package-lock.json
|-- playwright.config.ts
|-- tsconfig.json
`-- Jenkinsfile
```

Playwright and reporting also create local output folders such as `test-results/`,
`playwright-report/`, `allure-results/`, and `allure-report/`. These are generated
artifacts, not source code.

## 3. Is this a Page Object Model (POM)?

Yes. The UI automation uses the Page Object Model pattern:

- A page object represents a page or reusable UI area.
- It owns selectors and common interactions for that area.
- Tests use page-object methods to perform actions, then assert the scenario's
  expected results.

Examples:

- `src/pages/base.page.ts` contains small shared page helpers.
- `src/pages/login.page.ts` represents the login screen.
- `src/pages/admin-users.page.ts` represents Admin / System Users and its
  search, sorting, add, and delete interactions.

The pattern is used pragmatically, not rigidly: some test assertions and
page-specific actions still use Playwright's `page` locator API directly in the
spec file. The goal is to keep reusable selectors and workflows in page objects
without hiding the intent of each test.

This is not a BDD framework: tests are written as TypeScript Playwright specs;
there are no Gherkin feature files or step-definition files.

## 4. Main folders and files

### Playwright configuration

- `playwright.config.ts` selects the test directory, browser projects,
  timeouts, browser behavior, and reporters.
- `tsconfig.json` enables TypeScript checking for the config, source, and tests.
- `package.json` lists dependencies and the commands used to test, type-check,
  create Zephyr cases, and publish results.
- `package-lock.json` locks dependency versions for repeatable installs.

### Environment and fixtures

- `.env.example` is a template for local settings.
- `.env` holds local values and is ignored by Git. Do not commit it or share its
  contents.
- `config/env.ts` loads environment settings and provides defaults.
- `src/fixtures/base.test.ts` extends Playwright's test fixture with
  `loginPage`, `apiClient`, and `db` fixtures. Tests request only the fixtures
  they need.

### Pages and test specs

- `src/pages/` contains UI page objects.
- `tests/` contains executable Playwright specs. A `.spec.ts` file holds tests;
  it should describe scenarios and assertions, not secrets.
- `tests/orangehrm/` contains a basic OrangeHRM login example.
- `tests/jira/JiraAndPlaywrightMCPProject/` contains Jira story tests and
  Zephyr/reporting examples.

### Zephyr integration

- `zephyr/<STORY-KEY>/` stores JSON manifests that define Zephyr cases: their
  Jira issue, title, preconditions, and ordered test steps.
- `scripts/sync-zephyr-test-case.mjs` creates or reuses a case, links it to
  Jira, and verifies its steps.
- `scripts/run-zephyr.mjs` creates or verifies a story's execution-history
  folder, creates a fresh cycle, then starts Playwright.
- `src/reporters/zephyr.reporter.ts` reads the `zephyrCaseKey` annotation from
  each test and publishes the actual result to that cycle.
- `.github/agents/Master.agent.md` coordinates the Jira-to-test-to-Zephyr
  workflow. `TestGenerator.agent.md` implements planned tests, and
  `Healer.agent.md` diagnoses and repairs confirmed test-code failures. These
  are optional AI-agent instruction files, not needed to run Playwright tests.

Case manifests and test specs serve different purposes: the manifest defines
the case in Zephyr; the spec performs the automated scenario. The case key in
the spec annotation connects the two.

### CI and reports

- `.github/workflows/playwright.yml` runs type-checking and browser tests in
  GitHub Actions.
- `Jenkinsfile` defines a Jenkins test pipeline.
- Playwright produces HTML and JUnit results; Allure produces its own result
  data and report. Failed Playwright tests can include screenshots.

## 5. How to set up and run tests

1. Install Node.js 22 or newer.
2. From the framework root, run `npm ci`.
3. Install browser binaries, for example `npx playwright install chromium`.
   Install all configured browsers if you plan to run Firefox or WebKit.
4. Copy `.env.example` to `.env`, then configure a safe test/demo environment.
   At minimum, the OrangeHRM tests need `BASE_URL`,
   `ORANGEHRM_USERNAME`, and `ORANGEHRM_PASSWORD`.
5. Run `npm run typecheck`.
6. Run a focused test, for example:

   ```powershell
   npx playwright test tests/jira/JiraAndPlaywrightMCPProject/scrum-9-orangehrm-admin.spec.ts --project=chromium --workers=1
   ```

Common commands:

| Command | Purpose |
|---|---|
| `npm test` | Run Chromium tests in a visible browser. |
| `npm run test:ui` | Run Chromium tests in a headed browser. |
| `npm run test:headed` | Run headed Chromium tests with one worker. |
| `npm run test:debug` | Open Playwright Inspector for debugging. |
| `npm run typecheck` | Check TypeScript without running tests. |
| `npm run test:scrum-8:zephyr` | Run the SCRUM-8 mapped test and publish its result. |
| `npm run test:scrum-9:zephyr` | Run SCRUM-9 tests and publish their results. |
| `npm run report` | Open the latest Playwright HTML report. |

Zephyr commands require `ZEPHYR_SCALE_API_TOKEN` and
`ZEPHYR_SCALE_API_BASE_URL` to be configured locally or in the CI secret store.
Never put these credentials in a manifest or source file.

To sync a case manifest before running its test:

```powershell
npm run zephyr:sync-case -- zephyr/SCRUM-9/user-records.json
```

## 6. How to add automation for another Jira story

1. Read the story and acceptance criteria; choose testable scenarios.
2. Add or reuse a page object in `src/pages/` when the UI behavior or selectors
   should be shared.
3. Add a Playwright spec in `tests/jira/JiraAndPlaywrightMCPProject/`.
4. Add one or more case manifests under `zephyr/<STORY-KEY>/`.
5. Run `npm run zephyr:sync-case -- <manifest-path>` and use the case key it
   returns. Do not guess a new key.
6. Add the returned key as a test annotation:

   ```ts
   test.info().annotations.push({
     type: 'zephyrCaseKey',
     description: 'SCRUM-T99',
   });
   ```

7. Type-check and run the focused Playwright spec.
8. Use a story-specific Zephyr runner command, or add one following the
   existing `test:scrum-8:zephyr` / `test:scrum-9:zephyr` pattern.
9. Report the test file, case key, cycle key, execution key, and actual status.

For tests that create or modify data, use a unique test identity and remove only
the data created by that test, including when the test fails.

## 7. POM and fixture flow in plain language

1. Playwright starts a test and creates its isolated browser page.
2. The test asks for `loginPage` from `base.test.ts`.
3. The fixture constructs a `LoginPage` object around that browser page.
4. The test calls methods such as `goto()` and `login()`.
5. The page object uses locators and actions; the test uses `expect` to verify
   the scenario.
6. When a test requests `apiClient` or `db`, Playwright supplies those fixtures
   too. Current OrangeHRM UI tests do not request them.

In short: fixtures prepare reusable tools, page objects operate the UI, specs
define test scenarios, and reporters publish test outcomes.

## 8. Cleanup: what is safe to remove?

### Generated output

These folders can be deleted when you no longer need their current reports or
failure evidence. They are regenerated by test/report commands and are ignored
by Git:

- `playwright-report/`
- `test-results/`
- `allure-results/`
- `allure-report/`

`npm run allure:clean` clears `allure-results/`; running tests and generating a
report recreates the relevant outputs. Keep the folders if you still need to
inspect a failure or preserve a report.

`node_modules/` can also be recreated with `npm ci`, but keeping it avoids
reinstalling dependencies between local runs.

### Keep these files

- Keep `.git/`, `package-lock.json`, `package.json`, the Playwright config, and
  TypeScript config.
- Keep `.env` private and local; do not delete it unless you know its settings
  are backed up. Keep `.env.example` as the setup template.
- Keep the story specs, page objects, fixtures, Zephyr scripts, reporter, and
  manifests used by the package commands.
- `ac4-playwright-execution-results.spec.ts`,
  `ac6-failure-reporting.spec.ts`, and `tests/orangehrm/login.spec.ts` are
  referenced by existing demo commands; they are not orphaned files.

### Optional scaffold to review later

`src/api/`, `src/db/`, `src/models/`, and `src/utils/test-data.ts` provide
generic API/database testing helpers. Current Jira story UI specs do not use
these helpers directly, but the base fixtures expose the API and database
objects. Keep them if API/DB coverage is planned. If the project is intentionally
made UI-only, remove them as a coordinated cleanup: update the base fixtures,
environment template/config, related dependencies, and documentation together.

No source or framework files have been deleted as part of this guide.
