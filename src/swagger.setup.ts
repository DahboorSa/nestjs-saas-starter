import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_PATH } from './config/helmet.config';

// Enabled everywhere except production. Returns whether docs were mounted.
export function setupSwagger(app: INestApplication): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const config = new DocumentBuilder()
    .setTitle('NestJS SaaS Starter API')
    .setDescription(
      'Multi-tenant SaaS backend: auth, organizations, API keys, webhooks, usage tracking, billing, and more.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    // API keys travel in the same `Authorization: Bearer` header as JWTs.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'API key' },
      'apiKey',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH.slice(1), app, document);
  return true;
}
