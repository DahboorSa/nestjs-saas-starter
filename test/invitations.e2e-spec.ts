import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  uniqueEmail,
  sendInvitation,
} from './helpers/fixtures';
import { InvitationStatus, UserRole } from '../src/enums';

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    const tokens = await registerAndVerify(app);
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('POST /invitations', () => {
    it('returns 201 and sends invitations', async () => {
      const res = await request(server)
        .post('/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([{ email: uniqueEmail('invite'), role: UserRole.MEMBER }]);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results[0]).toMatchObject({ success: true });
    });
  });

  describe('GET /invitations', () => {
    it('returns 200 with pending invitations list', async () => {
      // Ensure at least one invitation exists
      await request(server)
        .post('/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([{ email: uniqueEmail('list'), role: UserRole.MEMBER }]);

      const res = await request(server)
        .get('/invitations')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ status: InvitationStatus.PENDING });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /invitations/accept', () => {
    it('returns 200 and creates the invited user', async () => {
      const email = uniqueEmail('accept');
      const token = await sendInvitation(app, accessToken, email);

      const res = await request(server)
        .post('/invitations/accept')
        .query({ token })
        .send({ password: 'Accept1234!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });
  });
});
