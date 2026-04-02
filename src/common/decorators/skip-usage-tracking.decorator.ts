import { SetMetadata } from '@nestjs/common';

export const SKIP_USAGE_TRACKING_KEY = 'skipUsageTracking';
export const SkipUsageTracking = () =>
  SetMetadata(SKIP_USAGE_TRACKING_KEY, true);
