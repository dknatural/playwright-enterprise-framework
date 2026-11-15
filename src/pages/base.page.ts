import { expect, type Locator, type Page } from '@playwright/test';

export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  protected async click(locator: Locator): Promise<void> {
    await locator.click(); // Playwright auto-waits for actionability.
  }
  protected async fill(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
  }
  protected async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }
}
