import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AskDto } from './dto/ask.dto';
import { CurrentUser } from '../../common/decorators';
import { SkipUsageTracking } from '../../common/decorators/skip-usage-tracking.decorator';
import { UserInfoDto } from '../../common/dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @SkipUsageTracking()
  @HttpCode(HttpStatus.OK)
  @Post('ask')
  ask(@Body() dto: AskDto, @CurrentUser() user: UserInfoDto) {
    return this.onboardingService.ask(dto.question, user.orgId);
  }
}
