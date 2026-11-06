import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import {
  registerAndVerify,
  uniqueEmail,
  sendInvitation,
} from './helpers/fixtures';
import { DataSource } from 'typeorm';
import { CacheService } from '../src/cache/cache.service';
import { hashToken } from '../src/common/utils/hash-token.util';
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

    it('stores only the token hash in the database', async () => {
      const email = uniqueEmail('hashed');
      const token = await sendInvitation(app, accessToken, email);

      const rows = await app
        .get(DataSource)
        .query('SELECT * FROM invitations WHERE email = $1', [email]);

      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).toBe(hashToken(token));
      expect(JSON.stringify(rows[0])).not.toContain(token);
    });

    it('accepts via the database when the cached invite is gone', async () => {
      const email = uniqueEmail('nocache');
      const token = await sendInvitation(app, accessToken, email);
      await app.get(CacheService).delete(`invite:${hashToken(token)}`);

      const res = await request(server)
        .post('/invitations/accept')
        .query({ token })
        .send({ password: 'Accept1234!' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });
});
