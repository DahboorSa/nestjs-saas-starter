import express from 'express';
import request from 'supertest';
import { helmetMiddleware } from './helmet.config';

describe('helmetMiddleware', () => {
  const app = express();
  app.use(helmetMiddleware());
  app.use((_req, res) => {
    res.json({ ok: true });
  });

  const csp = async (path: string) =>
    (await request(app).get(path)).headers['content-security-policy'];

  it('locks API responses down to default-src none, no framing', async () => {
    const policy = await csp('/organizations/me');

    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain("script-src 'self'");
  });

  it('keeps the OpenAPI JSON on the strict policy', async () => {
    expect(await csp('/api/docs-json')).toContain("default-src 'none'");
  });

  it('allows Swagger UI to load its own assets', async () => {
    for (const path of ['/api/docs', '/api/docs/', '/api/docs/main.css']) {
      const policy = await csp(path);
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("style-src 'self'");
    }
  });

  it('still sets the other Helmet headers', async () => {
    const res = await request(app).get('/anything');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
