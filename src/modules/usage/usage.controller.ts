import { Controller, Get } from '@nestjs/common';
import { UsageService } from './usage.service';
import { CurrentUser } from '../../common/decorators';
import { UserInfoDto } from '../../common/dto';
import { SkipUsageTracking } from '../../common/decorators/skip-usage-tracking.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Usage')
@ApiBearerAuth('access-token')
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @SkipUsageTracking()
  @Get()
  getStats(@CurrentUser() user: UserInfoDto) {
    return this.usageService.getStats(user.orgId);
  }
}
