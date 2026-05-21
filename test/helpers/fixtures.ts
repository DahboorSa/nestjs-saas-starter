import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CacheService } from '../../src/cache/cache.service';
import { UserRole } from '../../src/enums';
import { WebhookEvent } from '../../src/enums';

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  orgId: string;
  email: string;
  password: string;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}+${Date.now()}+${Math.random().toString(36).slice(2)}@test.com`;
}

async function getTokenFromCache(
  app: INestApplication,
  pattern: string,
  userId: string,
): Promise<string> {
  const cacheService = app.get(CacheService);
  const keys = await cacheService.getByPattern(pattern);
  for (const key of keys) {
    const raw = await cacheService.get(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    if (parsed.userId === userId) {
      const prefix = pattern.replace('*', '');
      return key.replace(prefix, '');
    }
  }
  throw new Error(
    `No cache entry found matching ${pattern} for userId=${userId}`,
  );
}

export async function registerAndVerify(
  app: INestApplication,
  overrides: {
    email?: string;
    password?: string;
    name?: string;
    plan?: string;
  } = {},
): Promise<UserTokens> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'Test1234!';
  const name = overrides.name ?? `Org ${Date.now()}`;
  const server = app.getHttpServer();

  const registerRes = await request(server)
    .post('/auth/register')
    .send({
      email,
      password,
      name,
      ...(overrides.plan ? { plan: overrides.plan } : {}),
    });

  if (registerRes.status !== 201) {
    throw new Error(`Register failed: ${JSON.stringify(registerRes.body)}`);
  }

  const { userId, organizationId } = registerRes.body;

  const verifyToken = await getTokenFromCache(app, 'verify:email:*', userId);
  const verifyRes = await request(server)
    .post('/auth/verify-email')
    .query({ token: verifyToken });

  if (verifyRes.status !== 200) {
    throw new Error(`Email verify failed: ${JSON.stringify(verifyRes.body)}`);
  }

  const loginRes = await request(server)
    .post('/auth/login')
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    accessToken: loginRes.body.accessToken,
    refreshToken: loginRes.body.refreshToken,
    userId,
    orgId: organizationId,
    email,
    password,
  };
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

export async function createApiKey(
  app: INestApplication,
  accessToken: string,
): Promise<{ id: number; apiKey: string }> {
  const name = `key-${Date.now()}`;
  const createRes = await request(app.getHttpServer())
    .post('/api-keys')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name, scopes: ['read'] });
  if (createRes.status !== 201) {
    throw new Error(`Create API key failed: ${JSON.stringify(createRes.body)}`);
  }
  // id is not returned on creation — fetch it from the list
  const listRes = await request(app.getHttpServer())
    .get('/api-keys')
    .set('Authorization', `Bearer ${accessToken}`);
  const record = listRes.body.find((k: any) => k.name === name);
  if (!record) throw new Error('Created API key not found in list');
  return { id: record.id, apiKey: createRes.body.apiKey };
}

export async function createWebhook(
  app: INestApplication,
  accessToken: string,
): Promise<{ id: string }> {
  const res = await request(app.getHttpServer())
    .post('/webhooks')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      url: 'https://example.com/hook',
      events: [WebhookEvent.MEMBER_INVITED],
    });
  if (res.status !== 201) {
    throw new Error(`Create webhook failed: ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.id };
}

export async function sendInvitation(
  app: INestApplication,
  accessToken: string,
  email: string,
): Promise<string> {
  const server = app.getHttpServer();
  const inviteRes = await request(server)
    .post('/invitations')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ email, role: UserRole.MEMBER });

  if (inviteRes.status !== 201 && inviteRes.status !== 200) {
    throw new Error(
      `Send invitation failed: ${JSON.stringify(inviteRes.body)}`,
    );
  }

  const cacheService = app.get(CacheService);
  const keys = await cacheService.getByPattern('invite:*');
  for (const key of keys) {
    const raw = await cacheService.get(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw);
    if (parsed.email === email) {
      return key.replace('invite:', '');
    }
  }
  throw new Error(`No invite token found for email=${email}`);
}

export async function getResetPasswordToken(
  app: INestApplication,
  userId: string,
): Promise<string> {
  return getTokenFromCache(app, 'reset:password:*', userId);
}

export async function getChangeEmailToken(
  app: INestApplication,
  userId: string,
): Promise<string> {
  return getTokenFromCache(app, 'change:email:*', userId);
}
