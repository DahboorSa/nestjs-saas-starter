import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  sendInvitation,
  uniqueEmail,
} from './helpers/fixtures';
import { UserRole } from '../src/enums';

describe('Organizations (e2e)', () => {
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

  describe('GET /organizations/me', () => {
    it('returns 200 with organization details', async () => {
      const res = await request(server)
        .get('/organizations/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name');
    });
  });

  describe('GET /organizations/members', () => {
    it('returns 200 with array of members', async () => {
      const res = await request(server)
        .get('/organizations/members')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PUT /organizations/me', () => {
    it('returns 200 and updates org name', async () => {
      const newName = `Renamed Org ${Date.now()}`;

      const res = await request(server)
        .put('/organizations/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: newName });

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /organizations/members/:userId/role', () => {
    it('returns 200 and updates a member role', async () => {
      const memberEmail = uniqueEmail('member');
      const inviteToken = await sendInvitation(app, accessToken, memberEmail);

      const acceptRes = await request(server)
        .post('/invitations/accept')
        .query({ token: inviteToken })
        .send({ password: 'Member1234!' });

      expect(acceptRes.status).toBe(200);

      // acceptInvitation returns tokens only — resolve userId via /users/me
      const memberToken = acceptRes.body.accessToken;
      const meRes = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${memberToken}`);
      const memberId = meRes.body.id;

      const res = await request(server)
        .put(`/organizations/members/${memberId}/role`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: UserRole.ADMIN });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /organizations/members/:userId', () => {
    it('returns 200 and removes a member', async () => {
      const memberEmail = uniqueEmail('removable');
      const inviteToken = await sendInvitation(app, accessToken, memberEmail);

      const acceptRes = await request(server)
        .post('/invitations/accept')
        .query({ token: inviteToken })
        .send({ password: 'Member1234!' });

      expect(acceptRes.status).toBe(200);

      const memberToken = acceptRes.body.accessToken;
      const meRes = await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${memberToken}`);
      const memberId = meRes.body.id;

      const res = await request(server)
        .delete(`/organizations/members/${memberId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });
});
