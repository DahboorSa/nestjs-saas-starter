import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify } from './helpers/fixtures';

describe('Usage (e2e)', () => {
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

  describe('GET /usage', () => {
    it('returns 200 with usage stats for the org', async () => {
      const res = await request(server)
        .get('/usage')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('apiCalls');
    });
  });
});
