import { Logger } from '@nestjs/common';
import { logError } from './log-error.util';

describe('logError', () => {
  const logger = { error: jest.fn() } as unknown as Logger;

  beforeEach(() => jest.clearAllMocks());

  it('logs name, message and stack of an Error', () => {
    const error = new TypeError('boom');

    logError(logger, 'Something failed', error);

    expect(logger.error).toHaveBeenCalledWith(
      'Something failed: TypeError: boom',
      error.stack,
    );
  });

  it('does not pass extra error properties to the logger', () => {
    const error = Object.assign(new Error('fail'), {
      config: { headers: { Authorization: 'Bearer leaky' } },
    });

    logError(logger, 'Request failed', error);

    expect(
      JSON.stringify((logger.error as jest.Mock).mock.calls),
    ).not.toContain('leaky');
  });

  it('handles non-Error values', () => {
    logError(logger, 'Something failed', { secret: 'leaky' });

    expect(logger.error).toHaveBeenCalledWith(
      'Something failed: unknown error',
    );
  });
});
