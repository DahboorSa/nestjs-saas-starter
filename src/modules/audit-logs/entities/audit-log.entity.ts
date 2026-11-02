import { AuditAction, AuditResourceType } from '../../../enums';
import { ApiKeyEntity } from '../../../modules/api-keys/entities/api-key.entity';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import { UserEntity } from '../../../modules/users/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Serves GET /audit-logs: filter by org, newest first, optional date range.
@Index('IDX_audit_logs_organization_created_at', ['organization', 'createdAt'])
@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;
  @Column({ type: 'enum', enum: AuditResourceType, name: 'resource_type' })
  resourceType: AuditResourceType;
  @Column({ name: 'resource_id' })
  resourceId: string;
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;
  @Column({ nullable: true, name: 'ip_address' })
  ipAddress: string;
  @Column({ nullable: true, name: 'user_agent' })
  userAgent: string;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.auditLogs)
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @ManyToOne(() => UserEntity, (userEntity) => userEntity.auditLogs)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ApiKeyEntity, (apiKeyEntity) => apiKeyEntity.auditLogs)
  @JoinColumn({ name: 'api_key_id' })
  apiKey: ApiKeyEntity;
}
