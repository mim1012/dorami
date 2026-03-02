import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';

interface ServerOptionsWithNamespace extends ServerOptions {
  namespace?: string;
}

export class CustomIoAdapter extends IoAdapter {
  private io: Server;
  private logger = new Logger('CustomIoAdapter');

  constructor(app: INestApplicationContext, io: Server) {
    super(app);
    this.io = io;
    this.logger.log('CustomIoAdapter constructor called');
  }

  createIOServer(port: number, options?: ServerOptionsWithNamespace): Server {
    const namespace = (options as ServerOptionsWithNamespace | undefined)?.namespace;
    this.logger.log(`createIOServer called with port: ${port}, namespace: ${namespace ?? '/'}`);

    // If a namespace is specified, return the namespace server
    if (options && namespace) {
      const nsp = this.io.of(namespace);
      this.logger.log(`Created namespace: ${namespace}`);
      return nsp as unknown as Server;
    }

    // Otherwise, return the root server
    return this.io;
  }

  create(port: number, options?: ServerOptionsWithNamespace): Server {
    this.logger.log(`create called with port: ${port}`);
    return this.createIOServer(port, options);
  }
}
