import type { PrismaClient } from '../generated/prisma/client.js';

// Explicit bounded maintenance; never runs during application startup.
export async function cleanupAuthHistory(db: PrismaClient, now = new Date()) {
  const sessionCutoff = new Date(now.getTime() - 7 * 86400000);
  const auditCutoff = new Date(now.getTime() - 30 * 86400000);
  const sessions = await db.$executeRaw`
    DELETE FROM "AuthSession" WHERE "id" IN (
      SELECT "id" FROM "AuthSession" WHERE "revokedAt" < ${sessionCutoff}
        OR "idleExpiresAt" < ${sessionCutoff} OR "absoluteExpiresAt" < ${sessionCutoff}
      LIMIT 500 FOR UPDATE SKIP LOCKED
    )
  `;
  const events = await db.$executeRaw`
    DELETE FROM "AuthSecurityEvent" WHERE "id" IN (
      SELECT "id" FROM "AuthSecurityEvent" WHERE "createdAt" < ${auditCutoff}
      LIMIT 500 FOR UPDATE SKIP LOCKED
    )
  `;
  const rateBuckets = await db.$executeRaw`
    DELETE FROM "AuthRateBucket" WHERE "keyDigest" IN (
      SELECT "keyDigest" FROM "AuthRateBucket" WHERE "expiresAt" < ${now}
      LIMIT 500 FOR UPDATE SKIP LOCKED
    )
  `;
  return { sessions, events, rateBuckets };
}
