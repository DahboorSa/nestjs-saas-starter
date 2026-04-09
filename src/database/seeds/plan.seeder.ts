import { Seeder } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { PlanEntity } from '../../modules/plans/entities/plan.entity';
import { Logger } from '@nestjs/common';

export default class PlanSeeder implements Seeder {
  private logger = new Logger(PlanSeeder.name);
  public async run(dataSource: DataSource): Promise<void> {
    // Get repository
    const repository = dataSource.getRepository(PlanEntity);
    //check if plan already seeded skip
    const count = await repository.count();
    if (count > 0) {
      this.logger.log('Plan already seeded');
      return;
    }
    await repository.insert([
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
        stripePriceId: 'price_1TJlVIEGIGbArv80W4R4S2cG', // replace with your actual Stripe price ID
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
        stripePriceId: 'price_1TJlVaEGIGbArv80FHhrlvuJ',
        trialDays: 30,
        limits: {
          //-1 => no limit
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
    this.logger.log('Plan seeded successfully');
  }
}
