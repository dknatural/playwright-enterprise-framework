import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);

const environment = process.env.TEST_ENV ?? 'local';
dotenv.config({ path: path.resolve(projectRoot, `.env.${environment}`) });
dotenv.config({ path: path.resolve(projectRoot, '.env') });

const token = process.env.ZEPHYR_SCALE_API_TOKEN;
const baseURL = process.env.ZEPHYR_SCALE_API_BASE_URL;
if (!token || !baseURL) {
  throw new Error(
    'Set ZEPHYR_SCALE_API_TOKEN and ZEPHYR_SCALE_API_BASE_URL before running Zephyr tests.',
  );
}

const apiBase = baseURL.replace(/\/+$/, '');
const projectKey = process.env.ZEPHYR_PROJECT_KEY ?? 'SCRUM';
const storyKey = process.env.ZEPHYR_STORY_KEY ?? 'SCRUM-7';
const cycleFolderName =
  process.env.ZEPHYR_CYCLE_FOLDER_NAME ?? `${storyKey} Execution History`;

async function zephyrRequest(endpoint, options = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      Authorization: token,
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Zephyr API request failed with HTTP ${response.status}.`);
  }

  return response.status === 204 ? undefined : response.json();
}

const folders = await zephyrRequest(
  `/folders?projectKey=${encodeURIComponent(projectKey)}&folderType=TEST_CYCLE&maxResults=1000`,
);
const folderRows = Array.isArray(folders) ? folders : (folders.values ?? []);
let cycleFolder = folderRows.find(
  (folder) => folder.name === cycleFolderName,
);
if (!cycleFolder?.id) {
  cycleFolder = await zephyrRequest('/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectKey,
      name: cycleFolderName,
      folderType: 'TEST_CYCLE',
    }),
  });
}
if (!cycleFolder?.id) {
  throw new Error(`Zephyr did not create or return the "${cycleFolderName}" folder.`);
}

const verifiedFolder = await zephyrRequest(
  `/folders/${encodeURIComponent(String(cycleFolder.id))}`,
);
if (
  verifiedFolder.name !== cycleFolderName ||
  verifiedFolder.folderType !== 'TEST_CYCLE'
) {
  throw new Error(`Zephyr cycle folder "${cycleFolderName}" could not be verified.`);
}

const runLabel =
  process.env.ZEPHYR_RUN_NAME ??
  process.env.GITHUB_RUN_NUMBER ??
  process.env.BUILD_NUMBER ??
  new Date().toISOString().replace(/[:.]/g, '-');
const targetEnvironment = process.env.TEST_ENV ?? 'local';
const cycleName = `${storyKey} | ${targetEnvironment} | ${runLabel}`;
const cycle = await zephyrRequest('/testcycles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectKey,
    name: cycleName,
    folderId: cycleFolder.id,
    description: `Automated Playwright results for Jira story ${storyKey}; environment ${targetEnvironment}; run ${runLabel}.`,
  }),
});

if (!cycle?.key) {
  throw new Error('Zephyr did not return a key for the created test cycle.');
}

const verifiedCycle = await zephyrRequest(
  `/testcycles/${encodeURIComponent(cycle.key)}`,
);
if (verifiedCycle.key !== cycle.key) {
  throw new Error('Zephyr test cycle could not be verified after creation.');
}
if (Number(verifiedCycle.folder?.id) !== Number(cycleFolder.id)) {
  throw new Error('Created Zephyr test cycle is not in the execution-history folder.');
}
console.log(`Created and verified Zephyr test cycle ${cycle.key}: ${cycleName}.`);

const playwrightCLI = path.join(
  projectRoot,
  'node_modules',
  '@playwright',
  'test',
  'cli.js',
);
const execution = spawnSync(
  process.execPath,
  [playwrightCLI, 'test', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      HEADLESS: process.env.HEADLESS ?? 'false',
      ZEPHYR_PROJECT_KEY: projectKey,
      ZEPHYR_TEST_CYCLE_KEY: cycle.key,
    },
  },
);

if (execution.error) {
  throw execution.error;
}

process.exitCode = execution.status ?? 1;
