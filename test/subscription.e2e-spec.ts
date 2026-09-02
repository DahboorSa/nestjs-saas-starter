import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify } from './helpers/fixtures';

describe('Subscription (e2e)', () => {
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

  describe('GET /subscription', () => {
    it('returns 200 with current subscription status', async () => {
      const res = await request(server)
        .get('/subscription')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('paymentStatus');
      expect(Array.isArray(res.body.paymentMethods)).toBe(true);
    });
  });
});
