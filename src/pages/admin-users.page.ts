import { expect, type Locator, type Page } from '@playwright/test';

export type UserRole = 'Admin' | 'ESS';
export type UserStatus = 'Enabled' | 'Disabled';

export type UserSearchCriteria = {
  username?: string;
  role?: UserRole;
  employeeName?: string;
  status?: UserStatus;
};

export type NewSystemUser = {
  role: UserRole;
  employeeName: string;
  status: UserStatus;
  username: string;
  password: string;
  confirmPassword?: string;
};

export class AdminUsersPage {
  constructor(private readonly page: Page) {}

  private get systemUsersHeading(): Locator {
    return this.page.getByRole('heading', { name: 'System Users' });
  }

  async sortByColumn(
    label: string,
    direction: 'Ascending' | 'Descending',
  ): Promise<void> {
    const header = this.page.getByRole('columnheader', {
      name: new RegExp(label),
    });
    await header.locator('.oxd-table-header-sort-icon').click();
    await header.getByText(direction, { exact: true }).click();
  }

  async getColumnValues(cellIndex: number): Promise<string[]> {
    const values: string[] = [];
    for (let index = 0; index < (await this.rows.count()); index += 1) {
      values.push(
        (await this.rows.nth(index).getByRole('cell').nth(cellIndex).textContent()) ??
          '',
      );
    }
    return values;
  }

  private get recordsFound(): Locator {
    return this.page.getByText(/\(\d+\) Records? Found/);
  }

  private get rows(): Locator {
    return this.page.locator('.oxd-table-body').getByRole('row');
  }

  async goto(): Promise<void> {
    const userListResponse = this.waitForUserListResponse();
    await this.page.goto('/web/index.php/admin/viewSystemUsers');
    await userListResponse;
    await expect(this.systemUsersHeading).toBeVisible();
    await expect(this.recordsFound).toBeVisible();
  }

  async expectSystemUsersFilters(): Promise<void> {
    await this.ensureFiltersVisible();
    for (const label of ['Username', 'User Role', 'Employee Name', 'Status']) {
      await expect(this.fieldGroup(label)).toBeVisible();
    }
    await expect(this.page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
    await expect(this.page.getByRole('button', { name: /Add/ })).toBeVisible();
  }

  async getRecordCount(): Promise<number> {
    const text = (await this.recordsFound.textContent()) ?? '';
    const match = text.match(/\((\d+)\)/);
    if (!match) {
      throw new Error(`Could not read the System Users record count from "${text}".`);
    }
    return Number(match[1]);
  }

  async getVisibleRowCount(): Promise<number> {
    return this.rows.count();
  }

  async getRow(username: string): Promise<Locator> {
    return this.rows.filter({ hasText: username }).first();
  }

  async getRowCountFor(username: string): Promise<number> {
    return this.rows.filter({ hasText: username }).count();
  }

  async applySearch(criteria: UserSearchCriteria): Promise<void> {
    await this.ensureFiltersVisible();
    if (criteria.username !== undefined) {
      await this.fieldGroup('Username').getByRole('textbox').fill(criteria.username);
    }
    if (criteria.role !== undefined) {
      await this.selectValue('User Role', criteria.role);
    }
    if (criteria.employeeName !== undefined) {
      const employeeField = this.fieldGroup('Employee Name').getByRole('textbox');
      await employeeField.fill(criteria.employeeName);
      await this.page
        .getByRole('option', { name: criteria.employeeName, exact: true })
        .click();
    }
    if (criteria.status !== undefined) {
      await this.selectValue('Status', criteria.status);
    }
    const userListResponse = this.waitForUserListResponse();
    await this.page.getByRole('button', { name: 'Search', exact: true }).click();
    await userListResponse;
  }

  async resetSearch(): Promise<void> {
    await this.ensureFiltersVisible();
    const userListResponse = this.waitForUserListResponse();
    await this.page.getByRole('button', { name: 'Reset', exact: true }).click();
    await userListResponse;
  }

  async expectSearchCleared(): Promise<void> {
    await this.ensureFiltersVisible();
    await expect(this.fieldGroup('Username').getByRole('textbox')).toHaveValue('');
    await expect(this.fieldGroup('Employee Name').getByRole('textbox')).toHaveValue('');
    await expect(this.fieldGroup('User Role').locator('.oxd-select-text')).toHaveText(
      '-- Select --',
    );
    await expect(this.fieldGroup('Status').locator('.oxd-select-text')).toHaveText(
      '-- Select --',
    );
  }

  async openAddUser(): Promise<void> {
    await this.page.getByRole('button', { name: /Add/ }).click();
    await expect(this.page.getByRole('heading', { name: 'Add User' })).toBeVisible();
  }

  async fillNewUser(user: NewSystemUser): Promise<void> {
    await this.selectValue('User Role', user.role);
    const employeeField = this.fieldGroup('Employee Name').getByRole('textbox');
    await employeeField.fill(user.employeeName);
    await this.page
      .getByRole('option', { name: user.employeeName, exact: true })
      .click();
    await this.selectValue('Status', user.status);
    await this.fieldGroup('Username').getByRole('textbox').fill(user.username);
    await this.fieldGroup('Password').getByRole('textbox').fill(user.password);
    await this.fieldGroup('Confirm Password')
      .getByRole('textbox')
      .fill(user.confirmPassword ?? user.password);
  }

  async saveNewUser(): Promise<void> {
    const savedNotification = expect(
      this.page.getByText('Successfully Saved'),
    ).toBeVisible();
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await savedNotification;
    await expect(this.page).toHaveURL(/\/admin\/viewSystemUsers(?:\?|$)/);
    await expect(this.recordsFound).toBeVisible();
  }

  async openDeleteConfirmation(username: string): Promise<void> {
    await this.applySearch({ username });
    const row = await this.getRow(username);
    await expect(row).toBeVisible();
    await row.getByRole('button').first().click();
    await expect(this.page.getByText('Are you Sure?', { exact: true })).toBeVisible();
  }

  async cancelDelete(): Promise<void> {
    await this.page.getByRole('button', { name: /No, Cancel/ }).click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByRole('button', { name: /Yes, Delete/ }).click();
    await expect(this.page.getByText('Successfully Deleted')).toBeVisible();
  }

  async deleteIfPresent(username: string): Promise<void> {
    await this.applySearch({ username });
    const row = await this.getRow(username);
    if ((await row.count()) === 0) {
      return;
    }
    await row.getByRole('button').first().click();
    await expect(this.page.getByText('Are you Sure?', { exact: true })).toBeVisible();
    await this.confirmDelete();
    await expect(row).toHaveCount(0);
  }

  private async ensureFiltersVisible(): Promise<void> {
    const usernameField = this.fieldGroup('Username').getByRole('textbox');
    if (await usernameField.isVisible()) {
      return;
    }
    await this.systemUsersHeading.locator('..').getByRole('button').click();
    await expect(usernameField).toBeVisible();
  }

  private fieldGroup(label: string): Locator {
    return this.page.locator('.oxd-input-group').filter({ hasText: label }).first();
  }

  private async selectValue(label: string, value: string): Promise<void> {
    await this.fieldGroup(label).locator('.oxd-select-text').click();
    await this.page.getByRole('option', { name: value, exact: true }).click();
  }

  private waitForUserListResponse() {
    return this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v2/admin/users') &&
        response.request().method() === 'GET',
    );
  }
}
