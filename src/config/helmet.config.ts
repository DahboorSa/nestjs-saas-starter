import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

export const SWAGGER_PATH = '/api/docs';

// API responses are JSON and never rendered or framed, so nothing may load.
const apiHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
});

// Swagger UI (non-production only) loads its own scripts, styles and images,
// which Helmet's default policy already allows from 'self'.
const docsHelmet = helmet();

const isSwaggerUi = (path: string) =>
  path === SWAGGER_PATH || path.startsWith(`${SWAGGER_PATH}/`);

export function helmetMiddleware() {
  return (req: Request, res: Response, next: NextFunction) =>
    (isSwaggerUi(req.path) ? docsHelmet : apiHelmet)(req, res, next);
}
