CREATE TABLE "EmailVerificationToken" (
  "id" UUID PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
  "email" VARCHAR(254) NOT NULL,
  "purpose" VARCHAR(32) NOT NULL DEFAULT 'EMAIL_VERIFICATION',
  "tokenDigest" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "invalidatedAt" TIMESTAMPTZ(3),
  CONSTRAINT "EmailVerificationToken_purpose_check" CHECK ("purpose" = 'EMAIL_VERIFICATION'),
  CONSTRAINT "EmailVerificationToken_digest_check" CHECK ("tokenDigest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "EmailVerificationToken_times_check" CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '24 hours' AND
    ("consumedAt" IS NULL OR "consumedAt" >= "createdAt") AND
    ("invalidatedAt" IS NULL OR "invalidatedAt" >= "createdAt")
  )
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenDigest_key" ON "EmailVerificationToken"("tokenDigest");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "EmailVerificationToken_consumedAt_idx" ON "EmailVerificationToken"("consumedAt");
CREATE INDEX "EmailVerificationToken_invalidatedAt_idx" ON "EmailVerificationToken"("invalidatedAt");
CREATE UNIQUE INDEX "EmailVerificationToken_one_pending" ON "EmailVerificationToken"("userId")
  WHERE "consumedAt" IS NULL AND "invalidatedAt" IS NULL;
ALTER TABLE "AuthSecurityEvent" DROP CONSTRAINT "AuthSecurityEvent_action_check";
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_action_check" CHECK ("action" IN (
 'REGISTRATION_CREATED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'SESSION_ROTATED',
 'LOGOUT', 'LOGOUT_ALL', 'SESSION_REVOKED', 'SESSION_LIMIT_REVOKED', 'REAUTH_FAILED', 'SECURITY_DENIED',
 'VERIFICATION_REQUESTED', 'VERIFICATION_DELIVERY_FAILED', 'EMAIL_VERIFIED'
));
