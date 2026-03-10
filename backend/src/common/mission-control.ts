/**
 * Mission Control 연동 헬퍼
 * 사용법: import { mc } from '../common/mission-control';
 *         const tid = await mc.start('주문 처리', 'dorami');
 *         await mc.done(tid);
 */

const MC_URL = 'http://localhost:3002/api/tasks';

async function post(body: object) {
  try {
    const res = await fetch(MC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

async function patch(id: number | null, status: string, reason?: string) {
  if (!id) return;
  try {
    await fetch(MC_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, reason }),
    });
  } catch {}
}

export const mc = {
  start: (title: string, bot = 'dorami') => post({ title, bot, status: 'in_progress' }),
  done: (id: number | null) => patch(id, 'done'),
  fail: (id: number | null, reason?: string) => patch(id, 'failed', reason),
};
