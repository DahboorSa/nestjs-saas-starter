import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UserService } from '../../src/modules/users/user.service';
import { UserRole } from '../../src/enums';
import { WebhookEvent } from '../../src/enums';
import { queuedEmails } from './app.setup';

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

function extractRefreshToken(setCookieHeaders: string | string[]): string {
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  const match = headers.find((c) => c.startsWith('refreshToken='));
  if (!match) throw new Error('No refreshToken cookie in response');
  return match.split(';')[0].replace('refreshToken=', '');
}

// Redis keeps only hashToken(token), so the raw token comes from the email
// job the app queued. Returns the most recent matching job's token.
function getEmailToken(
  jobName: string,
  match: { email?: string; userId?: string },
): string {
  for (let i = queuedEmails.length - 1; i >= 0; i--) {
    const { name, data } = queuedEmails[i];
    if (name !== jobName || !data.token) continue;
    if (match.email && data.email !== match.email) continue;
    if (match.userId && data.userId !== match.userId) continue;
    return data.token;
  }
  throw new Error(`No ${jobName} email queued for ${JSON.stringify(match)}`);
}

// POST /auth/register deliberately returns only a message (no IDs), so tests
// look the new user up by email.
export async function getUserIdsByEmail(
  app: INestApplication,
  email: string,
): Promise<{ userId: string; orgId: string }> {
  const user = await app.get(UserService).getByEmail(email.toLowerCase(), true);
  if (!user) throw new Error(`No user found for ${email}`);
  return { userId: user.id, orgId: user.organization.id };
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

  const { userId, orgId: organizationId } = await getUserIdsByEmail(app, email);

  const verifyToken = getVerifyEmailToken(email);
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
    refreshToken: extractRefreshToken(loginRes.headers['set-cookie']),
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
    refreshToken: extractRefreshToken(res.headers['set-cookie']),
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
    .send([{ email, role: UserRole.MEMBER }]);

  if (inviteRes.status !== 201 && inviteRes.status !== 200) {
    throw new Error(
      `Send invitation failed: ${JSON.stringify(inviteRes.body)}`,
    );
  }

  return getEmailToken('invite.email', { email });
}

export async function getResetPasswordToken(
  app: INestApplication,
  userId: string,
): Promise<string> {
  return getEmailToken('forgot-password.email', { userId });
}

export async function getChangeEmailToken(
  app: INestApplication,
  userId: string,
): Promise<string> {
  return getEmailToken('change-email.email', { userId });
}

export function getVerifyEmailToken(email: string): string {
  return getEmailToken('welcome.email', { email: email.toLowerCase() });
}
