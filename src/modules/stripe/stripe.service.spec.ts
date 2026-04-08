import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config = {
      STRIPE_SECRET_KEY: 'sk_test_mock',
      STRIPE_WEBHOOK_SECRET: 'whsec_mock',
    };
    return config[key];
  }),
};

jest.mock('stripe', () => {
  const mockStripe = jest.fn().mockReturnValue({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    paymentMethods: {
      create: jest.fn(),
      attach: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  });
  return mockStripe;
});

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
