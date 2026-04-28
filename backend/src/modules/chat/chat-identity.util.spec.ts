import { resolveChatUsername } from './chat-identity.util';

describe('resolveChatUsername', () => {
  it('prefers instagramId when present', () => {
    expect(resolveChatUsername({ instagramId: '@test_aq04031', name: '김지훈' })).toBe(
      '@test_aq04031',
    );
  });

  it('falls back to name when instagramId is missing', () => {
    expect(resolveChatUsername({ instagramId: null, name: '김지훈' })).toBe('김지훈');
  });

  it('treats blank instagramId as missing and falls back to name', () => {
    expect(resolveChatUsername({ instagramId: '   ', name: '김지훈' })).toBe('김지훈');
  });

  it('returns 익명 only when both instagramId and name are missing', () => {
    expect(resolveChatUsername({ instagramId: null, name: null })).toBe('익명');
  });
});
