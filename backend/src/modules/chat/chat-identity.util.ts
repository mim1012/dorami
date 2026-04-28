interface ChatUserIdentity {
  instagramId?: string | null;
  name?: string | null;
}

const normalizeValue = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function resolveChatUsername(user: ChatUserIdentity | null | undefined): string {
  return normalizeValue(user?.instagramId) ?? normalizeValue(user?.name) ?? '익명';
}
