import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  // 1. Inject Reflector in constructor
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const contextInfo = context.switchToHttp().getRequest();
    if (!requiredRoles || contextInfo.user?.isApiKey) return true;

    return requiredRoles.includes(contextInfo.user?.role);
  }
}
