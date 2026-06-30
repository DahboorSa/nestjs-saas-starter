import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { EmailQueueService } from '../../src/jobs/queues/email.queue';
import { EmailProcessor } from '../../src/jobs/processors/email.processor';
import { StripeService } from '../../src/modules/stripe/stripe.service';
import { AI_PROVIDER } from '../../src/modules/onboarding/providers/ai-provider.interface';
import { PlanEntity } from '../../src/modules/plans/entities/plan.entity';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// No-op replacement — prevents real Mailtrap/SES calls during e2e tests.
// Tokens are stored in Redis synchronously before any email job is queued,
// so tests can still read them; the email itself is simply never sent.
const noopEmailQueue = { add: async () => {} };

// Stub AI provider — prevents real Groq/Anthropic API calls during e2e tests.
const mockAiProvider = {
  ask: async () => 'This is a mock answer from the onboarding assistant.',
};

// Stub Stripe — prevents real Stripe API calls during e2e tests.
// Payment flow tests that need real Stripe are guarded by RUN_STRIPE_E2E=true.
const mockStripeService = {
  createCustomer: async () => ({ id: 'cus_test' }),
  attachPaymentMethod: async () => ({}),
  createSubscription: async () => ({ id: 'sub_test', status: 'active' }),
  retrieveSubscription: async () => ({
    id: 'sub_test',
    status: 'active',
    current_period_end: Math.floor(Date.now() / 1000) + 86400,
    cancel_at_period_end: false,
  }),
  cancelSubscription: async () => ({}),
  retrieveCustomer: async () => ({ id: 'cus_test' }),
  constructWebhookEvent: () => null,
};

export async function closeTestApp(app: INestApplication): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  await app.close();
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(EmailQueueService)
    .useValue(noopEmailQueue)
    .overrideProvider(EmailProcessor)
    .useValue({ process: async () => {} })
    .overrideProvider(StripeService)
    .useValue(mockStripeService)
    .overrideProvider(AI_PROVIDER)
    .useValue(mockAiProvider)
    .compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });

  app.use(helmet());
  app.use(cookieParser());
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
