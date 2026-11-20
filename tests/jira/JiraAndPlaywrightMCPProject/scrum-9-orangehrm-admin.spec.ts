import { test, expect } from '../../../src/fixtures/base.test';
import { AdminUsersPage, type NewSystemUser } from '../../../src/pages/admin-users.page';
import type { LoginPage } from '../../../src/pages/login.page';

const password = 'OrangeHrm@2026';

function uniqueUsername(role: string): string {
  return `scrum9_${role.toLowerCase()}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

async function getEmployeeNameSearch(adminUsers: AdminUsersPage): Promise<string> {
  const employeeName = (await adminUsers.getColumnValues(3))
    .map((name) => name.trim())
    .find((name) => name.length > 0 && name !== '--');
  if (!employeeName) {
    throw new Error('No existing employee name is available for System Users tests.');
  }
  return employeeName;
}

async function signInAsAdmin(loginPage: LoginPage): Promise<void> {
  const username = process.env.ORANGEHRM_USERNAME;
  const userPassword = process.env.ORANGEHRM_PASSWORD;
  if (!username || !userPassword) {
    throw new Error(
      'Set ORANGEHRM_USERNAME and ORANGEHRM_PASSWORD in your .env file.',
    );
  }
  await loginPage.goto();
  await loginPage.login(username, userPassword);
  await loginPage.expectLoggedIn();
}

function annotateZephyrCase(testInfo: {
  annotations: { type: string; description?: string }[];
}, caseKey: string): void {
  testInfo.annotations.push({ type: 'zephyrCaseKey', description: caseKey });
}

test('SCRUM-9 AC1-AC3 - Login, validate Dashboard, and open System Users', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T5');
  await signInAsAdmin(loginPage);

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveClass(/active/);
  for (const widget of ['Time at Work', 'My Actions', 'Quick Launch']) {
    await expect(page.getByText(widget, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Admin', exact: true }).click();

  const adminUsers = new AdminUsersPage(page);
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveClass(
    /active/,
  );
  await expect(page.getByRole('heading', { name: 'System Users' })).toBeVisible();
  await adminUsers.expectSystemUsersFilters();
});

test('SCRUM-9 AC4 - Validate System Users records and empty results', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T6');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();

  expect(await adminUsers.getVisibleRowCount()).toBe(await adminUsers.getRecordCount());
  const firstRow = page.locator('.oxd-table-body').getByRole('row').first();
  await expect(firstRow.getByRole('cell')).toHaveCount(6);
  await expect(firstRow.getByRole('button')).toHaveCount(2);

  await adminUsers.applySearch({ username: `no_user_${Date.now()}` });
  await expect(
    page.locator('span.oxd-text--span').getByText('No Records Found', { exact: true }),
  ).toBeVisible();
  await adminUsers.resetSearch();
});

test('SCRUM-9 AC5 - Validate supported user sorting controls', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T7');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();

  for (const column of [
    { name: 'Username', cellIndex: 1 },
    { name: 'User Role', cellIndex: 2 },
    { name: 'Employee Name', cellIndex: 3 },
    { name: 'Status', cellIndex: 4 },
  ]) {
    const originalCount = await adminUsers.getRecordCount();
    await adminUsers.sortByColumn(column.name, 'Ascending');
    const ascendingValues = await adminUsers.getColumnValues(column.cellIndex);
    expect(ascendingValues).toEqual(
      [...ascendingValues].sort((left, right) => left.localeCompare(right)),
    );
    expect(await adminUsers.getRecordCount()).toBe(originalCount);

    await adminUsers.sortByColumn(column.name, 'Descending');
    const descendingValues = await adminUsers.getColumnValues(column.cellIndex);
    expect(descendingValues).toEqual(
      [...descendingValues].sort((left, right) => right.localeCompare(left)),
    );
    expect(await adminUsers.getRecordCount()).toBe(originalCount);
  }
});

test('SCRUM-9 AC6 - Create and verify an Admin user', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T8');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();
  const employeeNameSearch = await getEmployeeNameSearch(adminUsers);
  const username = uniqueUsername('admin');
  const user: NewSystemUser = {
    role: 'Admin',
    employeeNameSearch,
    status: 'Enabled',
    username,
    password,
  };

  try {
    await adminUsers.openAddUser();
    await adminUsers.fillNewUser(user);
    await adminUsers.saveNewUser();
    await adminUsers.applySearch({ username });
    const row = await adminUsers.getRow(username);
    await expect(row).toContainText('Admin');
    await expect(row.getByRole('cell').nth(3)).toHaveText(/\S/);
    await expect(row).toContainText('Enabled');
  } finally {
    await adminUsers.deleteIfPresent(username);
  }
});

test('SCRUM-9 AC7 - Create and verify an ESS user', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T9');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();
  const employeeNameSearch = await getEmployeeNameSearch(adminUsers);
  const username = uniqueUsername('ess');
  const user: NewSystemUser = {
    role: 'ESS',
    employeeNameSearch,
    status: 'Enabled',
    username,
    password,
  };

  try {
    await adminUsers.openAddUser();
    await adminUsers.fillNewUser(user);
    await adminUsers.saveNewUser();
    await adminUsers.applySearch({ username });
    const row = await adminUsers.getRow(username);
    await expect(row).toContainText('ESS');
    await expect(row.getByRole('cell').nth(3)).toHaveText(/\S/);
    await expect(row).toContainText('Enabled');
  } finally {
    await adminUsers.deleteIfPresent(username);
  }
});

test('SCRUM-9 AC8 - Cancel and confirm deletion of a dedicated user', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T10');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();
  const employeeNameSearch = await getEmployeeNameSearch(adminUsers);
  const username = uniqueUsername('delete');
  const user: NewSystemUser = {
    role: 'ESS',
    employeeNameSearch,
    status: 'Enabled',
    username,
    password,
  };

  try {
    await adminUsers.openAddUser();
    await adminUsers.fillNewUser(user);
    await adminUsers.saveNewUser();

    await adminUsers.openDeleteConfirmation(username);
    await adminUsers.cancelDelete();
    expect(await adminUsers.getRowCountFor(username)).toBe(1);

    await adminUsers.openDeleteConfirmation(username);
    await adminUsers.confirmDelete();
    expect(await adminUsers.getRowCountFor(username)).toBe(0);
    await adminUsers.resetSearch();
  } finally {
    await adminUsers.deleteIfPresent(username);
  }
});

test('SCRUM-9 AC9-AC11 - Search users by criteria and reset filters', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T11');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();
  const employeeName = await getEmployeeNameSearch(adminUsers);

  await adminUsers.applySearch({ username: 'Admin' });
  expect(await adminUsers.getRecordCount()).toBe(1);
  await expect(await adminUsers.getRow('Admin')).toContainText('Admin');

  await adminUsers.applySearch({ role: 'Admin' });
  expect(await adminUsers.getRecordCount()).toBeGreaterThan(0);
  await expect(page.getByRole('table')).toContainText('Admin');

  await adminUsers.resetSearch();
  await adminUsers.applySearch({ role: 'ESS' });
  const essCount = await adminUsers.getRecordCount();
  if (essCount === 0) {
    await adminUsers.expectNoRecordsFound();
  } else {
    const roles = await adminUsers.getColumnValues(2);
    expect(roles.every((role) => role.trim() === 'ESS')).toBe(true);
  }

  await adminUsers.resetSearch();
  await adminUsers.applySearch({ employeeName });
  expect(await adminUsers.getRecordCount()).toBeGreaterThan(0);
  const employeeNames = await adminUsers.getColumnValues(3);
  expect(employeeNames.every((name) => name.trim() === employeeName)).toBe(true);

  await adminUsers.resetSearch();
  await adminUsers.applySearch({ status: 'Enabled' });
  expect(await adminUsers.getRecordCount()).toBeGreaterThan(0);

  await adminUsers.resetSearch();
  await adminUsers.applySearch({ status: 'Disabled' });
  const disabledCount = await adminUsers.getRecordCount();
  if (disabledCount === 0) {
    await adminUsers.expectNoRecordsFound();
  } else {
    const disabledRows = page.locator('.oxd-table-body').getByRole('row');
    for (let index = 0; index < (await disabledRows.count()); index += 1) {
      await expect(disabledRows.nth(index).getByRole('cell').nth(4)).toHaveText(
        'Disabled',
      );
    }
  }

  await adminUsers.resetSearch();
  await adminUsers.applySearch({ username: 'Admin', role: 'Admin' });
  expect(await adminUsers.getRecordCount()).toBe(1);

  await adminUsers.resetSearch();
  await adminUsers.expectSearchCleared();
  expect(await adminUsers.getRecordCount()).toBeGreaterThan(0);
});

test('SCRUM-9 AC12 - Reject missing fields, mismatched passwords, and duplicate usernames', async ({
  page,
  loginPage,
}, testInfo) => {
  annotateZephyrCase(testInfo, 'SCRUM-T12');
  await signInAsAdmin(loginPage);
  const adminUsers = new AdminUsersPage(page);
  await adminUsers.goto();
  const employeeNameSearch = await getEmployeeNameSearch(adminUsers);

  await adminUsers.openAddUser();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Required', { exact: true }).first()).toBeVisible();

  await adminUsers.goto();
  await adminUsers.openAddUser();
  const mismatchUsername = uniqueUsername('mismatch');
  await adminUsers.fillNewUser({
    role: 'ESS',
    employeeNameSearch,
    status: 'Enabled',
    username: mismatchUsername,
    password,
    confirmPassword: `${password}Mismatch`,
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  await adminUsers.goto();
  await adminUsers.applySearch({ username: mismatchUsername });
  expect(await adminUsers.getVisibleRowCount()).toBe(0);

  await adminUsers.goto();
  await adminUsers.openAddUser();
  await adminUsers.fillNewUser({
    role: 'ESS',
    employeeNameSearch,
    status: 'Enabled',
    username: 'Admin',
    password,
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Already exists', { exact: true })).toBeVisible();
});
