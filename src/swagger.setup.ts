import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'apiKey')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  return true;
}
