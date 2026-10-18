import { jest } from '@jest/globals';
import request from 'supertest';
import { verify } from '@node-rs/argon2';
import { dictionary } from '@zxcvbn-ts/language-common';
import { createApplication } from '../dist/app.js';
import { parseAuthConfig, AUTH_CONFIG } from '../dist/auth/config.js';
import { parseRegistrationInput } from '../dist/auth/registration-input.js';
import { PasswordHasher } from '../dist/auth/password-hasher.js';
import {
  RegistrationService,
  RegistrationThrottled,
  REGISTRATION_ACCEPTED,
} from '../dist/auth/registration.service.js';

const input = {
  email: ' Person@Example.test ',
  displayName: ' Person ',
  password: '  coffee river moon 48!  ',
};
const config = { APP_ORIGIN: 'http://127.0.0.1:3000', AUTH_RATE_LIMIT_SECRET: 'a'.repeat(64) };

describe('Registration policy', () => {
  it('rejects a dictionary password even when it satisfies the minimum length', () => {
    const password = dictionary['passwords-common'].find((value) => [...value].length >= 15);
    expect(password).toBeDefined();
    expect(() => parseRegistrationInput({ ...input, password })).toThrow(
      'Invalid registration details',
    );
  });
  it('normalizes email/name without changing the password', () => {
    expect(parseRegistrationInput(input)).toEqual({
      ...input,
      email: 'person@example.test',
      displayName: 'Person',
    });
  });
  it.each([
    null,
    {},
    { ...input, email: 'bad' },
    { ...input, displayName: ' ' },
    { ...input, password: 'short' },
    { ...input, password: 'a'.repeat(20) },
    { ...input, password: 'a'.repeat(129) },
    { ...input, password: '\ud800'.repeat(15) },
    { ...input, role: 'ADMIN' },
  ])('rejects invalid data without echoing values (%#)', (value) => {
    expect(() => parseRegistrationInput(value)).toThrow('Invalid registration details.');
  });
  it('counts Unicode code points and preserves spaces', () => {
    expect(parseRegistrationInput({ ...input, password: '😀🌊'.repeat(8) }).password).toBe(
      '😀🌊'.repeat(8),
    );
    expect(() => parseRegistrationInput({ ...input, password: '😀🌊'.repeat(7) })).toThrow();
  });
  it('disables registration without config and accepts canonical local config', () => {
    expect(parseAuthConfig({})).toBeNull();
    expect(parseAuthConfig(config)).toEqual({
      origin: config.APP_ORIGIN,
      rateSecret: config.AUTH_RATE_LIMIT_SECRET,
    });
  });
  it.each([
    { ...config, APP_ORIGIN: 'https://example.test/path' },
    { ...config, APP_ORIGIN: 'http://example.test' },
    { ...config, APP_ORIGIN: 'null' },
    { ...config, AUTH_RATE_LIMIT_SECRET: 'short' },
    { ...config, NODE_ENV: 'production' },
  ])('rejects insecure configuration (%#)', (env) => {
    expect(() => parseAuthConfig(env)).toThrow('Configure APP_ORIGIN');
  });
  it('hashes with salted Argon2id and verifies the exact original password', async () => {
    const hasher = new PasswordHasher();
    const a = await hasher.hash(input.password);
    const b = await hasher.hash(input.password);
    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(a).not.toBe(b);
    expect(await verify(a, input.password)).toBe(true);
    expect(await verify(a, input.password.trim())).toBe(false);
  });
  it('bounds hash admission and recovers capacity after completion', async () => {
    const hasher = new PasswordHasher();
    const pending = Array.from({ length: 10 }, () => hasher.hash(input.password));
    await expect(hasher.hash(input.password)).rejects.toThrow('Registration is busy');
    await Promise.all(pending);
    await expect(hasher.hash(input.password)).resolves.toMatch(/^\$argon2id/);
  }, 15000);
  it('fails closed without a database', async () => {
    await expect(
      new RegistrationService(null, parseAuthConfig(config), new PasswordHasher()).register(
        input,
        '127.0.0.1',
      ),
    ).rejects.toThrow('Registration is unavailable');
  });
  it('fails closed when shared rate storage fails, before hashing', async () => {
    const db = { $queryRaw: jest.fn().mockRejectedValue(new Error('private database detail')) };
    const hasher = { hash: jest.fn() };
    await expect(
      new RegistrationService(db, parseAuthConfig(config), hasher).register(input, '127.0.0.1'),
    ).rejects.toThrow('Registration is unavailable');
    expect(hasher.hash).not.toHaveBeenCalled();
  });
});

describe('Registration HTTP boundary', () => {
  let app, register, oldOrigin, oldSecret;
  beforeAll(async () => {
    oldOrigin = process.env.APP_ORIGIN;
    oldSecret = process.env.AUTH_RATE_LIMIT_SECRET;
    Object.assign(process.env, config);
    app = await createApplication({ logger: false });
    await app.init();
    expect(app.get(AUTH_CONFIG).origin).toBe(config.APP_ORIGIN);
    register = jest
      .spyOn(app.get(RegistrationService), 'register')
      .mockResolvedValue(REGISTRATION_ACCEPTED);
  });
  afterAll(async () => {
    await app?.close();
    if (oldOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = oldOrigin;
    if (oldSecret === undefined) delete process.env.AUTH_RATE_LIMIT_SECRET;
    else process.env.AUTH_RATE_LIMIT_SECRET = oldSecret;
  });
  beforeEach(() => register.mockClear());
  function post() {
    return request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', config.APP_ORIGIN)
      .set('X-DevFlow-Request', 'browser');
  }
  it('returns generic 202 with no session and ignores forwarded addresses', async () => {
    const result = await post()
      .set('X-Forwarded-For', '203.0.113.1')
      .send(input)
      .expect(202)
      .expect('Cache-Control', 'no-store');
    expect(result.body).toEqual(REGISTRATION_ACCEPTED);
    expect(result.headers['set-cookie']).toBeUndefined();
    expect(register.mock.calls[0][1]).not.toBe('203.0.113.1');
  });
  it.each(['https://foreign.test', 'null', 'http://127.0.0.1:3000.attacker.test'])(
    'rejects origin %s',
    async (origin) => {
      await post().set('Origin', origin).send(input).expect(403);
      expect(register).not.toHaveBeenCalled();
    },
  );
  it('rejects missing origin and missing custom header', async () => {
    await post().unset('Origin').send(input).expect(403);
    await post().unset('X-DevFlow-Request').send(input).expect(403);
    expect(register).not.toHaveBeenCalled();
  });
  it('rejects cross-site fetch metadata and non-JSON', async () => {
    await post().set('Sec-Fetch-Site', 'cross-site').send(input).expect(403);
    await post().type('form').send(input).expect(415);
    expect(register).not.toHaveBeenCalled();
  });
  it('bounds JSON payloads and rejects malformed JSON before service execution', async () => {
    await post()
      .send({ ...input, password: 'x'.repeat(9000) })
      .expect(413);
    await post().type('json').send('{broken').expect(400);
    expect(register).not.toHaveBeenCalled();
  });
  it('returns a retry delay when throttled', async () => {
    register.mockRejectedValueOnce(new RegistrationThrottled(42));
    await post()
      .send(input)
      .expect(429)
      .expect('Retry-After', '42')
      .expect('Cache-Control', 'no-store');
  });
});
