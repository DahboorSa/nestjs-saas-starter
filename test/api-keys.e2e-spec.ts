import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify, createApiKey } from './helpers/fixtures';

describe('API Keys (e2e)', () => {
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

  describe('POST /api-keys', () => {
    it('returns 201 with the new API key', async () => {
      const res = await request(server)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: `key-${Date.now()}`, scopes: ['read'] });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('apiKey');
      expect(res.body).toHaveProperty('keyPrefix');
    });
  });

  describe('GET /api-keys', () => {
    it('returns 200 with list of API keys', async () => {
      const res = await request(server)
        .get('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('returns 200 and removes the key', async () => {
      const { id } = await createApiKey(app, accessToken);

      const res = await request(server)
        .delete(`/api-keys/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });
});
