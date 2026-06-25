import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify } from './helpers/fixtures';

// POST /payments/subscription requires a real Stripe price ID attached to the plan.
// Test seeds use null stripePriceId, so this test only runs when explicitly opted in.
const STRIPE_ENABLED = process.env.RUN_STRIPE_E2E === 'true';

describe('Payments (e2e)', () => {
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

  describe('GET /payments/subscription', () => {
    it('returns 200 with current subscription status', async () => {
      const res = await request(server)
        .get('/payments/subscription')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  // Requires a real Stripe test-mode payment method — skip in CI unless STRIPE_SECRET_KEY is set
  (STRIPE_ENABLED ? describe : describe.skip)(
    'POST /payments/subscription',
    () => {
      it('returns 201 and creates a Stripe subscription', async () => {
        // Use Stripe test payment method pm_card_visa (attach via Stripe API before running)
        const res = await request(server)
          .post('/payments/subscription')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ paymentMethodId: 'pm_card_visa' });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('subscriptionId');
      });
    },
  );
});
