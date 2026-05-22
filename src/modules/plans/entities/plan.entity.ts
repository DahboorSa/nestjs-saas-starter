import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('plans')
export class PlanEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Column('int')
  price: number;
  @Column({ nullable: true, name: 'stripe_price_id' })
  stripePriceId: string;
  @Column({ type: 'int', default: 0, name: 'trial_days' })
  trialDays: number;
  @Column({ type: 'jsonb' })
  limits: {
    apiCallsPerMonth: number;
    maxMembers: number;
    maxProjects: number;
    maxApiKeys: number;
    maxWebhooks: number;
  };
  @Column({ type: 'jsonb' })
  features: {
    webhooks: boolean;
    analytics: boolean;
    export: boolean;
    customDomain: boolean;
  };
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @Column({ nullable: true, default: false, name: 'is_default' })
  isDefault: boolean;

  @OneToMany(() => OrganizationEntity, (organization) => organization.plan)
  organizations: OrganizationEntity[];
}
