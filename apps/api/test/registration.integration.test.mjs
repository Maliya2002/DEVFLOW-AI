import { randomUUID } from 'node:crypto';
import { verify } from '@node-rs/argon2';
import { createDatabaseClient } from '../dist/database/client.js';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { PasswordHasher } from '../dist/auth/password-hasher.js';
import { RegistrationService, REGISTRATION_ACCEPTED } from '../dist/auth/registration.service.js';
import { RegistrationRateLimiter } from '../dist/auth/rate-limiter.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('Registration persistence and shared limits', () => {
  let db, service, limiter;
  const emails = [],
    keys = [];
  const secret = randomUUID();
  const password = 'mountain coffee moon 482!';
  function fixture() {
    const email = `${randomUUID()}@example.test`,
      ip = randomUUID();
    emails.push(email);
    keys.push(limiter.digest('email', email), limiter.digest('ip', ip));
    return { input: { email, displayName: 'Synthetic registration', password }, ip };
  }
  beforeAll(() => {
    const url = parseDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Use a dedicated database ending in _test.');
    db = createDatabaseClient(url);
    service = new RegistrationService(
      db,
      { origin: 'http://127.0.0.1:3000', rateSecret: secret },
      new PasswordHasher(),
    );
    limiter = new RegistrationRateLimiter(db, secret);
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.authSecurityEvent.deleteMany({
        where: { user: { normalizedEmail: { in: emails } } },
      });
      await db.user.deleteMany({ where: { normalizedEmail: { in: emails } } });
      await db.authRateBucket.deleteMany({ where: { keyDigest: { in: keys } } });
    } finally {
      await db.$disconnect();
    }
  });
  it('creates an unverified user and audit event, without memberships', async () => {
    const { input, ip } = fixture();
    expect(
      await service.register({ ...input, email: ` ${input.email.toUpperCase()} ` }, ip),
    ).toEqual(REGISTRATION_ACCEPTED);
    const user = await db.user.findUniqueOrThrow({
      where: { normalizedEmail: input.email },
      include: { securityEvents: true, memberships: true },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.memberships).toEqual([]);
    expect(user.securityEvents.map((event) => event.action)).toEqual(['REGISTRATION_CREATED']);
    expect(await verify(user.passwordHash, password)).toBe(true);
  });
  it('accepts concurrent duplicate emails without overwriting the first account', async () => {
    const { input, ip } = fixture();
    const results = await Promise.all([service.register(input, ip), service.register(input, ip)]);
    expect(results).toEqual([REGISTRATION_ACCEPTED, REGISTRATION_ACCEPTED]);
    const before = await db.user.findUniqueOrThrow({ where: { normalizedEmail: input.email } });
    expect(
      await service.register({ ...input, password: 'different river password 42!' }, ip),
    ).toEqual(REGISTRATION_ACCEPTED);
    const after = await db.user.findUniqueOrThrow({ where: { normalizedEmail: input.email } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(await db.authSecurityEvent.count({ where: { userId: before.id } })).toBe(1);
    await expect(service.register(input, ip)).rejects.toThrow('Too many registration requests');
  });
  it('enforces the email cap across limiter instances and concurrent requests', async () => {
    const { input } = fixture();
    const other = new RegistrationRateLimiter(db, secret);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => (i % 2 ? limiter : other).consume('email', input.email)),
    );
    expect(results.filter((retry) => retry === 0)).toHaveLength(3);
    expect(results.filter((retry) => retry > 0)).toHaveLength(5);
    const row = await db.authRateBucket.findUniqueOrThrow({
      where: { keyDigest: limiter.digest('email', input.email) },
    });
    expect(row.hits).toBe(4);
    expect(row.keyDigest).not.toContain(input.email);
  });
  it('enforces the IP cap independently from email and renews expired buckets', async () => {
    const { ip } = fixture();
    const results = await Promise.all(Array.from({ length: 22 }, () => limiter.consume('ip', ip)));
    expect(results.filter((retry) => retry === 0)).toHaveLength(20);
    await db.authRateBucket.update({
      where: { keyDigest: limiter.digest('ip', ip) },
      data: { expiresAt: new Date(0) },
    });
    expect(await limiter.consume('ip', ip)).toBe(0);
  });
  it('counts invalid requests against the IP quota without creating users', async () => {
    const { input, ip } = fixture();
    await expect(service.register({ ...input, role: 'ADMIN' }, ip)).rejects.toThrow(
      'Invalid registration details',
    );
    expect(await db.user.count({ where: { normalizedEmail: input.email } })).toBe(0);
    expect(
      (
        await db.authRateBucket.findUniqueOrThrow({
          where: { keyDigest: limiter.digest('ip', ip) },
        })
      ).hits,
    ).toBe(1);
  });
  it('rolls back the user when the required audit write fails', async () => {
    const { input } = fixture();
    await expect(
      db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { normalizedEmail: input.email, displayName: input.displayName },
        });
        await tx.authSecurityEvent.create({ data: { userId: user.id, action: 'INVALID_ACTION' } });
      }),
    ).rejects.toThrow();
    expect(await db.user.count({ where: { normalizedEmail: input.email } })).toBe(0);
  });
});
