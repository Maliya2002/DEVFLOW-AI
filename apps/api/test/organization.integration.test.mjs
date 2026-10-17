import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '../dist/database/client.js';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { OrganizationRepository } from '../dist/organizations/organization.repository.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('Organization persistence and tenant isolation', () => {
  let db, repo, alice, bob, pending, disabled, orgA, orgB, memberA, memberB;
  const userIds = [];
  const orgIds = [];
  beforeAll(async () => {
    const url = parseDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    // This suite writes synthetic fixtures; never point it at the Neon development database.
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Use a dedicated database ending in _test.');
    db = createDatabaseClient(url);
    repo = new OrganizationRepository(db);
    async function user(extra = {}) {
      const id = randomUUID();
      userIds.push(id);
      return db.user.create({
        data: {
          id,
          normalizedEmail: `${id}@example.test`,
          displayName: 'Synthetic test user',
          emailVerifiedAt: new Date(),
          ...extra,
        },
      });
    }
    alice = await user();
    bob = await user();
    pending = await user({ emailVerifiedAt: null });
    disabled = await user({ status: 'DISABLED' });
    orgA = await repo.createForVerifiedUser(alice.id, 'Alpha');
    orgIds.push(orgA.id);
    orgB = await repo.createForVerifiedUser(bob.id, 'Beta');
    orgIds.push(orgB.id);
    memberA = await db.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgA.id, userId: alice.id } },
    });
    memberB = await db.membership.findUniqueOrThrow({
      where: { organizationId_userId: { organizationId: orgB.id, userId: bob.id } },
    });
  }, 30000);

  afterAll(async () => {
    if (!db) return;
    try {
      // Remove only UUIDs created by this suite, never truncate shared tables.
      await db.$transaction(async (tx) => {
        await tx.organizationRoleGrant.deleteMany({ where: { organizationId: { in: orgIds } } });
        await tx.membership.deleteMany({ where: { organizationId: { in: orgIds } } });
        await tx.organization.deleteMany({ where: { id: { in: orgIds } } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });
    } finally {
      await db.$disconnect();
    }
  });

  it('atomically creates a workspace, its owner membership and employee grant', async () => {
    const context = await repo.findOwnMembership(alice.id, orgA.id);
    expect(context).toEqual({
      membershipId: memberA.id,
      organizationId: orgA.id,
      organizationName: 'Alpha',
      isOwner: true,
      roles: ['EMPLOYEE'],
    });
    expect(context).not.toHaveProperty('passwordHash');
    expect(context).not.toHaveProperty('normalizedEmail');
  });
  it('denies cross-organization selectors just like nonexistent resources', async () => {
    await expect(repo.findOwnMembership(alice.id, orgB.id)).rejects.toMatchObject({
      status: 404,
      message: 'Workspace not found.',
    });
    await expect(repo.findOwnMembership(alice.id, randomUUID())).rejects.toMatchObject({
      status: 404,
      message: 'Workspace not found.',
    });
  });
  it('rejects disabled and unverified users without creating a workspace', async () => {
    const before = await db.organization.count();
    await expect(repo.createForVerifiedUser(pending.id, 'Denied')).rejects.toMatchObject({
      status: 404,
    });
    await expect(repo.createForVerifiedUser(disabled.id, 'Denied')).rejects.toMatchObject({
      status: 404,
    });
    expect(await db.organization.count()).toBe(before);
  });
  it('validates organization names before writing', async () => {
    await expect(repo.createForVerifiedUser(alice.id, '   ')).rejects.toMatchObject({
      status: 400,
    });
    await expect(repo.createForVerifiedUser(alice.id, 'x'.repeat(101))).rejects.toMatchObject({
      status: 400,
    });
  });
  it('enforces unique normalized emails including concurrent writes', async () => {
    const email = `${randomUUID()}@example.test`;
    const ids = [randomUUID(), randomUUID()];
    userIds.push(...ids);
    const results = await Promise.allSettled(
      ids.map((id) =>
        db.user.create({ data: { id, normalizedEmail: email, displayName: 'Duplicate test' } }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('rejects non-normalized email at the database boundary', async () => {
    await expect(
      db.user.create({
        data: { normalizedEmail: 'MixedCase@example.test', displayName: 'Invalid' },
      }),
    ).rejects.toThrow();
  });
  it('rejects duplicate memberships and grants', async () => {
    await expect(
      db.membership.create({ data: { organizationId: orgA.id, userId: alice.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      db.organizationRoleGrant.create({
        data: { organizationId: orgA.id, membershipId: memberA.id, role: 'EMPLOYEE' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects a role grant linked to another organization member', async () => {
    await expect(
      db.organizationRoleGrant.create({
        data: { organizationId: orgA.id, membershipId: memberB.id, role: 'ADMIN' },
      }),
    ).rejects.toThrow();
    expect(
      await db.organizationRoleGrant.count({ where: { organizationId: orgA.id, role: 'ADMIN' } }),
    ).toBe(0);
  });
  it('rejects an owner from another organization', async () => {
    await expect(
      db.organization.update({ where: { id: orgA.id }, data: { ownerMembershipId: memberB.id } }),
    ).rejects.toThrow();
    expect((await repo.findOwnMembership(alice.id, orgA.id)).isOwner).toBe(true);
  });
  it('rolls back organization insertion if the deferred owner is absent', async () => {
    const id = randomUUID();
    await expect(
      db.$transaction((tx) =>
        tx.organization.create({
          data: { id, name: 'Incomplete', ownerMembershipId: randomUUID() },
        }),
      ),
    ).rejects.toThrow();
    expect(await db.organization.findUnique({ where: { id } })).toBeNull();
  });
  it('rejects suspending or removing the sole owner membership', async () => {
    for (const status of ['SUSPENDED', 'REMOVED']) {
      await expect(
        db.membership.update({ where: { id: memberA.id }, data: { status } }),
      ).rejects.toThrow();
    }
    expect((await db.membership.findUniqueOrThrow({ where: { id: memberA.id } })).status).toBe(
      'ACTIVE',
    );
  });
  it('denies inactive memberships and restores access only to active ones', async () => {
    const member = await db.membership.create({
      data: { organizationId: orgA.id, userId: bob.id },
    });
    expect((await repo.findOwnMembership(bob.id, orgA.id)).isOwner).toBe(false);
    for (const status of ['SUSPENDED', 'REMOVED']) {
      await db.membership.update({ where: { id: member.id }, data: { status } });
      await expect(repo.findOwnMembership(bob.id, orgA.id)).rejects.toMatchObject({ status: 404 });
    }
  });
  it('denies archived organizations even to their owner', async () => {
    await db.organization.update({ where: { id: orgA.id }, data: { status: 'ARCHIVED' } });
    try {
      await expect(repo.findOwnMembership(alice.id, orgA.id)).rejects.toMatchObject({
        status: 404,
      });
    } finally {
      await db.organization.update({ where: { id: orgA.id }, data: { status: 'ACTIVE' } });
    }
  });
  it('rechecks account state rather than trusting old membership results', async () => {
    await db.user.update({ where: { id: alice.id }, data: { status: 'DISABLED' } });
    try {
      await expect(repo.findOwnMembership(alice.id, orgA.id)).rejects.toMatchObject({
        status: 404,
      });
    } finally {
      await db.user.update({ where: { id: alice.id }, data: { status: 'ACTIVE' } });
    }
  });
});
