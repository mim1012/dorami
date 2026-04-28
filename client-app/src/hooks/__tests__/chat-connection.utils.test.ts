import { shouldUseAuthenticatedChatConnection } from '../chat-connection.utils';

describe('shouldUseAuthenticatedChatConnection', () => {
  it('returns true when authenticated is nested under data', () => {
    expect(shouldUseAuthenticatedChatConnection({ data: { authenticated: true } })).toBe(true);
  });

  it('returns true when authenticated is present at the top level', () => {
    expect(shouldUseAuthenticatedChatConnection({ authenticated: true })).toBe(true);
  });

  it('returns false when authenticated is false or missing', () => {
    expect(shouldUseAuthenticatedChatConnection({ data: { authenticated: false } })).toBe(false);
    expect(shouldUseAuthenticatedChatConnection(undefined)).toBe(false);
  });
});
