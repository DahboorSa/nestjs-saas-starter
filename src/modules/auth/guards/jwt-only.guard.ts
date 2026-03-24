import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JWT_ONLY } from '../decorator';

@Injectable()
export class JwtOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredJwt = this.reflector.getAllAndOverride(JWT_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredJwt) return true;
    const contextInfo = context.switchToHttp().getRequest();
    const token = contextInfo?.headers?.authorization?.split(' ')[1];

    return (
      requiredJwt && token && !token.startsWith(process.env.API_KEY_PREFIX)
    );
  }
}
