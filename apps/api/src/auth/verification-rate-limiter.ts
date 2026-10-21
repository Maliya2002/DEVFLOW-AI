import { createHmac } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AuthThrottled } from './login-rate-limiter.js';

type Scope = 'request-ip' | 'request-email' | 'confirm-ip';
export class VerificationRateLimiter {
  constructor(
    private readonly db: PrismaClient,
    private readonly secret: string,
  ) {}
  digest(scope: Scope, value: string) {
    return createHmac('sha256', this.secret).update(`verification:${scope}:${value}`).digest('hex');
  }
  async consume(scope: Scope, value: string) {
    const key = this.digest(scope, value);
    const limit = scope === 'request-email' ? 3 : scope === 'request-ip' ? 20 : 10;
    const seconds = scope === 'confirm-ip' ? 900 : 3600;
    const [row] = await this.db.$queryRaw<{ hits: number; retry: number }[]>`
      INSERT INTO "AuthRateBucket" ("keyDigest", "hits", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + ${seconds} * interval '1 second')
      ON CONFLICT ("keyDigest") DO UPDATE SET
        "hits" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST("AuthRateBucket"."hits" + 1, ${limit + 1}) END,
        "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + ${seconds} * interval '1 second'
          ELSE "AuthRateBucket"."expiresAt" END
      RETURNING "hits", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::int AS retry
    `;
    if (row!.hits > limit) throw new AuthThrottled(row!.retry);
  }
}
