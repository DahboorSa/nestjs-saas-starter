import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosError } from 'axios';
import { WebhookProcessor } from './webhook.processor';
import { WebhookDeliveryService } from '../../modules/webhook-deliveries/webhook-delivery.service';
import { DeliveryStatus } from '../../enums';

const mockHttpService = { post: jest.fn() };
const mockDeliveryService = {
  createPending: jest.fn(),
  recordAttempt: jest.fn(),
};

const makeJob = (overrides: Record<string, any> = {}) =>
  ({
    id: 'job-1',
    name: 'deliver-webhook',
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      orgId: 'org-1',
      webhookEndpointId: 'endpoint-1',
      event: 'member.invited',
      url: 'https://example.com/hook',
      secret: 'secret',
      payload: { foo: 'bar' },
    },
    updateData: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as any;

const axiosError = (status?: number) => {
  const err = new AxiosError('fail');
  if (status) err.response = { status } as any;
  return err;
};

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDeliveryService.createPending.mockResolvedValue('delivery-1');
    mockDeliveryService.recordAttempt.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessor,
        { provide: HttpService, useValue: mockHttpService },
        { provide: WebhookDeliveryService, useValue: mockDeliveryService },
      ],
    }).compile();
    processor = module.get(WebhookProcessor);
  });

  it('creates one PENDING row on the first attempt and stores its id on the job', async () => {
    mockHttpService.post.mockReturnValue(of({ status: 200 }));
    const job = makeJob();

    await processor.process(job);

    expect(mockDeliveryService.createPending).toHaveBeenCalledTimes(1);
    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: 'delivery-1' }),
    );
    expect(mockDeliveryService.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      'org-1',
      { status: DeliveryStatus.SUCCESS, statusCode: 200, attempt: 0 },
    );
  });

  it('never logs the endpoint secret, url or payload', async () => {
    mockHttpService.post.mockReturnValue(of({ status: 200 }));
    const logSpy = jest.spyOn((processor as any).logger, 'log');
    const job = makeJob();
    job.data.secret = 'super-secret-value';

    await processor.process(job);

    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).not.toContain('super-secret-value');
    expect(logged).not.toContain('https://example.com/hook');
    expect(logged).not.toContain('bar');
  });

  it('logs a failed delivery without the axios config (url, signature, body)', async () => {
    const err = axiosError(500);
    err.config = {
      url: 'https://example.com/hook',
      headers: { 'X-Webhook-Signature': 'sha256=leaky' },
      data: '{"foo":"bar"}',
    } as any;
    mockHttpService.post.mockReturnValue(throwError(() => err));
    const errorSpy = jest.spyOn((processor as any).logger, 'error');

    await expect(processor.process(makeJob())).rejects.toBeDefined();

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('endpoint-1');
    expect(logged).not.toContain('sha256=leaky');
    expect(logged).not.toContain('example.com');
  });

  it('reuses the existing row on retry instead of creating a new one', async () => {
    mockHttpService.post.mockReturnValue(of({ status: 200 }));
    const base = makeJob();
    const job = makeJob({
      attemptsMade: 1,
      data: { ...base.data, deliveryId: 'delivery-1' },
    });

    await processor.process(job);

    expect(mockDeliveryService.createPending).not.toHaveBeenCalled();
    expect(mockDeliveryService.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      'org-1',
      { status: DeliveryStatus.SUCCESS, statusCode: 200, attempt: 1 },
    );
  });

  it('keeps the row PENDING and rethrows when a retry remains', async () => {
    const err = axiosError(500);
    mockHttpService.post.mockReturnValue(throwError(() => err));

    await expect(processor.process(makeJob())).rejects.toBe(err);

    expect(mockDeliveryService.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      'org-1',
      { status: DeliveryStatus.PENDING, statusCode: 500, attempt: 0 },
    );
  });

  it('marks the row FAILED and rethrows on the last attempt', async () => {
    const err = axiosError(500);
    mockHttpService.post.mockReturnValue(throwError(() => err));

    await expect(processor.process(makeJob({ attemptsMade: 2 }))).rejects.toBe(
      err,
    );

    expect(mockDeliveryService.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      'org-1',
      { status: DeliveryStatus.FAILED, statusCode: 500, attempt: 2 },
    );
  });

  it('marks the row FAILED and does not retry on 404', async () => {
    mockHttpService.post.mockReturnValue(throwError(() => axiosError(404)));

    await expect(processor.process(makeJob())).resolves.toBeUndefined();

    expect(mockDeliveryService.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      'org-1',
      { status: DeliveryStatus.FAILED, statusCode: 404, attempt: 0 },
    );
  });
});
