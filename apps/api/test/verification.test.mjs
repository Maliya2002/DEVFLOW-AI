import { jest } from '@jest/globals';
import request from 'supertest';
import { createApplication } from '../dist/app.js';
import {
  VerificationService,
  VERIFICATION_ACCEPTED,
  configuredVerificationMailer,
} from '../dist/auth/verification.service.js';
import { AuthThrottled } from '../dist/auth/login-rate-limiter.js';

const config = { origin: 'http://127.0.0.1:3000', rateSecret: 'a'.repeat(64) };
test('delivery requires explicit activation and complete provider configuration', () => {
  expect(configuredVerificationMailer({})).toBeNull();
  expect(configuredVerificationMailer({ EMAIL_VERIFICATION_ENABLED: 'false' })).toBeNull();
  expect(() => configuredVerificationMailer({ EMAIL_VERIFICATION_ENABLED: 'yes' })).toThrow();
  expect(() => configuredVerificationMailer({ EMAIL_VERIFICATION_ENABLED: 'true' })).toThrow();
});
test('disabled delivery fails uniformly before database or account lookup', async () => {
  const db = { $queryRaw: jest.fn() };
  const service = new VerificationService(db, config, null, () => new Date());
  await expect(service.request({ email: 'person@example.test' }, 'ip')).rejects.toThrow(
    'Verification is unavailable.',
  );
  expect(db.$queryRaw).not.toHaveBeenCalled();
});
test('database errors never expose details for either endpoint', async () => {
  const db = { $queryRaw: jest.fn().mockRejectedValue(new Error('private database credentials')) };
  const service = new VerificationService(db, config, { send: jest.fn() }, () => new Date());
  await expect(service.request({}, 'ip')).rejects.toThrow('Verification is unavailable.');
  await expect(service.confirm({}, 'ip')).rejects.toThrow('Verification is unavailable.');
});
test.each([{ token: 'bad' }, { token: 'a'.repeat(43), redirect: 'https://foreign.example' }, {}])(
  'confirm rejects malformed input before token lookup',
  async (body) => {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ hits: 1, retry: 900 }]),
      $transaction: jest.fn(),
    };
    const service = new VerificationService(db, config, null, () => new Date());
    await expect(service.confirm(body, 'ip')).rejects.toThrow(
      'Verification link is invalid or expired.',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);

test.each([{ email: 'invalid' }, { email: 'person@example.test', role: 'ADMIN' }, {}])(
  'request rejects malformed or extra fields before account lookup',
  async (body) => {
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ hits: 1, retry: 3600 }]),
      $transaction: jest.fn(),
    };
    const mailer = { send: jest.fn() };
    const service = new VerificationService(db, config, mailer, () => new Date());
    await expect(service.request(body, 'ip')).rejects.toThrow('Invalid verification request.');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(mailer.send).not.toHaveBeenCalled();
  },
);

test('concurrent retention cleanup preserves the generic invalid-token response', async () => {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    emailVerificationToken: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({ id: 'removed-token', userId: 'user' })
        .mockResolvedValueOnce(null),
    },
  };
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([{ hits: 1, retry: 900 }]),
    $transaction: (callback) => callback(tx),
  };
  const service = new VerificationService(db, config, null, () => new Date());
  await expect(service.confirm({ token: 'a'.repeat(43) }, 'ip')).rejects.toThrow(
    'Verification link is invalid or expired.',
  );
});

describe('Verification HTTP protections', () => {
  let app, service, saved;
  beforeAll(async () => {
    saved = Object.fromEntries(
      ['APP_ORIGIN', 'AUTH_RATE_LIMIT_SECRET', 'EMAIL_VERIFICATION_ENABLED'].map((key) => [
        key,
        process.env[key],
      ]),
    );
    process.env.APP_ORIGIN = config.origin;
    process.env.AUTH_RATE_LIMIT_SECRET = config.rateSecret;
    process.env.EMAIL_VERIFICATION_ENABLED = 'false';
    app = await createApplication({ logger: false });
    await app.init();
    service = app.get(VerificationService);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await app?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const post = (path) =>
    request(app.getHttpServer())
      .post(`/api/v1/auth/verification/${path}`)
      .set('Origin', config.origin)
      .set('X-DevFlow-Request', 'browser');
  test.each(['request', 'confirm'])(
    '%s requires same-origin browser JSON and rejects GET',
    async (path) => {
      const spy = jest.spyOn(service, path);
      await post(path).unset('Origin').send({}).expect(403);
      await post(path).unset('X-DevFlow-Request').send({}).expect(403);
      await post(path).set('Sec-Fetch-Site', 'cross-site').send({}).expect(403);
      await post(path).type('form').send({}).expect(415);
      await request(app.getHttpServer()).get(`/api/v1/auth/verification/${path}`).expect(404);
      expect(spy).not.toHaveBeenCalled();
    },
  );
  test('returns generic acceptance and verification without creating session cookies', async () => {
    jest.spyOn(service, 'request').mockResolvedValue(VERIFICATION_ACCEPTED);
    jest.spyOn(service, 'confirm').mockResolvedValue({ status: 'verified' });
    const accepted = await post('request')
      .send({ email: 'person@example.test' })
      .expect(202)
      .expect('Cache-Control', 'no-store');
    const confirmed = await post('confirm')
      .send({ token: 'a'.repeat(43) })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(accepted.body).toEqual(VERIFICATION_ACCEPTED);
    expect(confirmed.body).toEqual({ status: 'verified' });
    expect(accepted.headers['set-cookie']).toBeUndefined();
    expect(confirmed.headers['set-cookie']).toBeUndefined();
  });
  test.each(['request', 'confirm'])(
    '%s exposes retry delay but no sensitive errors',
    async (path) => {
      jest.spyOn(service, path).mockRejectedValue(new AuthThrottled(45));
      await post(path)
        .send({})
        .expect(429)
        .expect('Retry-After', '45')
        .expect('Cache-Control', 'no-store');
    },
  );
  test('rejects oversized JSON before calling the service', async () => {
    const spy = jest.spyOn(service, 'confirm');
    await post('confirm')
      .send({ token: 'a'.repeat(9000) })
      .expect(413);
    expect(spy).not.toHaveBeenCalled();
  });
});
