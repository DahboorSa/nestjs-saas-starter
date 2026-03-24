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
} from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;
  @Column({ type: 'enum', enum: AuditResourceType })
  resourceType: AuditResourceType;
  @Column()
  resourceId: string;
  @Column({ type: 'jsonb', default: {} })
  metadata: any;
  @Column({ nullable: true })
  ipAddress: string;
  @Column({ nullable: true })
  userAgent: string;
  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.auditLogs)
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @ManyToOne(() => UserEntity, (userEntity) => userEntity.auditLogs)
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @ManyToOne(() => ApiKeyEntity, (apiKeyEntity) => apiKeyEntity.auditLogs)
  @JoinColumn({ name: 'apiKeyId' })
  apiKey: ApiKeyEntity;
}
