import { UsageMetric } from '../../../enums';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('usage_records')
@Unique(['organizationId', 'metric', 'period'])
export class UsageRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({
    type: 'enum',
    enum: UsageMetric,
  })
  metric: UsageMetric;
  @Column('int')
  value: number;
  @Column()
  period: string;
  @CreateDateColumn()
  createdAt: Date;

  @Column()
  organizationId: string;

  @Index()
  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.usageRecords,
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;
}
