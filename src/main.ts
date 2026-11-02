import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { setupSwagger } from './swagger.setup';
import { resolveCorsOrigin } from './config/cors.config';
import { helmetMiddleware } from './config/helmet.config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  //mitigates risks like cross-site scripting (XSS), information leakage, and other common attacks
  app.use(helmetMiddleware());
  app.use(cookieParser());
  app.enableCors({
    origin: resolveCorsOrigin(),
    methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 204,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  setupSwagger(app);
  Logger.log('Application process is starting...');
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
