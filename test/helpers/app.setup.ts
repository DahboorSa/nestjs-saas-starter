import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { EmailQueueService } from '../../src/jobs/queues/email.queue';
import { EmailProcessor } from '../../src/jobs/processors/email.processor';
import { PlanEntity } from '../../src/modules/plans/entities/plan.entity';
import helmet from 'helmet';

// No-op replacement — prevents real Mailtrap/SES calls during e2e tests.
// Tokens are stored in Redis synchronously before any email job is queued,
// so tests can still read them; the email itself is simply never sent.
const noopEmailQueue = { add: async () => {} };

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailQueueService)
    .useValue(noopEmailQueue)
    .overrideProvider(EmailProcessor)
    .useValue({ process: async () => {} })
    .compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  await seedPlans(app);
  return app;
}

async function seedPlans(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(PlanEntity);
  const count = await repo.count();
  if (count > 0) return;

  await repo.insert([
    {
      name: 'Free',
      price: 0,
      stripePriceId: null,
      isDefault: true,
      limits: {
        apiCallsPerMonth: 100,
        maxMembers: 5,
        maxProjects: 10,
        maxApiKeys: 2,
        maxWebhooks: 0,
      },
      features: {
        webhooks: false,
        analytics: false,
        export: false,
        customDomain: false,
      },
      isActive: true,
    },
    {
      name: 'Pro',
      price: 19,
      stripePriceId: null,
      trialDays: 14,
      limits: {
        apiCallsPerMonth: 50000,
        maxMembers: 25,
        maxProjects: 100,
        maxApiKeys: 10,
        maxWebhooks: 100,
      },
      features: {
        webhooks: true,
        analytics: true,
        export: false,
        customDomain: false,
      },
      isActive: true,
    },
    {
      name: 'Enterprise',
      price: 99,
      stripePriceId: null,
      trialDays: 30,
      limits: {
        apiCallsPerMonth: -1,
        maxMembers: -1,
        maxProjects: -1,
        maxApiKeys: -1,
        maxWebhooks: -1,
      },
      features: {
        webhooks: true,
        analytics: true,
        export: true,
        customDomain: true,
      },
      isActive: true,
    },
  ]);
}
