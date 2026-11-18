import { expect, test } from '../../../src/fixtures/base.test';

test.skip(
  process.env.ALLURE_FAILURE_DEMO !== 'true',
  'Run npm run allure:failure-demo to execute this intentional failure.',
);

test('SCRUM-T3 | SCRUM-7 AC6 - Failed execution publishes error details and screenshot', async ({ page }) => {
  test.info().annotations.push({
    type: 'zephyrCaseKey',
    description: 'SCRUM-T3',
  });

  await page.goto('/web/index.php/auth/login');
  expect(false).toBe(true);
});
