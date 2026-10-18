import { createHmac } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';

export class RegistrationRateLimiter {
  constructor(
    private readonly db: PrismaClient,
    private readonly secret: string,
  ) {}

  digest(scope: 'ip' | 'email', value: string) {
    return createHmac('sha256', this.secret).update(`register:${scope}:${value}`).digest('hex');
  }

  async consume(scope: 'ip' | 'email', value: string): Promise<number> {
    const key = this.digest(scope, value);
    const limit = scope === 'ip' ? 20 : 3;
    // One atomic upsert is shared by all application instances. Saturate at limit+1.
    const rows = await this.db.$queryRaw<{ hits: number; retry: number }[]>`
      INSERT INTO "AuthRateBucket" ("keyDigest", "hits", "expiresAt")
      VALUES (${key}, 1, date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 hour')
      ON CONFLICT ("keyDigest") DO UPDATE SET
        "hits" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP THEN 1
          ELSE LEAST("AuthRateBucket"."hits" + 1, ${limit + 1}) END,
        "expiresAt" = CASE WHEN "AuthRateBucket"."expiresAt" <= CURRENT_TIMESTAMP
          THEN date_trunc('hour', CURRENT_TIMESTAMP) + interval '1 hour'
          ELSE "AuthRateBucket"."expiresAt" END
      RETURNING "hits", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - CURRENT_TIMESTAMP))))::int AS retry
    `;
    // Bounded opportunistic cleanup; concurrent workers skip locked rows.
    await this.db.$executeRaw`
      DELETE FROM "AuthRateBucket" WHERE "keyDigest" IN (
        SELECT "keyDigest" FROM "AuthRateBucket" WHERE "expiresAt" < CURRENT_TIMESTAMP
        ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED
      )
    `;
    return rows[0]!.hits > limit ? rows[0]!.retry : 0;
  }
}
