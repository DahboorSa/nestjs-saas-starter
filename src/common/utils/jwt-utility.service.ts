import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserInfoDto } from '../../common/dto';

@Injectable()
export class JwtUtilityService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateToken(payload: UserInfoDto) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.jwtSecret'),
      expiresIn: this.configService.get('jwt.jwtExpiresIn'),
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.jwtRefreshSecret'),
      expiresIn: this.configService.get('jwt.jwtRefreshExpiresIn'),
    });
    return { accessToken, refreshToken };
  }

  verifyRefreshToken(token: string) {
    return this.jwtService.verify(token, {
      secret: this.configService.get('jwt.jwtRefreshSecret'),
    });
  }
}
