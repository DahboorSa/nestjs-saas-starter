import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  getChangeEmailToken,
  uniqueEmail,
} from './helpers/fixtures';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    const tokens = await registerAndVerify(app);
    accessToken = tokens.accessToken;
    userId = tokens.userId;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /users/me', () => {
    it('returns 200 with user profile', async () => {
      const res = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
    });
  });

  describe('PATCH /users/me', () => {
    it('returns 200 with updated profile', async () => {
      const res = await request(server)
        .patch('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ firstName: 'Alice', lastName: 'Smith' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /users/me/email', () => {
    it('returns 200 and queues an email change confirmation', async () => {
      const newEmail = uniqueEmail('newaddr');

      const res = await request(server)
        .post('/users/me/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /users/me/email/confirm', () => {
    it('returns 200 and confirms the email change', async () => {
      const newEmail = uniqueEmail('confirm');

      await request(server)
        .post('/users/me/email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });

      const token = await getChangeEmailToken(app, userId);

      const res = await request(server)
        .post('/users/me/email/confirm')
        .query({ token });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});
