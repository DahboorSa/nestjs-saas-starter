import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.setup';
import { registerAndVerify } from './helpers/fixtures';
import { AI_PROVIDER } from '../src/modules/onboarding/providers/ai-provider.interface';

describe('Onboarding (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();

    const aiProvider = app.get(AI_PROVIDER);
    jest
      .spyOn(aiProvider, 'ask')
      .mockResolvedValue('Welcome! Here is how to get started...');

    const tokens = await registerAndVerify(app);
    accessToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('POST /onboarding/ask', () => {
    it('returns 200 with an answer', async () => {
      const res = await request(server)
        .post('/onboarding/ask')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ question: 'How do I invite a member?' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('answer');
      expect(typeof res.body.answer).toBe('string');
    });

    it('returns 400 when question is missing', async () => {
      const res = await request(server)
        .post('/onboarding/ask')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when question exceeds 2000 characters', async () => {
      const res = await request(server)
        .post('/onboarding/ask')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ question: 'a'.repeat(2001) });

      expect(res.status).toBe(400);
    });

    it('returns 400 when unknown field is sent', async () => {
      const res = await request(server)
        .post('/onboarding/ask')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ question: 'How do I invite a member?', extra: 'field' });

      expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(server)
        .post('/onboarding/ask')
        .send({ question: 'How do I invite a member?' });

      expect(res.status).toBe(401);
    });
  });
});
