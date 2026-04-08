import { PaymentStatus } from '../../../enums/PaymentStatus';
import { ApiKeyEntity } from '../../../modules/api-keys/entities/api-key.entity';
import { AuditLogEntity } from '../../../modules/audit-logs/entities/audit-log.entity';
import { InvitationEntity } from '../../../modules/invitations/entities/invitation.entity';
import { PlanEntity } from '../../../modules/plans/entities/plan.entity';
import { UsageRecordEntity } from '../../../modules/usage-records/entities/usage-record.entity';
import { UserEntity } from '../../../modules/users/entities/user.entity';
import { WebhookEndpointEntity } from '../../webhook/entities/webhook-endpoint.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  name: string;
  @Column({ unique: true })
  slug: string;
  @Column({ nullable: true })
  stripeCustomerId: string;
  @Column({ nullable: true })
  stripeSubscriptionId: string;
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.FREE,
  })
  paymentStatus: PaymentStatus;
  @Column({ default: true })
  isActive: boolean; // owner can deactivate / admin can suspend
  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date;
  @CreateDateColumn()
  createdAt: Date;
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserEntity, (user) => user.organization)
  users: UserEntity[];

  @OneToMany(() => ApiKeyEntity, (apiKey) => apiKey.organization)
  apiKeys: ApiKeyEntity[];

  @OneToMany(
    () => InvitationEntity,
    (invitationEntity) => invitationEntity.organization,
  )
  invitations: InvitationEntity[];

  @OneToMany(
    () => UsageRecordEntity,
    (usageRecordEntity) => usageRecordEntity.organization,
  )
  usageRecords: UsageRecordEntity[];

  @OneToMany(
    () => WebhookEndpointEntity,
    (webhookEndpointEntity) => webhookEndpointEntity.organization,
  )
  webhookEndpoints: WebhookEndpointEntity[];

  @OneToMany(
    () => AuditLogEntity,
    (auditLogEntity) => auditLogEntity.organization,
  )
  auditLogs: AuditLogEntity[];

  @ManyToOne(() => PlanEntity, (plan) => plan.organizations)
  @JoinColumn({ name: 'planId' })
  plan: PlanEntity;
}
