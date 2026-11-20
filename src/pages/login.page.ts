
import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  private get usernameInput() {
    return this.page.getByPlaceholder('Username');
  }

  private get passwordInput() {
    return this.page.getByPlaceholder('Password');
  }

  private get submitButton() {
    return this.page.getByRole('button', { name: 'Login' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/web/index.php/auth/login');
  }

  async login(username: string, password: string): Promise<void> {
    if (!username || !password) {
      throw new Error('OrangeHRM username or password is missing');
    }

    await this.fill(this.usernameInput, username);
    await this.fill(this.passwordInput, password);
    await this.click(this.submitButton);
  }

  async expectLoggedIn(): Promise<void> {
    const invalidCredentials = this.page.getByText(
      'Invalid credentials',
      { exact: true }
    );

    const dashboard = this.page.getByRole('heading', {
      name: 'Dashboard'
    });

    await expect
      .poll(async () => {
        if (await invalidCredentials.isVisible()) {
          return 'invalid-credentials';
        }

        if (await dashboard.isVisible()) {
          return 'dashboard';
        }

        return 'waiting';
      }, {
        timeout: 15000,
        message: 'Login did not reach the Dashboard'
      })
      .toBe('dashboard');
  }
}
