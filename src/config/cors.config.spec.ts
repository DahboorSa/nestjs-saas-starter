import { resolveCorsOrigin } from './cors.config';

describe('resolveCorsOrigin', () => {
  it('splits and trims a comma-separated list', () => {
    expect(
      resolveCorsOrigin('https://a.com, https://b.com ', 'production'),
    ).toEqual(['https://a.com', 'https://b.com']);
  });

  it("falls back to '*' outside production when ORIGIN is unset", () => {
    expect(resolveCorsOrigin(undefined, 'development')).toBe('*');
    expect(resolveCorsOrigin('', undefined)).toBe('*');
  });

  it('throws in production when ORIGIN is unset or empty', () => {
    expect(() => resolveCorsOrigin(undefined, 'production')).toThrow(
      'ORIGIN must be set',
    );
    expect(() => resolveCorsOrigin(' , ', 'production')).toThrow(
      'ORIGIN must be set',
    );
  });
});
