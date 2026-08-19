import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const REQUEST_TIMEOUT_MS = 15_000;
type RequestTarget = Parameters<typeof request>[0];

function withTimeout<T extends request.Test>(test: T): T {
  return test.timeout({
    response: REQUEST_TIMEOUT_MS,
    deadline: REQUEST_TIMEOUT_MS,
  });
}

function toRequestTarget(value: unknown): RequestTarget {
  if (
    (typeof value !== 'object' || value === null) &&
    typeof value !== 'function'
  ) {
    throw new Error('Invalid http server target');
  }

  return value as RequestTarget;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }

  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`${label}.${key} must be a string`);
  }

  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
  label: string,
): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`${label}.${key} must be a boolean`);
  }

  return value;
}

async function cleanDatabase(app: INestApplication) {
  console.log('[DEBUG] Cleaning database...');
  const prisma = app.get(PrismaService);
  // Delete mock test users and their tokens to make sure test runs in clean slate
  await prisma.refreshToken.deleteMany({
    where: {
      user: {
        email: 'test_client@caspex.local',
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      email: 'test_client@caspex.local',
    },
  });
  console.log('[DEBUG] Database cleaned!');
}

async function main() {
  let app: INestApplication | null = null;

  try {
    console.log(
      '[DEBUG] DATABASE_URL in process.env:',
      process.env.DATABASE_URL,
    );
    console.log('[DEBUG] Initializing Nest application...');
    app = await NestFactory.create(AppModule, { logger: false });
    console.log('[DEBUG] App created, calling app.init()...');
    await app.init();
    console.log('[DEBUG] App initialized successfully!');

    await cleanDatabase(app);

    const rawServer: unknown = app.getHttpServer();
    const server = toRequestTarget(rawServer);

    console.log('--- STARTING CASP_X AUTH SMOKE TESTS ---');

    // 1. Register Client account
    console.log('Testing [POST /auth/register] ...');
    const registerRes = await withTimeout(
      request(server).post('/auth/register').send({
        email: 'test_client@caspex.local',
        password: 'CaspXPass_123',
        role: 'CLIENT',
        firstName: 'Alibi',
        lastName: 'Samatov',
        phone: '+77017777777',
        city: 'Aktau',
        country: 'Kazakhstan',
      }),
    ).expect(201);

    const registerBody = asRecord(registerRes.body, 'registerRes.body');
    const registeredUser = asRecord(registerBody.user, 'registerRes.body.user');
    const registeredEmail = readString(
      registeredUser,
      'email',
      'registerRes.body.user',
    );
    console.log(`✅ Registration Success: email=${registeredEmail}`);

    // 2. Register Client Duplicate check
    console.log('Testing [POST /auth/register] Duplicate Email ...');
    await withTimeout(
      request(server).post('/auth/register').send({
        email: 'test_client@caspex.local',
        password: 'CaspXPass_123',
        role: 'CLIENT',
        firstName: 'Alibi',
        lastName: 'Samatov',
        phone: '+77017777777',
      }),
    ).expect(409);
    console.log('✅ Duplicate Registration Properly Blocked (409)');

    // 3. Login
    console.log('Testing [POST /auth/login] ...');
    const loginRes = await withTimeout(
      request(server)
        .post('/auth/login')
        .send({ email: 'test_client@caspex.local', password: 'CaspXPass_123' }),
    ).expect(201);

    const loginBody = asRecord(loginRes.body, 'loginRes.body');
    const access = readString(loginBody, 'accessToken', 'loginRes');
    const refresh = readString(loginBody, 'refreshToken', 'loginRes');
    console.log('✅ Login Success: received access and refresh tokens');

    // 4. Me Profile
    console.log('Testing [GET /auth/me] with Access Token ...');
    const meRes = await withTimeout(
      request(server).get('/auth/me').set('Authorization', `Bearer ${access}`),
    ).expect(200);

    const meBody = asRecord(meRes.body, 'meRes.body');
    const meUser = asRecord(meBody.user, 'meRes.body.user');
    const meRole = readString(meUser, 'role', 'meRes.body.user');
    console.log(`✅ Profile Retrieve Success: role=${meRole}`);

    // 5. Refresh
    console.log('Testing [POST /auth/refresh] ...');
    const refreshRes = await withTimeout(
      request(server).post('/auth/refresh').send({ refreshToken: refresh }),
    ).expect(201);
    const refreshBody = asRecord(refreshRes.body, 'refreshRes.body');
    const rotatedRefresh = readString(
      refreshBody,
      'refreshToken',
      'refreshRes',
    );
    console.log('✅ Token Rotation Success: received new token pair');

    // 6. Logout
    console.log('Testing [POST /auth/logout] ...');
    const logoutRes = await withTimeout(
      request(server)
        .post('/auth/logout')
        .send({ refreshToken: rotatedRefresh }),
    ).expect(201);
    const logoutBody = asRecord(logoutRes.body, 'logoutRes.body');
    const logoutSuccess = readBoolean(logoutBody, 'success', 'logoutRes');
    console.log(`✅ Logout Success: ${logoutSuccess}`);

    // 7. Refresh Denied after Logout
    console.log(
      'Testing [POST /auth/refresh] with Expired/Revoked Token (Expect 401) ...',
    );
    await withTimeout(
      request(server)
        .post('/auth/refresh')
        .send({ refreshToken: rotatedRefresh }),
    ).expect(401);
    console.log('✅ Refresh Blocked after Logout');

    console.log('🎉 ALL AUTH SMOKE TESTS PASSED SUCCESSFULLY! 🎉');
  } finally {
    if (app) {
      try {
        await Promise.race([
          app.close(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('app.close timeout')), 5_000),
          ),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to close app cleanly: ${message}`);
      }
    }
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
