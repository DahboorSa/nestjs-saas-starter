import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { OrganizationEntity } from '../organizations/entities/organization.entity';
import { UsageModule } from '../usage/usage.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { GroqProvider } from './providers/groq.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity]),
    UsageModule,
    AuditLogModule,
  ],
  controllers: [OnboardingController],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('AI_PROVIDER', 'groq');
        return provider === 'claude'
          ? new ClaudeProvider(config)
          : new GroqProvider(config);
      },
      inject: [ConfigService],
    },
    OnboardingService,
  ],
})
export class OnboardingModule {}
