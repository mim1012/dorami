// Chat types for WebSocket communication

/** Username used for system-generated messages (cart/purchase notifications) */
export const SYSTEM_USERNAME = '시스템' as const;

export interface ChatMessage {
  id: string;
  userId: string;
  username: string; // Instagram ID
  message: string;
  timestamp: Date;
  isDeleted: boolean;
}

export interface ChatUser {
  userId: string;
  username: string;
  joinedAt: Date;
}

export interface ChatState {
  messages: ChatMessage[];
  users: ChatUser[];
  userCount: number;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface SendMessagePayload {
  streamKey: string;
  message: string;
}

export interface JoinRoomPayload {
  streamKey: string;
}

export interface LeaveRoomPayload {
  streamKey: string;
}
