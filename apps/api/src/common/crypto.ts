import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** URL-safe opaque token. Used for refresh tokens, invites and share links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored hashed so a database leak does not hand over live sessions.
 * SHA-256 rather than a password hash on purpose: these are high-entropy random
 * strings, not guessable secrets, so slow hashing buys nothing and would make
 * every request pay for it.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
