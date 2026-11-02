import { Test, TestingModule } from '@nestjs/testing';
import { IsNull } from 'typeorm';
import { TrialExpiryScheduler } from './trial-expiry.scheduler';
import { OrganizationService } from '../../modules/organizations/organization.service';
import { PaymentStatus } from '../../enums';

const mockOrganizationService = { updateMany: jest.fn() };

describe('TrialExpiryScheduler', () => {
  let scheduler: TrialExpiryScheduler;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockOrganizationService.updateMany.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrialExpiryScheduler,
        { provide: OrganizationService, useValue: mockOrganizationService },
      ],
    }).compile();
    scheduler = module.get(TrialExpiryScheduler);
  });

  it('cancels orgs past the grace period, then suspends expired trials, in two bulk updates', async () => {
    await scheduler.handleCron();

    expect(mockOrganizationService.updateMany).toHaveBeenCalledTimes(2);
    const [[cancelWhere, cancelFields], [suspendWhere, suspendFields]] =
      mockOrganizationService.updateMany.mock.calls;

    expect(cancelWhere).toMatchObject({
      isActive: true,
      paymentStatus: PaymentStatus.SUSPENDED,
      stripeSubscriptionId: IsNull(),
    });
    expect(cancelFields).toEqual({
      paymentStatus: PaymentStatus.CANCELLED,
      isActive: false,
    });

    expect(suspendWhere).toMatchObject({
      isActive: true,
      paymentStatus: PaymentStatus.TRIAL,
      stripeSubscriptionId: IsNull(),
    });
    expect(suspendFields).toEqual({ paymentStatus: PaymentStatus.SUSPENDED });
  });

  it('cancels before suspending so freshly suspended orgs keep their grace period', async () => {
    await scheduler.handleCron();

    const [first, second] = mockOrganizationService.updateMany.mock.calls;
    expect(first[1].paymentStatus).toBe(PaymentStatus.CANCELLED);
    expect(second[1].paymentStatus).toBe(PaymentStatus.SUSPENDED);
  });

  it('still runs the suspend phase when the cancel phase throws', async () => {
    mockOrganizationService.updateMany
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce(3);

    await expect(scheduler.handleCron()).resolves.toBeUndefined();

    expect(mockOrganizationService.updateMany).toHaveBeenCalledTimes(2);
  });
});
