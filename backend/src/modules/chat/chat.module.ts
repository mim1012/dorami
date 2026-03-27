import { Module } from '@nestjs/common';

// ChatGateway removed — /chat namespace is manually handled in main.ts
// with Redis adapter, chat history, and room management.
// The NestJS @WebSocketGateway decorator conflicts with the manual setup.
@Module({})
export class ChatModule {}
