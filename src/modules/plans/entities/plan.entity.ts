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
  @Column({ default: true })
  isActive: boolean;
  @CreateDateColumn()
  createdAt: Date;
  @Column({ nullable: true, default: false })
  isDefault: boolean;

  @OneToMany(() => OrganizationEntity, (organization) => organization.plan)
  organizations: OrganizationEntity[];
}
