import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';

export type AuthenticatedSocket = Socket & {
  user: {
    userId: string;
    email: string;
    role: string;
  };
};

export async function authenticateSocket(
  socket: Socket,
  jwtService: JwtService,
): Promise<AuthenticatedSocket> {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new WsException('No token provided');
  }

  try {
    const payload = await jwtService.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
    });

    (socket as AuthenticatedSocket).user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    return socket as AuthenticatedSocket;
  } catch (error) {
    throw new WsException('Invalid token');
  }
}
