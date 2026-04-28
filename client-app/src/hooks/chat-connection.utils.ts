export interface ChatConnectionSuccessPayload {
  authenticated?: boolean;
  data?: {
    authenticated?: boolean;
  };
}

export function shouldUseAuthenticatedChatConnection(
  payload?: ChatConnectionSuccessPayload,
): boolean {
  return payload?.authenticated === true || payload?.data?.authenticated === true;
}
