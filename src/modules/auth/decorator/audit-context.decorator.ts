import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuditContext = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return {
      organizationId: req.user?.orgId ?? null,
      userId: req.user?.userId ?? null,
      apiKeyId: req.user?.apiKeyId ?? null,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'] ?? null,
    };
  },
);
