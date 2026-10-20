CREATE TABLE "AuthSession" (
 "id" UUID PRIMARY KEY,
 "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
 "tokenDigest" VARCHAR(64) NOT NULL,
 "authVersionAtIssue" INTEGER NOT NULL CHECK ("authVersionAtIssue" >= 0),
 "rememberMe" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMPTZ(3) NOT NULL,
 "lastSeenAt" TIMESTAMPTZ(3) NOT NULL,
 "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
 "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
 "reauthenticatedAt" TIMESTAMPTZ(3) NOT NULL,
 "revokedAt" TIMESTAMPTZ(3),
 CONSTRAINT "AuthSession_digest_check" CHECK ("tokenDigest" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "AuthSession_times_check" CHECK (
   "createdAt" <= "lastSeenAt" AND "lastSeenAt" < "idleExpiresAt" AND
   "idleExpiresAt" <= "absoluteExpiresAt" AND "createdAt" <= "reauthenticatedAt"
 )
);
CREATE UNIQUE INDEX "AuthSession_tokenDigest_key" ON "AuthSession"("tokenDigest");
CREATE INDEX "AuthSession_userId_createdAt_idx" ON "AuthSession"("userId", "createdAt");
CREATE INDEX "AuthSession_absoluteExpiresAt_idx" ON "AuthSession"("absoluteExpiresAt");
CREATE INDEX "AuthSession_idleExpiresAt_idx" ON "AuthSession"("idleExpiresAt");
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");
CREATE INDEX "AuthSecurityEvent_createdAt_idx" ON "AuthSecurityEvent"("createdAt");
ALTER TABLE "AuthSecurityEvent" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuthSecurityEvent" ADD COLUMN "targetId" UUID;
ALTER TABLE "AuthSecurityEvent" ADD COLUMN "correlationId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "AuthSecurityEvent" DROP CONSTRAINT "AuthSecurityEvent_action_check";
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_action_check" CHECK ("action" IN (
 'REGISTRATION_CREATED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'SESSION_ROTATED',
 'LOGOUT', 'LOGOUT_ALL', 'SESSION_REVOKED', 'SESSION_LIMIT_REVOKED', 'REAUTH_FAILED', 'SECURITY_DENIED'
));
ALTER TABLE "AuthRateBucket" DROP CONSTRAINT "AuthRateBucket_hits_check";
ALTER TABLE "AuthRateBucket" ADD CONSTRAINT "AuthRateBucket_hits_check" CHECK ("hits" >= 0);
