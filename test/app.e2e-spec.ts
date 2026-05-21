import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app.setup';

describe('App health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /plans responds (app is reachable)', async () => {
    const res = await request(app.getHttpServer()).get('/plans');
    expect(res.status).toBeLessThan(500);
  });
});
