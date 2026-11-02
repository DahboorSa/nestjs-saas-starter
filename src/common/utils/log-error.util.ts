import { Logger } from '@nestjs/common';

// Nest's logger prints a raw error with all of its own properties. An
// AxiosError carries `config` (URL, auth headers, request body); Stripe, SES
// and DB errors carry request params. Log name + message, plus the stack.
export function logError(
  logger: Logger,
  message: string,
  error: unknown,
): void {
  if (!(error instanceof Error)) {
    logger.error(`${message}: unknown error`);
    return;
  }
  logger.error(`${message}: ${error.name}: ${error.message}`, error.stack);
}
