import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('grouped ORDER_CONFIRMATION button wiring', () => {
  it('does not attach CTA buttons for approved ORDER_CONFIRMATION templates', () => {
    const servicePath = path.join(process.cwd(), 'src/modules/admin/alimtalk.service.ts');
    const source = fs.readFileSync(servicePath, 'utf8');

    expect(source).toContain("template.kakaoTemplateCode === 'ORDER_CONFIRMATION'");
    expect(source).toContain('buttons: isApprovedOrderConfirmationTemplate');
    expect(source).toContain('? undefined');
  });
});
