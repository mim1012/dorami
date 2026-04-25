import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('grouped ORDER_CONFIRMATION button wiring', () => {
  it('uses the first order detail CTA for grouped CRDER_CONFIRMATION messages', () => {
    const servicePath = path.join(process.cwd(), 'src/modules/admin/alimtalk.service.ts');
    const source = fs.readFileSync(servicePath, 'utf8');

    expect(source).toContain("const primaryOrderId = payload.orderIds[0] ?? '주문';");
    expect(source).toContain('const orderLink =');
    expect(source).toContain('payload.orderIds[0] !== undefined');
    expect(source).toContain('`${this.frontendUrl}/orders/${payload.orderIds[0]}`');
    expect(source).toContain("'주문 상세 보기'");
    expect(source).not.toContain("'주문 내역 보기'");
  });
});
