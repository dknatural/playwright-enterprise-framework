import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);

const environment = process.env.TEST_ENV ?? 'local';
dotenv.config({ path: path.resolve(projectRoot, `.env.${environment}`) });
dotenv.config({ path: path.resolve(projectRoot, '.env') });

function validateManifest(manifest) {
  const projectKey = manifest.projectKey ?? process.env.ZEPHYR_PROJECT_KEY ?? 'SCRUM';
  const issueKey = manifest.issueKey;
  const issueId = Number(manifest.issueId);
  const name = manifest.name?.trim();
  const steps = manifest.steps;

  if (!/^[A-Z][A-Z0-9_]*$/.test(projectKey)) {
    throw new Error('Manifest projectKey must be a valid uppercase project key.');
  }
  if (typeof issueKey !== 'string' || !/^[A-Z][A-Z0-9_]+-\d+$/.test(issueKey)) {
    throw new Error('Manifest issueKey must be a Jira key such as SCRUM-123.');
  }
  if (!Number.isSafeInteger(issueId) || issueId <= 0) {
    throw new Error('Manifest issueId must be the positive numeric Jira issue ID returned by Jira.');
  }
  if (!name) {
    throw new Error('Manifest name is required.');
  }
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 100) {
    throw new Error('Manifest steps must contain between 1 and 100 steps.');
  }

  const normalizedSteps = steps.map((step, index) => {
    if (
      typeof step.description !== 'string' ||
      !step.description.trim() ||
      typeof step.expectedResult !== 'string' ||
      !step.expectedResult.trim()
    ) {
      throw new Error(
        `Manifest step ${index + 1} requires a description and expectedResult.`,
      );
    }

    return {
      description: step.description.trim(),
      testData: typeof step.testData === 'string' ? step.testData : '',
      expectedResult: step.expectedResult.trim(),
    };
  });

  const folderId =
    manifest.folderId === undefined ? undefined : Number(manifest.folderId);
  if (
    folderId !== undefined &&
    (!Number.isSafeInteger(folderId) || folderId <= 0)
  ) {
    throw new Error('Manifest folderId must be a positive integer when provided.');
  }

  const labels = manifest.labels ?? [];
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== 'string')) {
    throw new Error('Manifest labels must be an array of strings.');
  }

  return {
    projectKey,
    issueKey,
    issueId,
    name,
    objective: manifest.objective ?? '',
    precondition: manifest.precondition ?? '',
    statusName: manifest.statusName ?? 'Approved',
    priorityName: manifest.priorityName ?? 'Normal',
    folderId,
    labels,
    steps: normalizedSteps,
  };
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    throw new Error(
      'Usage: npm run zephyr:sync-case -- <test-case-manifest.json>',
    );
  }

  const token = process.env.ZEPHYR_SCALE_API_TOKEN;
  const configuredBaseURL = process.env.ZEPHYR_SCALE_API_BASE_URL;
  if (!token || !configuredBaseURL) {
    throw new Error(
      'Set ZEPHYR_SCALE_API_TOKEN and ZEPHYR_SCALE_API_BASE_URL in the environment.',
    );
  }

  const manifest = validateManifest(
    JSON.parse(await readFile(path.resolve(manifestPath), 'utf8')),
  );
  const apiBase = configuredBaseURL.replace(/\/+$/, '');

  async function request(endpoint, options = {}) {
    const response = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers: {
        Authorization: token,
        Accept: 'application/json',
        ...(typeof options.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Zephyr API request failed with HTTP ${response.status}.`);
    }

    if (response.status === 204) {
      return undefined;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }

  async function getAllPages(endpoint, maxResults = 100) {
    let startAt = 0;
    const rows = [];

    while (true) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const page = await request(
        `${endpoint}${separator}${new URLSearchParams({
          startAt: String(startAt),
          maxResults: String(maxResults),
        })}`,
      );
      if (Array.isArray(page)) {
        rows.push(...page);
        return rows;
      }

      const values = page?.values ?? [];
      rows.push(...values);
      if (
        page?.isLast === true ||
        values.length === 0 ||
        (Number.isFinite(page?.total) && rows.length >= page.total)
      ) {
        return rows;
      }
      startAt += values.length;
    }
  }

  const allCases = await getAllPages(
    `/testcases?projectKey=${encodeURIComponent(manifest.projectKey)}`,
  );
  const matchingCases = allCases.filter(
    (testCase) => testCase.name?.trim() === manifest.name,
  );
  if (matchingCases.length > 1) {
    throw new Error(
      `Multiple Zephyr cases have the exact name "${manifest.name}"; resolve the duplicates before syncing.`,
    );
  }

  let testCase = matchingCases[0];
  const created = !testCase;
  if (!testCase) {
    testCase = await request('/testcases', {
      method: 'POST',
      body: JSON.stringify({
        projectKey: manifest.projectKey,
        name: manifest.name,
        objective: manifest.objective,
        precondition: manifest.precondition,
        statusName: manifest.statusName,
        priorityName: manifest.priorityName,
        ...(manifest.folderId ? { folderId: manifest.folderId } : {}),
        ...(manifest.labels.length ? { labels: manifest.labels } : {}),
      }),
    });
  }

  if (!testCase?.key) {
    throw new Error('Zephyr did not return a key for the test case.');
  }

  const caseKey = testCase.key;
  const encodedCaseKey = encodeURIComponent(caseKey);
  const caseDetails = await request(`/testcases/${encodedCaseKey}`);
  if (
    caseDetails.key !== caseKey ||
    caseDetails.name?.trim() !== manifest.name
  ) {
    throw new Error('Zephyr test case could not be verified after lookup or creation.');
  }

  const currentSteps = await getAllPages(
    `/testcases/${encodedCaseKey}/teststeps`,
  );
  const normalizeStep = (step) => ({
    description: step.inline?.description ?? '',
    testData: step.inline?.testData ?? '',
    expectedResult: step.inline?.expectedResult ?? '',
  });
  const normalizedCurrentSteps = currentSteps.map(normalizeStep);
  const stepsMatch =
    normalizedCurrentSteps.length === manifest.steps.length &&
    normalizedCurrentSteps.every(
      (step, index) =>
        step.description === manifest.steps[index].description &&
        step.testData === manifest.steps[index].testData &&
        step.expectedResult === manifest.steps[index].expectedResult,
    );
  const currentStepsAreEmpty = normalizedCurrentSteps.every(
    (step) => !step.description && !step.testData && !step.expectedResult,
  );

  if (!stepsMatch && !currentStepsAreEmpty) {
    throw new Error(
      `Zephyr case ${caseKey} already has different steps; review it before replacing them.`,
    );
  }

  let links = await request(`/testcases/${encodedCaseKey}/links`);
  const hasIssueLink = (links?.issues ?? []).some(
    (link) => String(link.issueId) === String(manifest.issueId),
  );
  if (!hasIssueLink) {
    await request(`/testcases/${encodedCaseKey}/links/issues`, {
      method: 'POST',
      body: JSON.stringify({ issueId: manifest.issueId }),
    });
    links = await request(`/testcases/${encodedCaseKey}/links`);
  }
  if (
    !(links?.issues ?? []).some(
      (link) => String(link.issueId) === String(manifest.issueId),
    )
  ) {
    throw new Error(`Zephyr case ${caseKey} is not linked to ${manifest.issueKey}.`);
  }

  if (!stepsMatch) {
    await request(`/testcases/${encodedCaseKey}/teststeps`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'OVERWRITE',
        items: manifest.steps.map((step) => ({ inline: step })),
      }),
    });
  }

  const verifiedSteps = await getAllPages(
    `/testcases/${encodedCaseKey}/teststeps`,
  );
  const finalSteps = verifiedSteps.map(normalizeStep);
  if (
    finalSteps.length !== manifest.steps.length ||
    finalSteps.some(
      (step, index) =>
        step.description !== manifest.steps[index].description ||
        step.testData !== manifest.steps[index].testData ||
        step.expectedResult !== manifest.steps[index].expectedResult,
    )
  ) {
    throw new Error(`Zephyr test steps for ${caseKey} could not be verified.`);
  }

  console.log(
    JSON.stringify({
      projectKey: manifest.projectKey,
      issueKey: manifest.issueKey,
      caseKey,
      caseName: manifest.name,
      created,
      linked: true,
      verifiedStepCount: finalSteps.length,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Zephyr case sync failed.');
  process.exitCode = 1;
});
