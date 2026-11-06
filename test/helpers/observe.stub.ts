import { Module } from '@nestjs/common';

// ESM-only package that Jest cannot load; jest-e2e.json maps it here.
@Module({})
class NoopObserveModule {}

export const createObserveModule = () => ({
  ObserveModule: {
    forRoot: () => ({ module: NoopObserveModule }),
  },
  ObserveInstrument: undefined,
});
