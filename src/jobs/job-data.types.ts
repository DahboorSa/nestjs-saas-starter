import { WebhookEvent } from '../enums';

// Payloads carried by the BullMQ queues, shared by producers and processors.

export interface EmailJobData {
  email: string;
  userId?: string;
  token?: string;
  // invite.email only
  orgName?: string;
  inviterName?: string;
  inviterEmail?: string;
}

export interface SubscriptionJobData {
  orgId: string;
  email: string;
  userId?: string;
}

export interface WebhookJobData {
  orgId: string;
  webhookEndpointId: string;
  url: string;
  secret: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  // Set after the first attempt so retries reuse the same delivery row
  deliveryId?: string;
}
