import { AuditLogEntity } from '../../../modules/audit-logs/entities/audit-log.entity';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Index()
  @Column({ name: 'key_hash' })
  keyHash: string;
  @Column({ name: 'key_prefix' })
  keyPrefix: string;
  @Column({ type: 'jsonb' })
  scopes: string[];
  @Column({ type: 'timestamp', nullable: true, name: 'last_used_at' })
  lastUsedAt: Date;
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
  @Column({ nullable: true, name: 'expires_at' })
  expiresAt: Date;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Index()
  @ManyToOne(() => OrganizationEntity, (organization) => organization.apiKeys)
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;

  @OneToMany(() => AuditLogEntity, (auditLogEntity) => auditLogEntity.apiKey)
  auditLogs: AuditLogEntity[];
}
