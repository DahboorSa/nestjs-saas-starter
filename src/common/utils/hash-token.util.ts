import { createHash } from 'crypto';

// Plain SHA-256 is enough: the inputs are 256-bit random values or signed
// JWTs, so there is nothing to brute-force and no need for a salt or slow hash.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
