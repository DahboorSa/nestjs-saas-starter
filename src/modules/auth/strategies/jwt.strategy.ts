import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UserService } from '../../../modules/users/user.service';
import { UserInfoDto } from '../../../common/dto';
import { CacheService } from '../../../cache/cache.service';
import { hashToken } from '../../../common/utils/hash-token.util';

// Claims signed into the access token by JwtUtilityService.generateToken()
interface JwtPayload extends Omit<UserInfoDto, 'expiresIn' | 'token'> {
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {
    super({
      secretOrKey: config.getOrThrow<string>('jwt.jwtSecret'),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<UserInfoDto> {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    // Passport has already extracted and verified it; this narrows the type
    if (!token) throw new UnauthorizedException('Missing token');

    const isBlacklisted = await this.cacheService.get(
      `auth:blacklist:${hashToken(token)}`,
    );
    if (isBlacklisted)
      throw new UnauthorizedException('Token has been revoked');

    const userInfo = await this.userService.getById(
      payload.userId,
      payload.orgId,
    );
    if (!userInfo) throw new UnauthorizedException('User not found');
    if (!userInfo.isVerified)
      throw new UnauthorizedException('User not verified');
    if (!userInfo.isActive)
      throw new UnauthorizedException('User account has been deactivated');
    return {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
      expiresIn: payload.exp,
      token,
    };
  }
}
