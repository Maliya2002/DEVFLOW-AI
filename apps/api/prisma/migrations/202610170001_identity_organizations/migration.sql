-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('ADMIN', 'HR', 'PROJECT_MANAGER', 'EMPLOYEE', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "normalizedEmail" VARCHAR(254) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "passwordHash" TEXT,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationRoleGrant" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_normalizedEmail_key" ON "User"("normalizedEmail");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_id_key" ON "Membership"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRoleGrant_organizationId_membershipId_role_key" ON "OrganizationRoleGrant"("organizationId", "membershipId", "role");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_id_ownerMembershipId_fkey" FOREIGN KEY ("id", "ownerMembershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrganizationRoleGrant" ADD CONSTRAINT "OrganizationRoleGrant_organizationId_membershipId_fkey" FOREIGN KEY ("organizationId", "membershipId") REFERENCES "Membership"("organizationId", "id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- Domain checks not represented by Prisma schema. Preserve in future migrations.
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check"
  CHECK ("normalizedEmail" = lower(btrim("normalizedEmail")) AND length("normalizedEmail") > 3);
ALTER TABLE "User" ADD CONSTRAINT "User_authVersion_nonnegative" CHECK ("authVersion" >= 0);
ALTER TABLE "User" ADD CONSTRAINT "User_displayName_nonempty" CHECK (length(btrim("displayName")) > 0);
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_name_nonempty" CHECK (length(btrim("name")) > 0);

-- Membership status changes and owner changes serialize on the same organization row.
CREATE FUNCTION lock_membership_organization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "id" FROM "Organization" WHERE "id" = NEW."organizationId" FOR UPDATE;
  RETURN NEW;
END;
$$;
CREATE TRIGGER membership_status_lock BEFORE UPDATE OF "status" ON "Membership"
FOR EACH ROW EXECUTE FUNCTION lock_membership_organization();

CREATE FUNCTION enforce_active_organization_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'Organization' THEN org_id := NEW."id";
  ELSE org_id := NEW."organizationId";
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Organization" o
    LEFT JOIN "Membership" m ON m."organizationId" = o."id" AND m."id" = o."ownerMembershipId"
    WHERE o."id" = org_id AND (m."id" IS NULL OR m."status" <> 'ACTIVE')
  ) THEN
    RAISE EXCEPTION 'Organization must have an active owner membership' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER organization_active_owner
AFTER INSERT OR UPDATE ON "Organization" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_active_organization_owner();
CREATE CONSTRAINT TRIGGER membership_active_owner
AFTER INSERT OR UPDATE ON "Membership" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_active_organization_owner();
