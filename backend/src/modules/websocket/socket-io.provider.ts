import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketIoProvider {
  private _server: Server | null = null;

  setServer(server: Server) {
    this._server = server;
  }

  get server(): Server {
    if (!this._server) {
      throw new Error(
        'Socket.IO server not initialized. Call socketIoProvider.setServer() in main.ts bootstrap.',
      );
    }
    return this._server;
  }
}
