import { DeliveryStatus } from '../../../enums';
import { WebhookEndpointEntity } from '../../webhook/entities/webhook-endpoint.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_deliveries')
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  event: string;
  @Column({ type: 'jsonb' })
  payload: any;
  @Column({ nullable: true, name: 'status_code' })
  statusCode: number | null;
  @Column()
  attempt: number;
  @Column({
    type: 'enum',
    enum: DeliveryStatus,
  })
  status: DeliveryStatus;
  @CreateDateColumn({ name: 'delivered_at' })
  deliveredAt: Date;

  @ManyToOne(
    () => WebhookEndpointEntity,
    (webhookEndpointEntity) => webhookEndpointEntity.webhookDeliveries,
  )
  @JoinColumn({ name: 'webhook_endpoint_id' })
  @Index()
  webhookEndpoint: WebhookEndpointEntity;
}
