import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ApiClient } from '../api/api.client';
import { Database } from '../db/db.util';
import { env } from '../../config/env';

type Fixtures = {
  loginPage: LoginPage;
  apiClient: ApiClient;
  db: Database;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  apiClient: async ({ request }, use) => {
    await use(new ApiClient(request, env.apiBaseURL, env.apiToken));
  },
  db: async ({}, use) => {
    const db = new Database(env.db);
    try { await use(db); }
    finally { await db.close(); }
  },
});
export { expect };
