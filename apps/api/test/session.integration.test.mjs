import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { hash as legacyHash, verify } from '@node-rs/argon2';
import { createDatabaseClient } from '../dist/database/client.js';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { PasswordHasher } from '../dist/auth/password-hasher.js';
import { SessionService, tokenDigest } from '../dist/auth/session.service.js';
import { LoginRateLimiter } from '../dist/auth/login-rate-limiter.js';
import { OrganizationRepository } from '../dist/organizations/organization.repository.js';
import { cleanupAuthHistory } from '../dist/auth/cleanup.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('Session persistence, isolation and concurrency', () => {
  let db, service, hash, now, limiter;
  const hasher = new PasswordHasher(),
    users = [],
    keys = [],
    orgs = [];
  const password = 'coffee mountain river 492!';
  const config = { origin: 'http://127.0.0.1:3000', rateSecret: randomUUID() };
  beforeAll(async () => {
    const url = parseDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Use a dedicated database ending in _test.');
    db = createDatabaseClient(url);
    limiter = new LoginRateLimiter(db, config.rateSecret);
    hash = await hasher.hash(password);
    service = new SessionService(db, config, hasher, () => new Date(now));
  });
  beforeEach(() => {
    now = Date.now();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (!db) return;
    try {
      await db.$transaction(async (tx) => {
        await tx.organizationRoleGrant.deleteMany({ where: { organizationId: { in: orgs } } });
        await tx.membership.deleteMany({ where: { organizationId: { in: orgs } } });
        await tx.organization.deleteMany({ where: { id: { in: orgs } } });
        await tx.authSession.deleteMany({ where: { userId: { in: users } } });
        await tx.authSecurityEvent.deleteMany({ where: { userId: { in: users } } });
        await tx.user.deleteMany({ where: { id: { in: users } } });
        await tx.authRateBucket.deleteMany({ where: { keyDigest: { in: keys } } });
      });
    } finally {
      await db.$disconnect();
    }
  });
  async function fixture(extra = {}) {
    const id = randomUUID(),
      email = `${id}@example.test`,
      ip = randomUUID();
    users.push(id);
    keys.push(limiter.digest('email', email), limiter.digest('ip', ip));
    const user = await db.user.create({
      data: {
        id,
        normalizedEmail: email,
        displayName: 'Synthetic session user',
        passwordHash: hash,
        ...extra,
      },
    });
    return {
      user,
      input: { email, password },
      ip,
      login: (rememberMe = false, old = null) =>
        service.login({ email, password, rememberMe }, ip, old),
    };
  }
  const row = (token) =>
    db.authSession.findUniqueOrThrow({ where: { tokenDigest: tokenDigest(token) } });
  it('stores only a random token digest and restricts unverified identity', async () => {
    const f = await fixture(),
      result = await f.login();
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const saved = await row(result.token);
    expect(saved.tokenDigest).not.toBe(result.token);
    expect(saved.absoluteExpiresAt.getTime() - now).toBe(12 * 3600000);
    expect(saved.idleExpiresAt.getTime() - now).toBe(30 * 60000);
    expect(result.maxAge).toBeUndefined();
    const current = await service.current(result.token);
    expect(current.user.verified).toBe(false);
    expect(current.memberships).toEqual([]);
    expect(JSON.stringify(current)).not.toContain(hash);
  });
  it('upgrades older password parameters after successful verification', async () => {
    const oldHash = await legacyHash(password, { memoryCost: 19456, timeCost: 1, parallelism: 1 });
    const f = await fixture({ passwordHash: oldHash });
    await f.login();
    const user = await db.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(user.passwordHash).not.toBe(oldHash);
    expect(user.passwordHash).toContain('m=19456,t=2,p=1');
    expect(await verify(user.passwordHash, password)).toBe(true);
  });
  it('enforces the IP budget independently of account keys', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 31 }, () => limiter.reserve('ip', f.ip)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(30);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('rotates login tokens and prevents fixation', async () => {
    const f = await fixture(),
      first = await f.login(),
      second = await f.login(false, first.token);
    expect(first.token).not.toBe(second.token);
    await expect(service.current(first.token)).rejects.toThrow('Authentication failed');
    expect((await row(first.token)).revokedAt).not.toBeNull();
    expect((await service.current(second.token)).user.id).toBe(f.user.id);
  });
  it('throttles idle touches to a minute and expires inactive sessions', async () => {
    const f = await fixture(),
      result = await f.login(),
      initial = await row(result.token);
    now += 59000;
    await service.current(result.token);
    expect((await row(result.token)).lastSeenAt).toEqual(initial.lastSeenAt);
    now += 1000;
    await service.current(result.token);
    expect((await row(result.token)).idleExpiresAt.getTime()).toBe(now + 30 * 60000);
    now += 30 * 60000;
    await expect(service.current(result.token)).rejects.toThrow('Authentication failed');
  });
  it('caps idle renewal at absolute expiry', async () => {
    const f = await fixture(),
      result = await f.login(),
      saved = await row(result.token);
    now = saved.absoluteExpiresAt.getTime() - 1000;
    await db.authSession.update({
      where: { id: saved.id },
      data: { idleExpiresAt: saved.absoluteExpiresAt },
    });
    await service.current(result.token);
    expect((await row(result.token)).idleExpiresAt).toEqual(saved.absoluteExpiresAt);
    now += 1000;
    await expect(service.current(result.token)).rejects.toThrow('Authentication failed');
  });
  it('supports Remember me while preserving the original deadline on reauthentication', async () => {
    const f = await fixture(),
      first = await f.login(true),
      original = await row(first.token);
    expect(first.maxAge).toBe(604800);
    expect(original.idleExpiresAt.getTime() - now).toBe(12 * 3600000);
    now += 60000;
    const second = await service.reauthenticate(first.token, { password }, f.ip);
    expect(second.token).not.toBe(first.token);
    expect((await row(second.token)).absoluteExpiresAt).toEqual(original.absoluteExpiresAt);
    expect(second.maxAge).toBe(604740);
    await expect(service.current(first.token)).rejects.toThrow();
  });
  it('allows only one winner for concurrent reauthentication of the same token', async () => {
    const f = await fixture(),
      first = await f.login();
    const results = await Promise.allSettled([
      service.reauthenticate(first.token, { password }, f.ip),
      service.reauthenticate(first.token, { password }, f.ip),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
  it('revokes logout and permits idempotent repeated logout', async () => {
    const f = await fixture(),
      result = await f.login();
    await service.logout(result.token);
    await service.logout(result.token);
    await service.logout(null);
    await expect(service.current(result.token)).rejects.toThrow();
  });
  it('revokes a disabled account session before clearing it, preventing later revival', async () => {
    const f = await fixture(),
      result = await f.login();
    await db.user.update({ where: { id: f.user.id }, data: { status: 'DISABLED' } });
    await service.logout(result.token);
    expect((await row(result.token)).revokedAt).not.toBeNull();
    await db.user.update({ where: { id: f.user.id }, data: { status: 'ACTIVE' } });
    await expect(service.current(result.token)).rejects.toThrow('Authentication failed');
  });

  it('requires recent authentication for logout-all and records denial', async () => {
    const f = await fixture(),
      result = await f.login();
    now += 5 * 60000;
    await expect(service.logoutAll(result.token)).rejects.toThrow('Recent password authentication');
    expect(
      await db.authSecurityEvent.count({ where: { userId: f.user.id, action: 'SECURITY_DENIED' } }),
    ).toBe(1);
    const fresh = await service.reauthenticate(result.token, { password }, f.ip);
    await service.logoutAll(fresh.token);
    await expect(service.current(fresh.token)).rejects.toThrow();
  });
  it('increments authVersion and revokes every session on logout-all', async () => {
    const f = await fixture(),
      first = await f.login(),
      second = await f.login();
    await service.logoutAll(first.token);
    await expect(service.current(second.token)).rejects.toThrow();
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).authVersion).toBe(1);
    expect((await service.current((await f.login()).token)).user.id).toBe(f.user.id);
  });
  it('blocks in-flight issuance after logout-all changes the user version', async () => {
    const f = await fixture(),
      first = await f.login();
    let release, started;
    const wait = new Promise((resolve) => {
      started = resolve;
    });
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const delayed = {
      verify: async () => {
        started();
        await blocked;
        return true;
      },
      needsRehash: () => false,
    };
    const other = new SessionService(db, config, delayed, () => new Date(now));
    const pending = other.login(f.input, f.ip, null);
    const rejection = expect(pending).rejects.toThrow('Authentication failed');
    await wait;
    await service.logoutAll(first.token);
    release();
    await rejection;
    expect(await db.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(0);
  });
  it('enforces five active sessions under concurrent issuance', async () => {
    const f = await fixture();
    for (let i = 0; i < 5; i++) {
      await f.login();
      now += 1000;
    }
    await Promise.all([f.login(), f.login(), f.login()]);
    expect(await db.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(5);
    expect(
      await db.authSecurityEvent.count({
        where: { userId: f.user.id, action: 'SESSION_LIMIT_REVOKED' },
      }),
    ).toBe(3);
  });
  it('lists/revokes only own sessions without exposing digests', async () => {
    const a = await fixture(),
      b = await fixture(),
      sa = await a.login(),
      sb = await b.login();
    const otherId = (await row(sb.token)).id;
    await expect(service.revoke(sa.token, otherId)).rejects.toThrow('Session not found');
    const own = await service.list(sa.token);
    expect(own).toHaveLength(1);
    expect(JSON.stringify(own)).not.toContain('tokenDigest');
    expect((await service.revoke(sa.token, own[0].id)).current).toBe(true);
    await expect(service.current(sa.token)).rejects.toThrow();
  });
  it('checks current user status and authVersion on every request', async () => {
    const f = await fixture(),
      result = await f.login();
    await db.user.update({ where: { id: f.user.id }, data: { status: 'DISABLED' } });
    await expect(service.current(result.token)).rejects.toThrow();
    await db.user.update({
      where: { id: f.user.id },
      data: { status: 'ACTIVE', authVersion: { increment: 1 } },
    });
    await expect(service.current(result.token)).rejects.toThrow();
  });
  it('loads live membership grants and excludes archived workspaces', async () => {
    const f = await fixture({ emailVerifiedAt: new Date(now) });
    const org = await new OrganizationRepository(db).createForVerifiedUser(
      f.user.id,
      'Session test workspace',
    );
    orgs.push(org.id);
    const result = await f.login();
    const context = await service.current(result.token);
    expect(context.memberships).toHaveLength(1);
    const member = context.memberships[0];
    await db.organizationRoleGrant.create({
      data: { organizationId: org.id, membershipId: member.id, role: 'HR' },
    });
    expect((await service.current(result.token)).memberships[0].roles).toContainEqual({
      role: 'HR',
    });
    await db.organization.update({ where: { id: org.id }, data: { status: 'ARCHIVED' } });
    expect((await service.current(result.token)).memberships).toEqual([]);
  });
  it('rolls back session creation and rotation when its audit write fails', async () => {
    const f = await fixture(),
      first = await f.login();
    jest.spyOn(service, 'audit').mockRejectedValue(new Error('audit failed'));
    await expect(f.login(false, first.token)).rejects.toThrow('Authentication is unavailable');
    expect((await row(first.token)).revokedAt).toBeNull();
    expect(await db.authSession.count({ where: { userId: f.user.id } })).toBe(1);
  });
  it('bounds concurrent account attempts and refunds successful reservations only', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => limiter.reserve('email', f.input.email)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    const admitted = results.find((r) => r.status === 'fulfilled').value;
    await limiter.releaseSuccess(admitted);
    expect(
      (await db.authRateBucket.findUniqueOrThrow({ where: { keyDigest: admitted.key } })).hits,
    ).toBe(5);
    await db.authRateBucket.update({
      where: { keyDigest: admitted.key },
      data: { expiresAt: new Date(0) },
    });
    await limiter.reserve('email', f.input.email);
    await limiter.releaseSuccess(admitted);
    expect(
      (await db.authRateBucket.findUniqueOrThrow({ where: { keyDigest: admitted.key } })).hits,
    ).toBe(1);
  });
  it('changes the password atomically, revokes every own session and preserves other accounts', async () => {
    const f = await fixture(),
      other = await fixture();
    const first = await f.login(),
      second = await f.login(),
      foreign = await other.login();
    const newPassword = '  ocean lantern café 927!  ';
    await service.changePassword(first.token, { currentPassword: password, newPassword }, f.ip);
    const user = await db.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(user.authVersion).toBe(1);
    expect(await verify(user.passwordHash, newPassword)).toBe(true);
    expect(await verify(user.passwordHash, newPassword.trim())).toBe(false);
    for (const token of [first.token, second.token])
      await expect(service.current(token)).rejects.toThrow('Authentication failed');
    expect((await service.current(foreign.token)).user.id).toBe(other.user.id);
    await expect(f.login()).rejects.toThrow('Authentication failed');
    await expect(
      service.login({ email: f.input.email, password: newPassword }, f.ip, null),
    ).resolves.toBeDefined();
    expect(
      await db.authSecurityEvent.count({
        where: { userId: f.user.id, action: 'PASSWORD_CHANGED' },
      }),
    ).toBe(1);
  });
  it('denies wrong current passwords and shares the account guessing budget', async () => {
    const f = await fixture(),
      first = await f.login();
    const input = { currentPassword: 'incorrect', newPassword: 'new mountain river 492!' };
    for (let i = 0; i < 5; i++)
      await expect(service.changePassword(first.token, input, f.ip)).rejects.toThrow(
        'Authentication failed',
      );
    await expect(service.changePassword(first.token, input, f.ip)).rejects.toThrow(
      'Too many authentication requests',
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash).toBe(hash);
    expect((await service.current(first.token)).user.id).toBe(f.user.id);
  });
  it('requires recent authentication before spending hash work', async () => {
    const f = await fixture(),
      first = await f.login();
    now += 5 * 60000;
    const hashSpy = jest.spyOn(hasher, 'hash');
    await expect(
      service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      ),
    ).rejects.toThrow('Recent password authentication');
    expect(hashSpy).not.toHaveBeenCalled();
    expect(
      await db.authSecurityEvent.count({ where: { userId: f.user.id, action: 'SECURITY_DENIED' } }),
    ).toBe(1);
  });
  it('denies password changes for disabled users', async () => {
    const f = await fixture(),
      first = await f.login();
    await db.user.update({ where: { id: f.user.id }, data: { status: 'DISABLED' } });
    await expect(
      service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      ),
    ).rejects.toThrow('Authentication failed');
  });
  it('concurrent password changes have one winner', async () => {
    const f = await fixture(),
      first = await f.login();
    const results = await Promise.allSettled(
      ['new mountain river 492!', 'another forest ocean 528!'].map((newPassword) =>
        service.changePassword(first.token, { currentPassword: password, newPassword }, f.ip),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).authVersion).toBe(1);
  });
  it('audit failure rolls back the password, version and session revocation', async () => {
    const f = await fixture(),
      first = await f.login();
    jest.spyOn(service, 'audit').mockRejectedValue(new Error('audit failed'));
    await expect(
      service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      ),
    ).rejects.toThrow('Authentication is unavailable');
    const user = await db.user.findUniqueOrThrow({ where: { id: f.user.id } });
    expect(user.passwordHash).toBe(hash);
    expect(user.authVersion).toBe(0);
    expect((await row(first.token)).revokedAt).toBeNull();
  });
  it.each(['revoked', 'expired-reauth'])(
    'rechecks %s after hashing outside the transaction',
    async (condition) => {
      const f = await fixture(),
        first = await f.login();
      const original = hasher.hash.bind(hasher);
      let entered, release;
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      jest.spyOn(hasher, 'hash').mockImplementationOnce(async (value) => {
        entered();
        await gate;
        return original(value);
      });
      const change = service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      );
      const denied = expect(change).rejects.toThrow(
        condition === 'revoked' ? 'Authentication failed' : 'Recent password authentication',
      );
      await started;
      try {
        if (condition === 'revoked') await service.logoutAll(first.token);
        else now += 5 * 60000;
      } finally {
        release();
      }
      await denied;
      expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).passwordHash).toBe(
        hash,
      );
    },
  );
  it('a login that verified the old password cannot issue a session after password change', async () => {
    const f = await fixture(),
      first = await f.login();
    const original = hasher.verify.bind(hasher);
    let entered, release;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    jest.spyOn(hasher, 'verify').mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      entered();
      await gate;
      return result;
    });
    const login = f.login();
    const denied = expect(login).rejects.toThrow('Authentication failed');
    await started;
    try {
      await service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      );
    } finally {
      release();
    }
    await denied;
    expect(await db.authSession.count({ where: { userId: f.user.id, revokedAt: null } })).toBe(0);
  });
  it('a failed quota refund does not report a committed password change as failed', async () => {
    const f = await fixture(),
      first = await f.login();
    jest
      .spyOn(LoginRateLimiter.prototype, 'releaseSuccess')
      .mockRejectedValue(new Error('quota unavailable'));
    await expect(
      service.changePassword(
        first.token,
        { currentPassword: password, newPassword: 'new mountain river 492!' },
        f.ip,
      ),
    ).resolves.toBeUndefined();
    expect((await row(first.token)).revokedAt).not.toBeNull();
  });

  it('cleans retained expired sessions and old audits without deleting current records', async () => {
    const f = await fixture(),
      first = await f.login(),
      second = await f.login();
    const saved = await row(first.token);
    const past = new Date(now - 9 * 86400000);
    await db.authSession.update({
      where: { id: saved.id },
      data: {
        createdAt: past,
        lastSeenAt: past,
        reauthenticatedAt: past,
        idleExpiresAt: new Date(past.getTime() + 60000),
        absoluteExpiresAt: new Date(past.getTime() + 120000),
      },
    });
    await db.authSecurityEvent.updateMany({
      where: { userId: f.user.id, targetId: saved.id },
      data: { createdAt: new Date(now - 31 * 86400000) },
    });
    const result = await cleanupAuthHistory(db, new Date(now));
    expect(result.sessions).toBeGreaterThanOrEqual(1);
    expect(result.events).toBeGreaterThanOrEqual(1);
    expect(await db.authSession.findUnique({ where: { id: saved.id } })).toBeNull();
    expect((await service.current(second.token)).user.id).toBe(f.user.id);
  });
});
