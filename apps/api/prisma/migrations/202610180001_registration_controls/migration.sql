CREATE TABLE "AuthRateBucket" (
    "keyDigest" VARCHAR(64) NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AuthRateBucket_pkey" PRIMARY KEY ("keyDigest"),
    CONSTRAINT "AuthRateBucket_hits_check" CHECK ("hits" > 0),
    CONSTRAINT "AuthRateBucket_digest_check" CHECK ("keyDigest" ~ '^[a-f0-9]{64}$')
);
CREATE INDEX "AuthRateBucket_expiresAt_idx" ON "AuthRateBucket"("expiresAt");

CREATE TABLE "AuthSecurityEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuthSecurityEvent_action_check" CHECK ("action" IN ('REGISTRATION_CREATED')),
    CONSTRAINT "AuthSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
);
CREATE INDEX "AuthSecurityEvent_userId_createdAt_idx" ON "AuthSecurityEvent"("userId", "createdAt");
