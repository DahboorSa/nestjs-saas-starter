import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  //mitigates risks like cross-site scripting (XSS), information leakage, and other common attacks
  app.use(helmet());
  app.enableCors({
    origin: process.env.ORIGIN?.split(',') ?? '*',
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
  Logger.log('Application process is starting...');
  await app.listen(3000);
}
bootstrap();
