import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

type ZephyrExecution = {
  id: number | string;
  key?: string;
};

class ZephyrReporter implements Reporter {
  private readonly token = process.env.ZEPHYR_SCALE_API_TOKEN;
  private readonly apiBase = process.env.ZEPHYR_SCALE_API_BASE_URL?.replace(
    /\/+$/,
    '',
  );
  private readonly projectKey = process.env.ZEPHYR_PROJECT_KEY ?? 'SCRUM';
  private readonly cycleKey = process.env.ZEPHYR_TEST_CYCLE_KEY;
  private suite?: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  async onEnd(_result: FullResult): Promise<{ status?: 'failed' } | void> {
    if (!this.token || !this.apiBase || !this.cycleKey) {
      console.error(
        'Zephyr publishing requires an API token, base URL, and test cycle key.',
      );
      return { status: 'failed' };
    }

    const mappedTests = (this.suite?.allTests() ?? [])
      .map((test) => ({
        test,
        result: test.results[test.results.length - 1],
      }))
      .filter(
        (item): item is { test: TestCase; result: TestResult } =>
          item.result !== undefined &&
          item.result.annotations.some(
            (annotation) => annotation.type === 'zephyrCaseKey',
          ),
      );

    if (mappedTests.length === 0) {
      console.error('No completed Playwright tests have a Zephyr case mapping.');
      return { status: 'failed' };
    }

    const failures: string[] = [];
    for (const { test, result } of mappedTests) {
      const caseKey = result.annotations.find(
        (annotation) => annotation.type === 'zephyrCaseKey',
      )?.description;
      if (!caseKey) {
        failures.push(`${test.title}: Zephyr case key annotation is empty.`);
        continue;
      }

      try {
        await this.publishExecution(caseKey, test, result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown publishing error';
        failures.push(`${caseKey}: ${message}`);
      }
    }

    if (failures.length > 0) {
      console.error(`Zephyr result synchronization failed:\n${failures.join('\n')}`);
      return { status: 'failed' };
    }

    return;
  }

  private async publishExecution(
    caseKey: string,
    test: TestCase,
    result: TestResult,
  ): Promise<void> {
    const cycleKey = this.cycleKey;
    if (!cycleKey) {
      throw new Error('Zephyr test cycle key is missing.');
    }

    if (!/^[A-Z][A-Z0-9_]+-T\d+$/.test(caseKey)) {
      throw new Error('Invalid Zephyr test case key annotation.');
    }

    const outcome = test.outcome();
    const statusName =
      result.status === 'skipped' || outcome === 'skipped'
        ? 'Not Executed'
        : result.status === 'passed' || outcome === 'expected' || outcome === 'flaky'
          ? 'Pass'
          : 'Fail';
    const errorText = result.errors
      .map((item) => item.message)
      .filter((message): message is string => Boolean(message))
      .join('\n')
      .slice(0, 4000);

    const execution = await this.request<ZephyrExecution>('/testexecutions', {
      method: 'POST',
      body: JSON.stringify({
        projectKey: this.projectKey,
        testCaseKey: caseKey,
        testCycleKey: cycleKey,
        statusName,
        actualEndDate: new Date().toISOString(),
        executionTime: Math.max(0, Math.round(result.duration)),
        automated: true,
        ...(errorText ? { comment: errorText } : {}),
      }),
    });

    if (!execution?.id) {
      throw new Error('Zephyr did not return an execution ID.');
    }

    const verified = await this.request<{
      id: number | string;
      key?: string;
      testCase?: { self?: string };
      testExecutionStatus?: { id?: number | string };
      testCycle?: { id?: number | string };
    }>(`/testexecutions/${encodeURIComponent(String(execution.id))}`);
    if (
      !verified.testExecutionStatus?.id ||
      !verified.testCycle?.id ||
      !verified.testCase?.self
    ) {
      throw new Error('Zephyr execution is missing its case, cycle, or status link.');
    }
    const [status, cycle, caseExecutions] = await Promise.all([
      this.request<{ name?: string }>(
        `/statuses/${encodeURIComponent(String(verified.testExecutionStatus?.id))}`,
      ),
      this.request<{ id?: number | string }>(
        `/testcycles/${encodeURIComponent(cycleKey)}`,
      ),
      this.request<
        Array<{ id: number | string }> | { values?: Array<{ id: number | string }> }
      >(
        `/testexecutions?${new URLSearchParams({
          projectKey: this.projectKey,
          testCycle: cycleKey,
          testCase: caseKey,
          maxResults: '1000',
        })}`,
      ),
    ]);
    const executionRows = Array.isArray(caseExecutions)
      ? caseExecutions
      : (caseExecutions.values ?? []);
    if (
      String(verified.id) !== String(execution.id) ||
      !verified.testCase?.self?.includes(`/testcases/${caseKey}/`) ||
      String(verified.testCycle?.id) !== String(cycle.id) ||
      status.name !== statusName ||
      !executionRows.some((row) => String(row.id) === String(execution.id))
    ) {
      throw new Error('Created Zephyr execution did not match the test result.');
    }

    const screenshots = result.attachments.filter(
      (attachment) =>
        attachment.contentType.startsWith('image/') &&
        (attachment.path || attachment.body),
    );

    for (const [index, attachment] of screenshots.entries()) {
      const fileName = `${caseKey}-${index + 1}-${path.basename(
        attachment.path ?? attachment.name,
      )}`;
      const body = attachment.path
        ? await readFile(attachment.path)
        : attachment.body;
      if (!body) {
        continue;
      }

      await this.request(
        `/testexecutions/${encodeURIComponent(String(execution.id))}/attachments/${encodeURIComponent(fileName)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': attachment.contentType,
          },
          body: Uint8Array.from(body).buffer,
        },
      );
    }

    if (screenshots.length > 0) {
      const attachments = await this.request<
        | Array<{ fileName?: string; filename?: string; name?: string }>
        | {
            values?: Array<{ fileName?: string; filename?: string; name?: string }>;
            attachments?: Array<{ fileName?: string; filename?: string; name?: string }>;
          }
      >(`/testexecutions/${encodeURIComponent(String(execution.id))}/attachments`);
      const rows = Array.isArray(attachments)
        ? attachments
        : (attachments.attachments ?? attachments.values ?? []);
      const attachmentNames = new Set(
        rows.map((row) => row.fileName ?? row.filename ?? row.name),
      );
      if (
        rows.length < screenshots.length ||
        [...attachmentNames].filter(Boolean).length < screenshots.length
      ) {
        throw new Error('Zephyr execution screenshot attachments were not verified.');
      }
    }

    console.log(
      `Published ${test.title}: ${statusName} (${verified.key ?? execution.id})${screenshots.length ? ` with ${screenshots.length} screenshot(s)` : ''}.`,
    );
  }

  private async request<T = void>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers: {
        Authorization: this.token!,
        Accept: 'application/json',
        ...(typeof options.body === 'string'
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Zephyr API returned HTTP ${response.status}.`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

export default ZephyrReporter;
