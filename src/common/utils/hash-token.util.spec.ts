import { hashToken } from './hash-token.util';

describe('hashToken', () => {
  it('is deterministic', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('returns a 64-char hex SHA-256 digest', () => {
    expect(hashToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('never contains the raw token', () => {
    const token = 'a'.repeat(64);
    expect(hashToken(token)).not.toContain(token);
  });

  it('gives different hashes for different tokens', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });
});
