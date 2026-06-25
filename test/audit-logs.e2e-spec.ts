import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify, createApiKey } from './helpers/fixtures';

// Audit log creation is fire-and-forget (.catch pattern), so we give the
// event loop a tick to flush the pending DB write before asserting.
const settle = () => new Promise((r) => setTimeout(r, 100));

describe('Audit Logs (e2e)', () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ─── GET /audit-logs ──────────────────────────────────────────────────────────

  describe('GET /audit-logs', () => {
    it('returns 401 when no auth token is provided', async () => {
      const res = await request(server).get('/audit-logs');
      expect(res.status).toBe(401);
    });

    it('returns 200 and an array for an authenticated user', async () => {
      const { accessToken } = await registerAndVerify(app);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('includes USER_REGISTER (auth.register) action — not filtered as an auth action', async () => {
      const { accessToken } = await registerAndVerify(app);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const actions: string[] = res.body.map((l: any) => l.action);
      expect(actions).toContain('auth.register');
    });

    it('excludes AUTH_* actions such as login and logout', async () => {
      const { accessToken } = await registerAndVerify(app);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const actions: string[] = res.body.map((l: any) => l.action);
      expect(actions).not.toContain('auth.login');
      expect(actions).not.toContain('auth.logout');
      expect(actions).not.toContain('auth.verify_email');
      expect(actions).not.toContain('auth.refresh_token');
    });

    it('includes apikey.created after an API key is created', async () => {
      const { accessToken } = await registerAndVerify(app);
      await createApiKey(app, accessToken);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const actions: string[] = res.body.map((l: any) => l.action);
      expect(actions).toContain('apikey.created');
    });

    it('returns only the expected fields per log entry', async () => {
      const { accessToken } = await registerAndVerify(app);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      const entry = res.body[0];
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('resourceType');
      expect(entry).toHaveProperty('resourceId');
      expect(entry).toHaveProperty('metadata');
      expect(entry).toHaveProperty('createdAt');
      // id, ipAddress, userAgent must not be exposed
      expect(entry).not.toHaveProperty('id');
      expect(entry).not.toHaveProperty('ipAddress');
      expect(entry).not.toHaveProperty('userAgent');
    });

    it('returns results in descending createdAt order', async () => {
      const { accessToken } = await registerAndVerify(app);
      await createApiKey(app, accessToken);
      await settle();

      const res = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      const dates = res.body.map((l: any) => new Date(l.createdAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('does not return logs from a different organization', async () => {
      const orgA = await registerAndVerify(app);
      const orgB = await registerAndVerify(app);
      await settle();

      const resA = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${orgA.accessToken}`);

      const resB = await request(server)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${orgB.accessToken}`);

      // Both orgs see their own register event
      const actionsA: string[] = resA.body.map((l: any) => l.action);
      const actionsB: string[] = resB.body.map((l: any) => l.action);
      expect(actionsA).toContain('auth.register');
      expect(actionsB).toContain('auth.register');

      // Lengths should be equal (each org has only its own logs)
      expect(resA.body.length).toBe(resB.body.length);
    });

    describe('date filtering', () => {
      // Use 48-hour offsets so tests are immune to Docker/host clock skew of
      // up to a few hours (observed: Docker clock ~1h ahead of the host).

      it('returns an empty array when from is set 48h in the future', async () => {
        const { accessToken } = await registerAndVerify(app);
        await settle();

        const futureDate = new Date(
          Date.now() + 48 * 60 * 60 * 1000,
        ).toISOString();
        const res = await request(server)
          .get('/audit-logs')
          .query({ from: futureDate })
          .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });

      it('returns results when from and to span a 4-day window around now', async () => {
        const { accessToken } = await registerAndVerify(app);
        await settle();

        const from = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const to = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

        const res = await request(server)
          .get('/audit-logs')
          .query({ from, to })
          .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
      });

      it('returns an empty array when the range ends 48h before now', async () => {
        const { accessToken } = await registerAndVerify(app);
        await settle();

        const from = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const to = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const res = await request(server)
          .get('/audit-logs')
          .query({ from, to })
          .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      });
    });
  });
});
