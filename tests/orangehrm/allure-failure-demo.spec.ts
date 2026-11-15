import { expect, test } from '../../src/fixtures/base.test';

test.skip(
  process.env.ALLURE_FAILURE_DEMO !== 'true',
  'Run npm run allure:failure-demo to execute this intentional failure.',
);

test('Allure demo captures a screenshot for a failed test', async ({ page }) => {
  await page.goto('/web/index.php/auth/login');
  expect(false).toBe(true);
});
