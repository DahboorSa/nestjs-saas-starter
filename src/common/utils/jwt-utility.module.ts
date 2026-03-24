import { Module } from '@nestjs/common';
import { JwtUtilityService } from './jwt-utility.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtUtilityService],
  exports: [JwtUtilityService],
})
export class JwtUtilityModule {}
