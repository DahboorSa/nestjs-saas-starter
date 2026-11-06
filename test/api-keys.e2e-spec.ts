import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { DataSource } from 'typeorm';
import { CacheService } from '../src/cache/cache.service';
import { hashToken } from '../src/common/utils/hash-token.util';
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

    it('stores an optional expiresAt and lists it', async () => {
      const { accessToken: token } = await registerAndVerify(app);
      const expiresAt = new Date(Date.now() + 86_400_000).toISOString();

      const created = await request(server)
        .post('/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'expiring', scopes: ['read'], expiresAt });
      const list = await request(server)
        .get('/api-keys')
        .set('Authorization', `Bearer ${token}`);

      expect(created.status).toBe(201);
      expect(new Date(list.body[0].expiresAt).toISOString()).toBe(expiresAt);
    });

    it.each([
      ['a past date', () => new Date(Date.now() - 60_000).toISOString()],
      ['not a date', () => 'tomorrow-ish'],
    ])('rejects expiresAt that is %s', async (_label, value) => {
      const res = await request(server)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'bad', scopes: ['read'], expiresAt: value() });

      expect(res.status).toBe(400);
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

  describe('authenticating with an API key', () => {
    const cacheKey = (apiKey: string) => `apikey:valid:${hashToken(apiKey)}`;
    const useKey = (apiKey: string) =>
      request(server).get('/api-keys').set('Authorization', `Bearer ${apiKey}`);

    // A new org per test: the Free plan allows only two API keys.
    const freshKey = async () => {
      const { accessToken: token } = await registerAndVerify(app);
      return { token, ...(await createApiKey(app, token)) };
    };

    it('accepts a valid key', async () => {
      const { apiKey } = await freshKey();

      expect((await useKey(apiKey)).status).toBe(200);
    });

    it('rejects an expired key even while its cached copy is alive', async () => {
      const { id, apiKey } = await freshKey();
      const past = new Date(Date.now() - 60_000);
      await app
        .get(DataSource)
        .query('UPDATE api_keys SET expires_at = $1 WHERE id = $2', [past, id]);
      await app
        .get(CacheService)
        .set(
          cacheKey(apiKey),
          JSON.stringify({ id, orgId: 'x', scopes: ['read'], expiresAt: past }),
          300,
        );

      expect((await useKey(apiKey)).status).toBe(401);
    });

    it('rejects an expired key on the database path', async () => {
      const { id, apiKey } = await freshKey();
      await app.get(CacheService).delete(cacheKey(apiKey));
      await app
        .get(DataSource)
        .query('UPDATE api_keys SET expires_at = $1 WHERE id = $2', [
          new Date(Date.now() - 60_000),
          id,
        ]);

      expect((await useKey(apiKey)).status).toBe(401);
    });

    it('caches the key after a database lookup', async () => {
      const { apiKey } = await freshKey();
      await app.get(CacheService).delete(cacheKey(apiKey));

      expect((await useKey(apiKey)).status).toBe(200);

      expect(await app.get(CacheService).get(cacheKey(apiKey))).not.toBeNull();
    });

    it('updates last_used_at at most once a minute', async () => {
      const { id, apiKey } = await freshKey();
      const db = app.get(DataSource);
      const lastUsed = async () =>
        (
          await db.query('SELECT last_used_at FROM api_keys WHERE id = $1', [
            id,
          ])
        )[0].last_used_at as Date | null;

      await useKey(apiKey);
      let first: Date | null = null;
      for (let i = 0; i < 30 && !first; i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        first = await lastUsed();
      }
      expect(first).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 50));
      await useKey(apiKey);
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(await lastUsed()).toEqual(first);
    });

    it('rejects a revoked key', async () => {
      const { id, apiKey, token } = await freshKey();
      await request(server)
        .delete(`/api-keys/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect((await useKey(apiKey)).status).toBe(401);
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
