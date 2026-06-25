import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify, createWebhook } from './helpers/fixtures';
import { WebhookEvent } from '../src/enums';

describe('Webhooks (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    // Pro plan required — Free plan blocks webhook creation (maxWebhooks: 0)
    const tokens = await registerAndVerify(app, { plan: 'Pro' });
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('POST /webhooks', () => {
    it('returns 201 with created webhook endpoint', async () => {
      const res = await request(server)
        .post('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          url: 'https://example.com/hook',
          events: [WebhookEvent.MEMBER_INVITED],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('url');
    });
  });

  describe('GET /webhooks', () => {
    it('returns 200 with list of webhooks', async () => {
      await createWebhook(app, accessToken);

      const res = await request(server)
        .get('/webhooks')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /webhooks/:id/deliveries', () => {
    it('returns 200 with delivery history for a webhook', async () => {
      const { id } = await createWebhook(app, accessToken);

      const res = await request(server)
        .get(`/webhooks/${id}/deliveries`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('DELETE /webhooks/:id', () => {
    it('returns 200 and removes the webhook', async () => {
      const { id } = await createWebhook(app, accessToken);

      const res = await request(server)
        .delete(`/webhooks/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });
});
