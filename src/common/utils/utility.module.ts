import { Module } from '@nestjs/common';
import { UtilityService } from './utility.service';

@Module({
  imports: [],
  providers: [UtilityService],
  exports: [UtilityService],
})
export class UtilityModule {}
