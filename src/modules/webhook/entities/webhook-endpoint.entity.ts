import { WebhookEvent } from '../../../enums';
import { OrganizationEntity } from '../../organizations/entities/organization.entity';
import { WebhookDeliveryEntity } from '../../webhook-deliveries/entities/webhook-delivery.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_endpoints')
export class WebhookEndpointEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  url: string;
  @Column()
  secret: string; //→ used to sign the payload (HMAC) so they can verify it came from you
  @Column({ type: 'jsonb' })
  events: WebhookEvent[];
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(
    () => WebhookDeliveryEntity,
    (webhookDeliveryEntity) => webhookDeliveryEntity.webhookEndpoint,
  )
  webhookDeliveries: WebhookDeliveryEntity[];

  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.webhookEndpoints,
  )
  @Index()
  @JoinColumn({ name: 'organization_id' })
  organization: OrganizationEntity;
}
