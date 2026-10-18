import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma/client.js';

// Internal persistence boundary only. No controller accepts a client-supplied actor ID.
// Future routes must pass the user ID resolved by the authenticated session guard.
export class OrganizationRepository {
  constructor(private readonly db: PrismaClient) {}

  async createForVerifiedUser(actorUserId: string, name: string) {
    const normalizedName = name.trim();
    if (!normalizedName || normalizedName.length > 100) {
      throw new BadRequestException('Organization name must contain 1 to 100 characters.');
    }
    return this.db.$transaction(async (tx) => {
      // Serialize onboarding with user suspension/verification changes.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actorUserId}::uuid FOR UPDATE`;
      const user = await tx.user.findFirst({
        where: { id: actorUserId, status: 'ACTIVE', emailVerifiedAt: { not: null } },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Account unavailable.');
      const organizationId = randomUUID();
      const membershipId = randomUUID();
      const organization = await tx.organization.create({
        data: { id: organizationId, name: normalizedName, ownerMembershipId: membershipId },
        select: { id: true, name: true, status: true },
      });
      await tx.membership.create({
        data: { id: membershipId, organizationId, userId: actorUserId },
      });
      await tx.organizationRoleGrant.create({
        data: { organizationId, membershipId, role: 'EMPLOYEE' },
      });
      return organization;
    });
  }

  async findOwnMembership(actorUserId: string, organizationId: string) {
    const membership = await this.db.membership.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        status: 'ACTIVE',
        user: { status: 'ACTIVE', emailVerifiedAt: { not: null } },
        organization: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { id: true, name: true, ownerMembershipId: true } },
        roles: { select: { role: true } },
      },
    });
    if (!membership) throw new NotFoundException('Workspace not found.');
    return {
      membershipId: membership.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      isOwner: membership.organization.ownerMembershipId === membership.id,
      roles: membership.roles.map(({ role }) => role),
    };
  }
}
