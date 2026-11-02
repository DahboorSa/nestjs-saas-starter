import { JwtUtilityService } from './jwt-utility.service';
import { hashToken } from './hash-token.util';

describe('JwtUtilityService', () => {
  const jwtService = { sign: jest.fn(), verify: jest.fn() };
  const configService = { get: jest.fn() };
  const cacheService = { set: jest.fn() };
  let service: JwtUtilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService.sign
      .mockReturnValueOnce('access-jwt')
      .mockReturnValueOnce('refresh-jwt');
    configService.get.mockReturnValue(900);
    service = new JwtUtilityService(
      jwtService as any,
      configService as any,
      cacheService as any,
    );
  });

  it('returns the raw token pair but caches only the refresh token hash', async () => {
    const result = await service.issueTokenPair({
      userId: 'user-1',
      orgId: 'org-1',
    } as any);

    expect(result).toEqual({
      accessToken: 'access-jwt',
      refreshToken: 'refresh-jwt',
    });
    expect(cacheService.set).toHaveBeenCalledWith(
      'auth:refresh:user-1',
      hashToken('refresh-jwt'),
      900,
    );
  });
});
