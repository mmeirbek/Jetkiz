import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UsersRepository } from '../users/repositories/users.repository';
import { TokenService } from '../auth/services/token.service';
import type { AuthUser } from '../common/types/auth-user.type';
import { RealtimeService } from './realtime.service';
import {
  REALTIME_NAMESPACE,
  RealtimeSubscriptionResult,
  realtimeRoom,
} from './ws-types';
import type { RealtimeSubscription } from './ws-types';

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  cors: { origin: '*' },
})
export class RealtimeGateway {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly tokenService: TokenService,
    private readonly usersRepository: UsersRepository,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.attachServer(server);
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() subscription: RealtimeSubscription,
  ): Promise<RealtimeSubscriptionResult> {
    const authUser = this.authUser(socket);

    const access = await this.realtimeService.canAccess(authUser, subscription);
    if (!access.ok) {
      return { ok: false, error: access.reason };
    }

    await socket.join(realtimeRoom(subscription.type, subscription.id));
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() subscription: RealtimeSubscription,
  ): Promise<RealtimeSubscriptionResult> {
    await socket.leave(realtimeRoom(subscription.type, subscription.id));
    return { ok: true };
  }

  private authenticate = async (
    socket: Socket,
    next: (err?: Error) => void,
  ) => {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        next(new Error('Missing token'));
        return;
      }

      const payload = await this.tokenService.verifyAccessToken(token);
      const user = await this.usersRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        next(new Error('User is not active'));
        return;
      }

      const data = socket.data as { authUser?: AuthUser };
      data.authUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  };

  private extractToken(socket: Socket): string | undefined {
    const auth = socket.handshake.auth as Record<string, unknown> | undefined;
    const query = socket.handshake.query as Record<string, unknown>;
    const value =
      (typeof auth?.token === 'string' && auth.token) ||
      (typeof query?.token === 'string' && query.token);
    return value || undefined;
  }

  private authUser(socket: Socket): AuthUser {
    const data = socket.data as { authUser?: AuthUser };
    return data.authUser!;
  }
}
