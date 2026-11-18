import { test } from '../../../src/fixtures/base.test';

test('SCRUM-T2 | SCRUM-7 AC4 - Playwright execution captures individual test results', async ({
  loginPage,
}) => {
  test.info().annotations.push({
    type: 'zephyrCaseKey',
    description: 'SCRUM-T2',
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
});
