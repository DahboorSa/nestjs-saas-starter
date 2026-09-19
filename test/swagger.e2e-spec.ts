import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { setupSwagger } from '../src/swagger.setup';

describe('Swagger docs (e2e)', () => {
  const originalEnv = process.env.NODE_ENV;
  let app: INestApplication;

  async function createApp(nodeEnv: string): Promise<INestApplication> {
    process.env.NODE_ENV = nodeEnv;
    const moduleFixture = await Test.createTestingModule({}).compile();
    const nestApp = moduleFixture.createNestApplication();
    setupSwagger(nestApp);
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    await app.close();
  });

  it('serves /api/docs when NODE_ENV is QA', async () => {
    app = await createApp('QA');
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    await request(app.getHttpServer()).get('/api/docs-json').expect(200);
  });

  it('does not serve /api/docs when NODE_ENV is production', async () => {
    app = await createApp('production');
    await request(app.getHttpServer()).get('/api/docs').expect(404);
    await request(app.getHttpServer()).get('/api/docs-json').expect(404);
  });
});
