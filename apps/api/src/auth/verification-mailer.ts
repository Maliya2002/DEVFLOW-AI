import { z } from 'zod';
import { parseAuthConfig } from './config.js';

export interface VerificationMailer {
  send(input: { email: string; token: string; requestId: string }): Promise<void>;
}

export class MailDeliveryError extends Error {
  constructor() {
    super('Verification email could not be accepted.');
    this.name = 'MailDeliveryError';
  }
}

const inputSchema = z
  .object({
    email: z.email().max(254),
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    requestId: z.uuid(),
  })
  .strict();

/**
 * Deliberately opt-in: a working fragment-consuming landing page must exist
 * before this factory is connected to the verification request service.
 */
export function createVerificationMailer(
  env: NodeJS.ProcessEnv,
  transport: typeof fetch = fetch,
): VerificationMailer | null {
  if (!env.RESEND_API_KEY && !env.VERIFICATION_EMAIL_FROM) return null;
  const configError =
    'Configure verification email credentials, sender, and authentication origin.';
  if (
    !/^re_[A-Za-z0-9_-]+$/.test(env.RESEND_API_KEY ?? '') ||
    !z.email().max(254).safeParse(env.VERIFICATION_EMAIL_FROM).success
  )
    throw new Error(configError);
  const auth = parseAuthConfig(env);
  if (!auth) throw new Error(configError);
  const apiKey = env.RESEND_API_KEY;
  const sender = env.VERIFICATION_EMAIL_FROM;

  return {
    async send(input) {
      // No raw validation errors: they can contain the verification token.
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) throw new MailDeliveryError();
      const link = new URL('/verify-email', auth.origin);
      link.hash = `token=${parsed.data.token}`;
      try {
        const response = await transport('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(8_000),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `verification/${parsed.data.requestId}`,
          },
          body: JSON.stringify({
            from: sender,
            to: [parsed.data.email],
            subject: 'Verify your DevFlow AI email',
            text: `Verify your email address:\n\n${link.href}\n\nThis link expires in 24 hours. If you did not request it, ignore this email.`,
          }),
        });
        // Do not parse or expose provider bodies, which may contain private data.
        await response.body?.cancel();
        if (!response.ok) throw new MailDeliveryError();
      } catch {
        // Includes timeout, redirect, network and provider errors. No raw cause.
        throw new MailDeliveryError();
      }
    },
  };
}
