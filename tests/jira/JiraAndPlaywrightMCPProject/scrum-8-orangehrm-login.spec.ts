import { test, expect } from '../../../src/fixtures/base.test';

test('SCRUM-8 AC4-AC5 - Valid OrangeHRM login redirects to Dashboard', async ({
  page,
  loginPage,
}) => {
  test.info().annotations.push({
    type: 'zephyrCaseKey',
    description: 'SCRUM-T4',
  });

  const username = process.env.ORANGEHRM_USERNAME;
  const password = process.env.ORANGEHRM_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Set ORANGEHRM_USERNAME and ORANGEHRM_PASSWORD in your .env file.',
    );
  }

  await loginPage.goto();
  await loginPage.login(username, password);
  await loginPage.expectLoggedIn();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  await expect(page).not.toHaveURL(/\/auth\/login(?:\/|$)/);
});
