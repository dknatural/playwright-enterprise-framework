import { test } from '../../src/fixtures/base.test';

test('log in to OrangeHRM', async ({ loginPage }) => {
  const username = process.env.ORANGEHRM_USERNAME;
  const password = process.env.ORANGEHRM_PASSWORD;

  if (!username || !password) {
    throw new Error('Set ORANGEHRM_USERNAME and ORANGEHRM_PASSWORD in your .env file.');
  }

  await loginPage.goto();
  await loginPage.login(username, password);
  await loginPage.expectLoggedIn();
});
