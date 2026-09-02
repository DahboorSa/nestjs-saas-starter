import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
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

  describe('retrieveSubscription', () => {
    const stripeInstance = () => (Stripe as unknown as jest.Mock)();

    it('passes an empty params object when no expand is given', async () => {
      stripeInstance().subscriptions.retrieve.mockResolvedValue({
        id: 'sub_1',
      });

      await service.retrieveSubscription('sub_1');

      expect(stripeInstance().subscriptions.retrieve).toHaveBeenCalledWith(
        'sub_1',
        {},
      );
    });

    it('forwards the expand list to Stripe', async () => {
      stripeInstance().subscriptions.retrieve.mockResolvedValue({
        id: 'sub_1',
      });

      await service.retrieveSubscription('sub_1', ['default_payment_method']);

      expect(stripeInstance().subscriptions.retrieve).toHaveBeenCalledWith(
        'sub_1',
        { expand: ['default_payment_method'] },
      );
    });
  });
});
