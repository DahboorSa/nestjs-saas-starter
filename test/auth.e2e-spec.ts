import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  uniqueEmail,
  getResetPasswordToken,
  getVerifyEmailToken,
} from './helpers/fixtures';
import { CacheService } from '../src/cache/cache.service';
import { hashToken } from '../src/common/utils/hash-token.util';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('POST /auth/register', () => {
    it('returns 201 with only a message (no account IDs)', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({
          email: uniqueEmail('register'),
          password: 'Test1234!',
          name: `Org ${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(Object.keys(res.body)).toEqual(['message']);
    });

    it('answers an already-registered email exactly like a new one', async () => {
      const email = uniqueEmail('dupe');
      const body = { password: 'Test1234!', name: `Org ${Date.now()}` };
      const first = await request(server)
        .post('/auth/register')
        .send({ email, ...body });

      const second = await request(server)
        .post('/auth/register')
        .send({ email, ...body, name: `Other ${Date.now()}` });
      const differentCase = await request(server)
        .post('/auth/register')
        .send({ email: email.toUpperCase(), ...body });

      expect(second.status).toBe(first.status);
      expect(second.body).toEqual(first.body);
      expect(differentCase.status).toBe(first.status);
      expect(differentCase.body).toEqual(first.body);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('returns 200 and marks user as verified', async () => {
      const email = uniqueEmail('verify');
      const regRes = await request(server)
        .post('/auth/register')
        .send({ email, password: 'Test1234!', name: `Org ${Date.now()}` });

      expect(regRes.status).toBe(201);

      const token = getVerifyEmailToken(email);

      // Redis must hold only the hash of the token, never the token itself.
      const cacheService = app.get(CacheService);
      expect(
        await cacheService.get(`verify:email:${hashToken(token)}`),
      ).not.toBeNull();
      expect(await cacheService.get(`verify:email:${token}`)).toBeNull();

      const res = await request(server)
        .post('/auth/verify-email')
        .query({ token });

      expect(res.status).toBe(200);
      expect(res.body.isVerified).toBe(true);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with accessToken and sets refreshToken cookie', async () => {
      const { email, password } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');
      const cookies: string[] = ([] as string[]).concat(
        res.headers['set-cookie'] ?? [],
      );
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('returns 200 for a registered but unverified email', async () => {
      const email = uniqueEmail('resend');
      await request(server)
        .post('/auth/register')
        .send({ email, password: 'Test1234!', name: `Org ${Date.now()}` });

      const res = await request(server)
        .post('/auth/resend-verification')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/refresh-token', () => {
    it('returns 200 with new accessToken and rotates cookie', async () => {
      const { refreshToken } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/refresh-token')
        .set('Cookie', `refreshToken=${refreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');
      const cookies: string[] = ([] as string[]).concat(
        res.headers['set-cookie'] ?? [],
      );
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns 200 for a verified user email', async () => {
      const { email } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/forgot-password')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns 200 and resets the password', async () => {
      const { email, userId } = await registerAndVerify(app);

      await request(server).post('/auth/forgot-password').send({ email });

      const token = await getResetPasswordToken(app, userId);

      const newPassword = 'NewPass5678!';
      const res = await request(server)
        .post('/auth/reset-password')
        .send({ token, password: newPassword, confirmPassword: newPassword });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  describe('POST /auth/change-password', () => {
    it('returns 200 when changing password with valid credentials', async () => {
      const { accessToken, password } = await registerAndVerify(app);
      const newPassword = 'Changed5678!';

      const res = await request(server)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          oldPassword: password,
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 200 and invalidates the session', async () => {
      const { accessToken } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});
