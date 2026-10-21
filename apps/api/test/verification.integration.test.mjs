import { jest } from '@jest/globals';
import { randomUUID, randomBytes } from 'node:crypto';
import { createDatabaseClient } from '../dist/database/client.js';
import { parseDatabaseUrl } from '../dist/database/config.js';
import { VerificationService, VERIFICATION_ACCEPTED } from '../dist/auth/verification.service.js';
import { VerificationRateLimiter } from '../dist/auth/verification-rate-limiter.js';
import { tokenDigest } from '../dist/auth/session.service.js';
import { cleanupAuthHistory } from '../dist/auth/cleanup.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
integration('Verification transactions, quotas and one-time tokens', () => {
  let db, limiter, now, service, mailer;
  const users = [],
    keys = [];
  const config = { origin: 'http://127.0.0.1:3000', rateSecret: randomUUID() };
  beforeAll(() => {
    const url = parseDatabaseUrl(process.env.TEST_DATABASE_URL, 'TEST_DATABASE_URL');
    if (!new URL(url).pathname.endsWith('_test'))
      throw new Error('Use a dedicated database ending in _test.');
    db = createDatabaseClient(url);
    limiter = new VerificationRateLimiter(db, config.rateSecret);
  });
  beforeEach(() => {
    now = Date.now();
    mailer = { send: jest.fn().mockResolvedValue(undefined) };
    service = new VerificationService(db, config, mailer, () => new Date(now));
  });
  afterAll(async () => {
    if (!db) return;
    try {
      await db.emailVerificationToken.deleteMany({ where: { userId: { in: users } } });
      await db.authSecurityEvent.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.authRateBucket.deleteMany({ where: { keyDigest: { in: keys } } });
    } finally {
      await db.$disconnect();
    }
  });
  function track(email, ip) {
    keys.push(
      limiter.digest('request-email', email),
      limiter.digest('request-ip', ip),
      limiter.digest('confirm-ip', ip),
    );
  }
  async function fixture(extra = {}) {
    const id = randomUUID(),
      email = `${id}@example.test`,
      ip = randomUUID();
    users.push(id);
    track(email, ip);
    await db.user.create({
      data: { id, normalizedEmail: email, displayName: 'Synthetic verification user', ...extra },
    });
    return { id, email, ip };
  }
  async function issue(f) {
    expect(await service.request({ email: f.email }, f.ip)).toEqual(VERIFICATION_ACCEPTED);
    return mailer.send.mock.calls.at(-1)[0];
  }
  const tokenRow = (token) =>
    db.emailVerificationToken.findUniqueOrThrow({ where: { tokenDigest: tokenDigest(token) } });
  test('stores only a purpose-bound digest with 24-hour expiry; confirmation creates no session', async () => {
    const f = await fixture(),
      sent = await issue(f),
      row = await tokenRow(sent.token);
    expect(sent.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tokenDigest).not.toBe(sent.token);
    expect(row.email).toBe(f.email);
    expect(row.purpose).toBe('EMAIL_VERIFICATION');
    expect(row.expiresAt.getTime() - now).toBe(86400000);
    expect(await service.confirm({ token: sent.token }, f.ip)).toEqual({ status: 'verified' });
    expect((await db.user.findUniqueOrThrow({ where: { id: f.id } })).emailVerifiedAt).toEqual(
      new Date(now),
    );
    expect(await db.authSession.count({ where: { userId: f.id } })).toBe(0);
    expect(
      await db.authSecurityEvent.count({ where: { userId: f.id, action: 'EMAIL_VERIFIED' } }),
    ).toBe(1);
    await expect(service.confirm({ token: sent.token }, f.ip)).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
  });
  test.each([{ status: 'DISABLED' }, { emailVerifiedAt: new Date() }])(
    'ineligible accounts receive the same response without delivery (%#)',
    async (extra) => {
      const f = await fixture(extra);
      expect(await service.request({ email: f.email }, f.ip)).toEqual(VERIFICATION_ACCEPTED);
      expect(mailer.send).not.toHaveBeenCalled();
      expect(await db.emailVerificationToken.count({ where: { userId: f.id } })).toBe(0);
    },
  );
  test('unknown addresses receive the same response and share the email budget', async () => {
    const email = `${randomUUID()}@example.test`,
      ip = randomUUID();
    track(email, ip);
    for (let i = 0; i < 3; i++)
      expect(await service.request({ email }, ip)).toEqual(VERIFICATION_ACCEPTED);
    await expect(service.request({ email }, ip)).rejects.toThrow(
      'Too many authentication requests.',
    );
    expect(mailer.send).not.toHaveBeenCalled();
  });
  test('normalizes email before quota and lookup', async () => {
    const f = await fixture();
    await service.request({ email: ` ${f.email.toUpperCase()} ` }, f.ip);
    expect(mailer.send.mock.calls[0][0].email).toBe(f.email);
  });
  test('resend invalidates the previous token', async () => {
    const f = await fixture(),
      first = await issue(f),
      second = await issue(f);
    expect(first.token).not.toBe(second.token);
    await expect(service.confirm({ token: first.token }, f.ip)).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
    await expect(service.confirm({ token: second.token }, f.ip)).resolves.toEqual({
      status: 'verified',
    });
  });
  test('simultaneous confirmations have exactly one winner', async () => {
    const f = await fixture(),
      sent = await issue(f);
    const results = await Promise.allSettled([
      service.confirm({ token: sent.token }, f.ip),
      service.confirm({ token: sent.token }, f.ip),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect(
      await db.authSecurityEvent.count({ where: { userId: f.id, action: 'EMAIL_VERIFIED' } }),
    ).toBe(1);
  });
  test('concurrent resends leave exactly one usable token', async () => {
    const f = await fixture();
    await Promise.all([
      service.request({ email: f.email }, f.ip),
      service.request({ email: f.email }, f.ip),
    ]);
    const pending = await db.emailVerificationToken.findMany({
      where: { userId: f.id, invalidatedAt: null, consumedAt: null },
    });
    expect(pending).toHaveLength(1);
    expect(await db.emailVerificationToken.count({ where: { userId: f.id } })).toBe(2);
  });
  test('expiry is inclusive at the exact boundary', async () => {
    const f = await fixture(),
      sent = await issue(f);
    now += 86400000;
    await expect(service.confirm({ token: sent.token }, f.ip)).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
  });
  test.each(['disabled', 'changed-email'])('rechecks current account state: %s', async (change) => {
    const f = await fixture(),
      sent = await issue(f);
    await db.user.update({
      where: { id: f.id },
      data:
        change === 'disabled'
          ? { status: 'DISABLED' }
          : { normalizedEmail: `${randomUUID()}@example.test` },
    });
    await expect(service.confirm({ token: sent.token }, f.ip)).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
    expect((await tokenRow(sent.token)).consumedAt).toBeNull();
  });
  test('failed delivery invalidates the token and records a safe event without account disclosure', async () => {
    const f = await fixture();
    mailer.send.mockRejectedValue(new Error('private provider details'));
    const sent = await issue(f);
    expect((await tokenRow(sent.token)).invalidatedAt).not.toBeNull();
    const events = await db.authSecurityEvent.findMany({ where: { userId: f.id } });
    expect(events.map((e) => e.action)).toContain('VERIFICATION_DELIVERY_FAILED');
    expect(JSON.stringify(events)).not.toContain(sent.token);
    await expect(service.confirm({ token: sent.token }, f.ip)).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
  });
  test('confirmation still works while delivery is disabled', async () => {
    const f = await fixture(),
      sent = await issue(f);
    const disabled = new VerificationService(db, config, null, () => new Date(now));
    await expect(disabled.confirm({ token: sent.token }, f.ip)).resolves.toEqual({
      status: 'verified',
    });
  });
  test('an older delivery failure cannot invalidate a newer resend', async () => {
    const f = await fixture();
    let entered, release;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    mailer.send.mockImplementationOnce(async () => {
      entered();
      await gate;
      throw new Error('old delivery failed');
    });
    const first = service.request({ email: f.email }, f.ip);
    await started;
    try {
      await service.request({ email: f.email }, f.ip);
    } finally {
      release();
    }
    await first;
    const newest = mailer.send.mock.calls[1][0];
    expect((await tokenRow(newest.token)).invalidatedAt).toBeNull();
    await expect(service.confirm({ token: newest.token }, f.ip)).resolves.toEqual({
      status: 'verified',
    });
  });
  test('audit failure rolls back consumption and verification together', async () => {
    const f = await fixture(),
      sent = await issue(f);
    const failingDb = {
      $queryRaw: (...args) => db.$queryRaw(...args),
      $transaction: (callback) =>
        db.$transaction((tx) =>
          callback({
            ...tx,
            authSecurityEvent: {
              create: () => {
                throw new Error('audit unavailable');
              },
            },
          }),
        ),
    };
    const failing = new VerificationService(failingDb, config, mailer, () => new Date(now));
    await expect(failing.confirm({ token: sent.token }, f.ip)).rejects.toThrow(
      'Verification is unavailable.',
    );
    expect((await tokenRow(sent.token)).consumedAt).toBeNull();
    expect((await db.user.findUniqueOrThrow({ where: { id: f.id } })).emailVerifiedAt).toBeNull();
    await expect(service.confirm({ token: sent.token }, f.ip)).resolves.toEqual({
      status: 'verified',
    });
  });
  test.each([
    ['request-ip', 20],
    ['request-email', 3],
    ['confirm-ip', 10],
  ])('atomically enforces %s budget across concurrent calls', async (scope, limit) => {
    const value = randomUUID();
    keys.push(limiter.digest(scope, value));
    const results = await Promise.allSettled(
      Array.from({ length: limit + 1 }, () => limiter.consume(scope, value)),
    );
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(limit);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
  });
  test('purpose constraints reject a token from another flow', async () => {
    const f = await fixture(),
      sent = await issue(f),
      row = await tokenRow(sent.token);
    await expect(
      db.emailVerificationToken.update({
        where: { id: row.id },
        data: { purpose: 'PASSWORD_RESET' },
      }),
    ).rejects.toThrow();
    await expect(
      service.confirm({ token: randomBytes(32).toString('base64url') }, f.ip),
    ).rejects.toThrow('Verification link is invalid or expired.');
  });
  test('database constraints reject malformed digests, excessive lifetime and a second pending token', async () => {
    const f = await fixture(),
      sent = await issue(f),
      row = await tokenRow(sent.token);
    await expect(
      db.emailVerificationToken.update({
        where: { id: row.id },
        data: { tokenDigest: 'not-a-digest' },
      }),
    ).rejects.toThrow();
    await expect(
      db.emailVerificationToken.update({
        where: { id: row.id },
        data: { expiresAt: new Date(now + 86400001) },
      }),
    ).rejects.toThrow();
    await expect(
      db.emailVerificationToken.create({
        data: {
          ...row,
          id: randomUUID(),
          tokenDigest: tokenDigest(randomBytes(32).toString('base64url')),
        },
      }),
    ).rejects.toThrow();
  });
  test('an expired quota starts a fresh window', async () => {
    const value = randomUUID(),
      key = limiter.digest('request-email', value);
    keys.push(key);
    await db.authRateBucket.create({
      data: { keyDigest: key, hits: 4, expiresAt: new Date(Date.now() - 1000) },
    });
    await limiter.consume('request-email', value);
    expect((await db.authRateBucket.findUniqueOrThrow({ where: { keyDigest: key } })).hits).toBe(1);
  });
  test('bounded cleanup removes terminal tokens without an extra retention delay and keeps pending tokens', async () => {
    now -= 2 * 86400000;
    const old = await fixture(),
      sent = await issue(old);
    await service.confirm({ token: sent.token }, old.ip);
    now += 2 * 86400000;
    const recent = await fixture(),
      fresh = await issue(recent);
    const consumed = await fixture(),
      used = await issue(consumed);
    await service.confirm({ token: used.token }, consumed.ip);
    const counts = await cleanupAuthHistory(db, new Date(now));
    expect(counts.verificationTokens).toBeGreaterThanOrEqual(2);
    expect(
      await db.emailVerificationToken.findUnique({
        where: { tokenDigest: tokenDigest(used.token) },
      }),
    ).toBeNull();
    expect(
      await db.emailVerificationToken.findUnique({
        where: { tokenDigest: tokenDigest(sent.token) },
      }),
    ).toBeNull();
    expect(await tokenRow(fresh.token)).toBeDefined();
  });
});
