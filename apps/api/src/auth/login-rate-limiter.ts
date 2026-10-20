import { createHmac } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';

export class AuthThrottled extends Error {
  constructor(readonly retryAfter: number) {
    super('Too many authentication requests.');
  }
}

export class LoginRateLimiter {
  constructor(
    private readonly db: PrismaClient,
    private readonly secret: string,
  ) {}
  digest(scope: 'ip' | 'email', value: string) {
    return createHmac('sha256', this.secret).update(`login:${scope}:${value}`).digest('hex');
  }
  async reserve(scope: 'ip' | 'email', value: string) {
    const key = this.digest(scope, value),
      limit = scope === 'ip' ? 30 : 5;
    const [row] = await this.db.$queryRaw<{ hits: number; expiresAt: Date; retry: number }[]>`
      INSERT INTO "AuthRateBucket" ("keyDigest", "hits", "expiresAt")
      VALUES (${key}, 1, CURRENT_TIMESTAMP + interval '15 minutes')
      ON CONFLICT ("keyDigest") DO UPDATE SET
        "hits" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST("AuthRateBucket"."hits" + 1, ${limit + 1}) END,
        "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + interval '15 minutes' ELSE "AuthRateBucket"."expiresAt" END
      RETURNING "hits", "expiresAt", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::int AS retry
    `;
    if (row!.hits > limit) throw new AuthThrottled(row!.retry);
    return { key, expiresAt: row!.expiresAt };
  }
  async releaseSuccess(reservation: { key: string; expiresAt: Date }) {
    // Refund only this success, preserving concurrent failures and later windows.
    await this.db.$executeRaw`
      UPDATE "AuthRateBucket" SET "hits" = GREATEST(0, "hits" - 1)
      WHERE "keyDigest" = ${reservation.key} AND "expiresAt" = ${reservation.expiresAt}
    `;
  }
}
