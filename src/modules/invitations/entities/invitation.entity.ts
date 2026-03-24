import { InvitationStatus, UserRole } from '../../../enums';
import { OrganizationEntity } from '../../../modules/organizations/entities/organization.entity';
import { UserEntity } from '../../../modules/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('invitations')
export class InvitationEntity {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  email: string;
  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;
  @Column()
  token: string;
  @Column({
    type: 'enum',
    enum: InvitationStatus,
  })
  status: InvitationStatus;
  @Column({ type: 'timestamp' })
  expiresAt: Date;
  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.invitations,
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @ManyToOne(() => UserEntity, (userEntity) => userEntity.invitations)
  @JoinColumn({ name: 'invitedByUserId' })
  invitedBy: UserEntity;
}
