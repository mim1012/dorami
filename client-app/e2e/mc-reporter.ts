/**
 * Mission Control Reporter for Playwright
 * playwright.config.ts에 reporter 추가:
 *   reporter: [['./e2e/mc-reporter.ts']]
 */

import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

const MC_URL = 'http://localhost:3002/api/tasks';

async function mcPost(title: string, status: string, bot = 'dorami') {
  try {
    await fetch(MC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status, bot, createdAt: new Date().toISOString() }),
    });
  } catch {}
}

async function mcPatch(id: number, status: string, reason?: string) {
  try {
    await fetch(MC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, reason }),
    });
  } catch {}
}

class MissionControlReporter implements Reporter {
  private taskIds = new Map<string, number>();
  private suiteId: number | null = null;

  async onBegin(config: any, suite: any) {
    const total = suite.allTests().length;
    try {
      const res = await fetch(MC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `E2E 테스트 실행 (${total}개)`,
          status: 'in_progress',
          bot: 'dorami',
          createdAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      this.suiteId = data.id;
    } catch {}
  }

  async onTestBegin(test: TestCase) {
    try {
      const res = await fetch(MC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `🧪 ${test.title}`,
          status: 'in_progress',
          bot: 'dorami',
          createdAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      this.taskIds.set(test.id, data.id);
    } catch {}
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const id = this.taskIds.get(test.id);
    if (!id) return;

    const status = result.status === 'passed' ? 'done'
      : result.status === 'failed' ? 'failed'
      : result.status === 'skipped' ? 'pending'
      : 'failed';

    const reason = result.errors?.[0]?.message?.slice(0, 200);
    await mcPatch(id, status, reason);
  }

  async onEnd(result: FullResult) {
    if (!this.suiteId) return;
    const status = result.status === 'passed' ? 'done' : 'failed';
    await mcPatch(this.suiteId, status, result.status !== 'passed' ? `전체 결과: ${result.status}` : undefined);
  }
}

export default MissionControlReporter;
