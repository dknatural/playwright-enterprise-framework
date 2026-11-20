
import { test } from '../../src/fixtures/base.test';

test('log in to OrangeHRM', async ({ loginPage }) => {
  const username = process.env.ORANGEHRM_USERNAME;
  const password = process.env.ORANGEHRM_PASSWORD;

  console.log('CI environment:', process.env.CI === 'true');
  console.log('Username available:', Boolean(username));
  console.log('Password available:', Boolean(password));

  if (!username || !password) {
    throw new Error(
      'ORANGEHRM_USERNAME and ORANGEHRM_PASSWORD are missing.'
    );
  }

  await loginPage.goto();
  await loginPage.login(username, password);
  await loginPage.expectLoggedIn();
});
