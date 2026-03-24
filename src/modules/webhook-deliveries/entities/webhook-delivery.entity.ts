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
  @Column({ nullable: true })
  statusCode: number | null;
  @Column()
  attempt: number;
  @Column({
    type: 'enum',
    enum: DeliveryStatus,
  })
  status: DeliveryStatus;
  @CreateDateColumn()
  deliveredAt: Date;

  @ManyToOne(
    () => WebhookEndpointEntity,
    (webhookEndpointEntity) => webhookEndpointEntity.webhookDeliveries,
  )
  @JoinColumn({ name: 'webhookEndpointId' })
  @Index()
  webhookEndpoint: WebhookEndpointEntity;
}
