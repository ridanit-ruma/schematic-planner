import { SetMetadata } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

export const IS_STRICT_RATE_LIMIT = 'throttle:strict';

/**
 * Marks a route that answers yes or no to a guess — sign-in, registration,
 * invitation and share-link lookups. Without a tighter allowance those can be
 * walked through at machine speed, and the ordinary limit is far too generous
 * to notice.
 */
export const StrictRateLimit = () => SetMetadata(IS_STRICT_RATE_LIMIT, true);

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req['headers'] as Record<string, string | undefined> | undefined;
    const authorization = headers?.['authorization'];

    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      // Counted per credential rather than per address. Several agents behind
      // one NAT must not share an allowance, and one noisy key must not spend
      // everybody else's.
      const digest = createHash('sha256').update(authorization.slice(7)).digest('hex');
      return `key:${digest.slice(0, 32)}`;
    }

    // Refreshing a session carries no Authorization header, only the cookie.
    // Counting those by address meant every signed-in person behind the same
    // proxy shared one allowance, and a burst from any of them signed the rest
    // out — the client is turned away, finds it cannot refresh, and gives up
    // the session it had.
    const cookies = req['cookies'] as Record<string, string | undefined> | undefined;
    const session = cookies?.['sp_refresh'];
    if (typeof session === 'string' && session !== '') {
      return `session:${createHash('sha256').update(session).digest('hex').slice(0, 32)}`;
    }

    // Express resolves this from X-Forwarded-For only when TRUST_PROXY is set,
    // so an untrusted deployment cannot be spoofed into limiting the wrong client.
    return `ip:${String(req['ip'] ?? 'unknown')}`;
  }
}
