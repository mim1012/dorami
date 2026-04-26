import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

describe('MyPagePage', () => {
  it('does not include login session management UI or auth session API wiring', () => {
    const pagePath = path.join(process.cwd(), 'src/app/my-page/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    expect(source).not.toContain('AuthSessionsCard');
    expect(source).not.toContain('listAuthSessions');
    expect(source).not.toContain('revokeAuthSession');
    expect(source).not.toContain('sessionErrorMessage');
  });
});
