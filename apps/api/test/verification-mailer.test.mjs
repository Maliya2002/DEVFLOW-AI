import { jest } from '@jest/globals';
import { createVerificationMailer, MailDeliveryError } from '../dist/auth/verification-mailer.js';

const env = {
  APP_ORIGIN: 'https://devflow.example',
  AUTH_RATE_LIMIT_SECRET: 'a'.repeat(64),
  RESEND_API_KEY: 're_testonly',
  VERIFICATION_EMAIL_FROM: 'accounts@devflow.example',
};
const input = {
  email: 'person@example.com',
  token: 'a'.repeat(43),
  requestId: '42d74334-7169-44f1-84b9-c62a180fe338',
};

test('missing mail configuration disables delivery', () => {
  expect(createVerificationMailer({})).toBeNull();
});

test.each([
  { RESEND_API_KEY: undefined },
  { VERIFICATION_EMAIL_FROM: undefined },
  { VERIFICATION_EMAIL_FROM: 'a@example.com\r\nBcc: bad@example.com' },
  { RESEND_API_KEY: 're_secret\r\nInjected: header' },
  { APP_ORIGIN: 'https://devflow.example/redirect' },
])('rejects incomplete or unsafe configuration without exposing secrets', (overrides) => {
  expect(() => createVerificationMailer({ ...env, ...overrides })).toThrow();
  try {
    createVerificationMailer({ ...env, ...overrides });
  } catch (error) {
    expect(error.message).not.toContain(env.RESEND_API_KEY);
  }
});

test('uses fixed provider, trusted fragment URL, and a stable non-secret idempotency key', async () => {
  const transport = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  await createVerificationMailer(env, transport).send(input);
  const [url, request] = transport.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(request.redirect).toBe('error');
  expect(request.signal).toBeInstanceOf(AbortSignal);
  expect(request.headers['Idempotency-Key']).toBe(`verification/${input.requestId}`);
  const body = JSON.parse(request.body);
  expect(body.to).toEqual([input.email]);
  expect(body.from).toBe(env.VERIFICATION_EMAIL_FROM);
  expect(body.text).toContain(`https://devflow.example/verify-email#token=${input.token}`);
  expect(body.text).not.toContain('?token=');
});

test('sets an eight-second deadline and cancels the unread response body', async () => {
  const timeout = jest.spyOn(AbortSignal, 'timeout');
  const cancel = jest.fn().mockResolvedValue(undefined);
  const json = jest.fn();
  const transport = jest.fn().mockResolvedValue({ ok: true, body: { cancel }, json });
  try {
    await createVerificationMailer(env, transport).send(input);
    expect(timeout).toHaveBeenCalledWith(8_000);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(json).not.toHaveBeenCalled();
  } finally {
    timeout.mockRestore();
  }
});

test.each([400, 401, 429, 500, 302])('sanitizes provider status %s', async (status) => {
  const transport = jest.fn().mockResolvedValue(new Response(`private:${input.token}`, { status }));
  await expect(createVerificationMailer(env, transport).send(input)).rejects.toThrow(
    new MailDeliveryError(),
  );
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each(['network', 'timeout', 'redirect'])('sanitizes %s failures without retries', async () => {
  const transport = jest.fn().mockRejectedValue(new Error(`private:${input.token}`));
  await expect(createVerificationMailer(env, transport).send(input)).rejects.toThrow(
    new MailDeliveryError(),
  );
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each([
  { token: 'invalid' },
  { email: 'invalid' },
  { requestId: 'invalid' },
  { redirect: 'https://attacker.example' },
])('invalid input never reaches the provider', async (overrides) => {
  const transport = jest.fn();
  await expect(
    createVerificationMailer(env, transport).send({ ...input, ...overrides }),
  ).rejects.toThrow(new MailDeliveryError());
  expect(transport).not.toHaveBeenCalled();
});
