import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JWT_ONLY } from '../../../common/decorators';

@Injectable()
export class JwtOnlyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext) {
    const requiredJwt = this.reflector.getAllAndOverride(JWT_ONLY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredJwt) return true;
    const contextInfo = context.switchToHttp().getRequest();
    const token = contextInfo?.headers?.authorization?.split(' ')[1];

    return (
      requiredJwt &&
      token &&
      !token.startsWith(this.configService.get<string>('API_KEY_PREFIX'))
    );
  }
}
