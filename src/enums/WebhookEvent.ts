export enum WebhookEvent {
  MEMBER_INVITED = 'member.invited',
  MEMBER_INVITE_ACCEPTED = 'member.invite_accepted',
  MEMBER_ROLE_UPDATED = 'member.role_updated',
  MEMBER_UPDATED = 'member.updated',
  MEMBER_REMOVED = 'member.removed',
  MEMBER_EMAIL_UPDATED = 'member.email_updated',
  ORG_UPDATED = 'org.updated',
  API_KEY_CREATED = 'apikey.created',
  API_KEY_REVOKED = 'apikey.revoked',
  PLAN_LIMIT_EXCEEDED = 'plan.limit_exceeded',
}
