import { UserRole } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';
import { REALTIME_NAMESPACE, realtimeRoom } from './ws-types';

describe('RealtimeGateway', () => {
  const tokenServiceMock = {
    verifyAccessToken: jest.fn(),
  };

  const usersRepositoryMock = {
    findById: jest.fn(),
  };

  const realtimeServiceMock = {
    attachServer: jest.fn(),
    canAccess: jest.fn(),
  };

  const authUser = {
    id: 'user-1',
    email: 'user@caspex.local',
    firstName: 'U',
    lastName: 'SER',
    phone: '+77000000000',
    role: UserRole.SUPERADMIN,
    isActive: true,
  };

  const makeSocket = () => {
    const handlers: Record<string, unknown> = {};
    const socket = {
      data: {},
      handshake: { auth: {}, query: {} },
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockImplementation((event: string, fn: unknown) => {
        handlers[event] = fn;
      }),
      _handlers: handlers,
    };
    return socket;
  };

  let gateway: RealtimeGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new RealtimeGateway(
      realtimeServiceMock as never,
      tokenServiceMock as never,
      usersRepositoryMock as never,
    );
  });

  it('attaches the server on init', () => {
    const server = { use: jest.fn() };
    gateway.afterInit(server as never);
    expect(realtimeServiceMock.attachServer).toHaveBeenCalledWith(server);
    expect(server.use).toHaveBeenCalledTimes(1);
  });

  it('authenticates a socket with a valid token', async () => {
    const socket = makeSocket();
    socket.handshake.auth = { token: 'valid-token' };
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ sub: 'user-1' });
    usersRepositoryMock.findById.mockResolvedValue(authUser);

    const next = jest.fn();
    await (
      gateway as unknown as {
        authenticate: (s: unknown, n: unknown) => Promise<void>;
      }
    ).authenticate(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toHaveProperty('authUser', authUser);
  });

  it('rejects a socket without a token', async () => {
    const socket = makeSocket();
    const next = jest.fn();
    await (
      gateway as unknown as {
        authenticate: (s: unknown, n: unknown) => Promise<void>;
      }
    ).authenticate(socket, next);

    expect(next).toHaveBeenCalledWith(new Error('Missing token'));
  });

  it('rejects a socket with an invalid token', async () => {
    const socket = makeSocket();
    socket.handshake.auth = { token: 'bad-token' };
    tokenServiceMock.verifyAccessToken.mockRejectedValue(new Error('bad'));

    const next = jest.fn();
    await (
      gateway as unknown as {
        authenticate: (s: unknown, n: unknown) => Promise<void>;
      }
    ).authenticate(socket, next);

    expect(next).toHaveBeenCalledWith(new Error('Unauthorized'));
  });

  it('subscribes an authorized user to a room', async () => {
    const socket = makeSocket();
    socket.data = { authUser };
    realtimeServiceMock.canAccess.mockResolvedValue({ ok: true });

    const result = await gateway.handleSubscribe(socket as never, {
      type: 'vehicle',
      id: 'vehicle-1',
    });

    expect(realtimeServiceMock.canAccess).toHaveBeenCalledWith(authUser, {
      type: 'vehicle',
      id: 'vehicle-1',
    });
    expect(socket.join).toHaveBeenCalledWith(
      realtimeRoom('vehicle', 'vehicle-1'),
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects subscription when access is denied', async () => {
    const socket = makeSocket();
    socket.data = { authUser };
    realtimeServiceMock.canAccess.mockResolvedValue({
      ok: false,
      reason: 'Access denied',
    });

    const result = await gateway.handleSubscribe(socket as never, {
      type: 'order',
      id: 'order-1',
    });

    expect(socket.join).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: 'Access denied' });
  });

  it('unsubscribes from a room', async () => {
    const socket = makeSocket();
    socket.data = { authUser };

    const result = await gateway.handleUnsubscribe(socket as never, {
      type: 'order',
      id: 'order-1',
    });

    expect(socket.leave).toHaveBeenCalledWith(realtimeRoom('order', 'order-1'));
    expect(result).toEqual({ ok: true });
  });

  it('exposes the realtime namespace constant', () => {
    expect(REALTIME_NAMESPACE).toBe('caspex');
  });
});
