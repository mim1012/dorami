// Base event structure
export interface WebSocketEvent<T = any> {
  type: string;
  data: T;
}

export interface WebSocketError {
  type: 'error';
  errorCode: string;
  message: string;
  timestamp: string;
}

// Chat events
export interface ChatMessageData {
  id: string;
  liveId: string;
  userId: string;
  message: string;
  timestamp: string;
}

export interface ChatMessageEvent extends WebSocketEvent<ChatMessageData> {
  type: 'chat:message';
}

export interface ChatJoinRoomEvent extends WebSocketEvent<{ liveId: string }> {
  type: 'chat:join-room';
}

export interface ChatUserJoinedEvent extends WebSocketEvent<{
  userId: string;
  liveId: string;
  timestamp: string;
}> {
  type: 'chat:user-joined';
}

export interface ChatUserLeftEvent extends WebSocketEvent<{
  userId: string;
  liveId: string;
  timestamp: string;
}> {
  type: 'chat:user-left';
}

// Product events
export interface ProductStockUpdateEvent extends WebSocketEvent<{
  productId: string;
  stock: number;
  timestamp: string;
}> {
  type: 'product:stock:update';
}

// Notification events
export interface NotificationEvent extends WebSocketEvent<{
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
}> {
  type: 'notification:new';
}

// Connection events
export interface ConnectionSuccessEvent extends WebSocketEvent<{
  message: string;
  userId: string;
  timestamp: string;
}> {
  type: 'connection:success';
}
