import { jest } from '@jest/globals';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import request from 'supertest';
import { createApplication } from '../dist/app.js';
import { SessionService } from '../dist/auth/session.service.js';
import { AuthThrottled } from '../dist/auth/login-rate-limiter.js';
import { sessionCookie, readSessionCookie } from '../dist/auth/session-http.js';
import { PasswordHasher, DUMMY_PASSWORD_HASH } from '../dist/auth/password-hasher.js';
import { loginInput, parseInput } from '../dist/auth/session-input.js';

const config = { origin: 'http://127.0.0.1:3000', rateSecret: 'a'.repeat(64) };
const token = 'a'.repeat(43);
describe('Session primitives', () => {
  it('uses host-only HttpOnly cookies with explicit persistence and matching deletion', () => {
    expect(sessionCookie(config, token)).toBe(
      `devflow_session=${token}; Path=/; HttpOnly; SameSite=Lax`,
    );
    const secure = { ...config, origin: 'https://devflow.example' };
    expect(sessionCookie(secure, token, 604800)).toContain('__Host-devflow_session=');
    expect(sessionCookie(secure, token, 604800)).toContain('; Secure; Max-Age=604800');
    expect(sessionCookie(secure, null)).toContain('; Secure; Max-Age=0');
    expect(sessionCookie(secure, token)).not.toContain('Domain');
  });
  it('ignores other cookies and rejects duplicate or malformed bearer cookies', () => {
    expect(readSessionCookie(`other=x; devflow_session=${token}`, config)).toBe(token);
    expect(
      readSessionCookie(`devflow_session=${token}; devflow_session=${token}`, config),
    ).toBeNull();
    expect(readSessionCookie('devflow_session=bad', config)).toBeNull();
    expect(readSessionCookie(undefined, config)).toBeNull();
  });
  it('validates login without applying registration password policy to existing credentials', () => {
    expect(parseInput(loginInput, { email: ' A@EXAMPLE.TEST ', password: ' short ' })).toEqual({
      email: 'a@example.test',
      password: ' short ',
      rememberMe: false,
    });
    for (const extra of [{ rememberMe: 'true' }, { role: 'ADMIN' }, { password: 'x'.repeat(129) }])
      expect(() =>
        parseInput(loginInput, { email: 'a@example.test', password: 'password', ...extra }),
      ).toThrow();
  });
  it('verifies the fixed dummy hash with the same work policy', async () => {
    const hasher = new PasswordHasher();
    expect(await hasher.verify(DUMMY_PASSWORD_HASH, 'wrong credential')).toBe(false);
    expect(hasher.needsRehash(DUMMY_PASSWORD_HASH)).toBe(false);
  });
  it('returns generic outage errors instead of trusting a cookie', async () => {
    const db = {
      $transaction: jest.fn().mockRejectedValue(new Error('private connection string')),
    };
    await expect(
      new SessionService(db, config, new PasswordHasher(), () => new Date()).current(token),
    ).rejects.toThrow('Authentication is unavailable');
  });
  it.each([
    null,
    { id: 'u', passwordHash: DUMMY_PASSWORD_HASH, status: 'ACTIVE' },
    { id: 'u', passwordHash: DUMMY_PASSWORD_HASH, status: 'DISABLED' },
  ])('uses the same verification and failure contract (%#)', async (user) => {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ hits: 1, expiresAt: new Date(), retry: 1 }]),
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      authSecurityEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const hasher = { verify: jest.fn().mockResolvedValue(user?.status === 'DISABLED') };
    const service = new SessionService(db, config, hasher, () => new Date());
    await expect(
      service.login({ email: 'a@example.test', password: 'incorrect' }, '127.0.0.1', null),
    ).rejects.toThrow('Authentication failed.');
    expect(hasher.verify).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, 'incorrect');
    expect(db.authSecurityEvent.create).toHaveBeenCalled();
  });
});

describe('Session HTTP contracts', () => {
  let app, service, saved;
  beforeAll(async () => {
    saved = {
      APP_ORIGIN: process.env.APP_ORIGIN,
      AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET,
    };
    process.env.APP_ORIGIN = config.origin;
    process.env.AUTH_RATE_LIMIT_SECRET = config.rateSecret;
    app = await createApplication({ logger: false });
    await app.init();
    service = app.get(SessionService);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  });
  const mutation = (path, method = 'post') =>
    request(app.getHttpServer())
      [method](`/api/v1/auth/${path}`)
      .set('Origin', config.origin)
      .set('X-DevFlow-Request', 'browser');
  it('sets a session cookie without returning bearer values in JSON', async () => {
    jest
      .spyOn(service, 'login')
      .mockResolvedValue({ token, identity: { id: 'u', verified: false } });
    const result = await mutation('login')
      .send({ email: 'a@example.test', password: 'password' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(result.body).toEqual({ user: { id: 'u', verified: false } });
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(JSON.stringify(result.body)).not.toContain(token);
  });
  it.each(['login', 'reauthenticate', 'logout', 'logout-all'])(
    'requires origin checks for %s',
    async (path) => {
      await mutation(path).set('Origin', 'https://foreign.example').send({}).expect(403);
      await mutation(path).unset('X-DevFlow-Request').send({}).expect(403);
      await mutation(path).type('form').send({}).expect(415);
    },
  );
  it('checks CSRF on session deletion too', async () => {
    await mutation('sessions/00000000-0000-4000-8000-000000000000', 'delete')
      .unset('Origin')
      .send({})
      .expect(403);
  });
  it('rejects cross-site fetch metadata and does not grant CORS preflight', async () => {
    await mutation('login').set('Sec-Fetch-Site', 'cross-site').send({}).expect(403);
    const result = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://foreign.example');
    expect(result.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('clears invalid cookies but does not claim logout on database failure', async () => {
    jest
      .spyOn(service, 'current')
      .mockRejectedValue(new UnauthorizedException('Authentication failed.'));
    const invalid = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .expect(401)
      .expect('Cache-Control', 'no-store');
    expect(invalid.headers['set-cookie'][0]).toContain('Max-Age=0');
    jest
      .spyOn(service, 'logout')
      .mockRejectedValue(new ServiceUnavailableException('Authentication is unavailable.'));
    const outage = await mutation('logout').send({}).expect(503);
    expect(outage.headers['set-cookie']).toBeUndefined();
  });
  it('clears cookies only after successful logout and exposes retry delays', async () => {
    jest.spyOn(service, 'logout').mockResolvedValue(undefined);
    const result = await mutation('logout').send({}).expect(204);
    expect(result.headers['set-cookie'][0]).toContain('Max-Age=0');
    jest.spyOn(service, 'login').mockRejectedValue(new AuthThrottled(60));
    await mutation('login').send({}).expect(429).expect('Retry-After', '60');
  });
});
