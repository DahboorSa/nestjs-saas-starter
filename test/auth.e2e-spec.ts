import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  uniqueEmail,
  getResetPasswordToken,
} from './helpers/fixtures';
import { CacheService } from '../src/cache/cache.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('returns 201 with userId and organizationId', async () => {
      const res = await request(server)
        .post('/auth/register')
        .send({
          email: uniqueEmail('register'),
          password: 'Test1234!',
          name: `Org ${Date.now()}`,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId');
      expect(res.body).toHaveProperty('organizationId');
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('returns 200 and marks user as verified', async () => {
      const email = uniqueEmail('verify');
      const regRes = await request(server)
        .post('/auth/register')
        .send({ email, password: 'Test1234!', name: `Org ${Date.now()}` });

      expect(regRes.status).toBe(201);
      const { userId } = regRes.body;

      const cacheService = app.get(CacheService);
      const keys = await cacheService.getByPattern('verify:email:*');
      let token: string | null = null;
      for (const key of keys) {
        const raw = await cacheService.get(key);
        if (raw && JSON.parse(raw).userId === userId) {
          token = key.replace('verify:email:', '');
          break;
        }
      }
      expect(token).not.toBeNull();

      const res = await request(server)
        .post('/auth/verify-email')
        .query({ token });

      expect(res.status).toBe(200);
      expect(res.body.isVerified).toBe(true);
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with accessToken and refreshToken', async () => {
      const { email, password } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
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
    it('returns 200 with new token pair', async () => {
      const { refreshToken } = await registerAndVerify(app);

      const res = await request(server)
        .post('/auth/refresh-token')
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
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
