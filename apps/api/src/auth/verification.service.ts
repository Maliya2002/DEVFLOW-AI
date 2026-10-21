import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { DATABASE_CLIENT } from '../database/database.service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { AUTH_CLOCK, tokenDigest } from './session.service.js';
import { AuthThrottled } from './login-rate-limiter.js';
import { VerificationRateLimiter } from './verification-rate-limiter.js';
import { type VerificationMailer, createVerificationMailer } from './verification-mailer.js';

export const VERIFICATION_MAILER = Symbol('VERIFICATION_MAILER');
export const VERIFICATION_ACCEPTED = {
  status: 'accepted',
  message: 'If eligible, a verification email has been requested.',
};
const emailInput = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();
const tokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
const invalid = () => new BadRequestException('Verification link is invalid or expired.');

export function configuredVerificationMailer(env: NodeJS.ProcessEnv): VerificationMailer | null {
  if (!env.EMAIL_VERIFICATION_ENABLED || env.EMAIL_VERIFICATION_ENABLED === 'false') return null;
  if (env.EMAIL_VERIFICATION_ENABLED !== 'true')
    throw new Error('EMAIL_VERIFICATION_ENABLED must be true or false.');
  const mailer = createVerificationMailer(env);
  if (!mailer) throw new Error('Email verification requires configured delivery.');
  return mailer;
}

@Injectable()
export class VerificationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: PrismaClient | null,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    @Inject(VERIFICATION_MAILER) private readonly mailer: VerificationMailer | null,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date,
  ) {}

  private async safe<T>(work: (db: PrismaClient, limiter: VerificationRateLimiter) => Promise<T>) {
    if (!this.db || !this.config)
      throw new ServiceUnavailableException('Verification is unavailable.');
    try {
      return await work(this.db, new VerificationRateLimiter(this.db, this.config.rateSecret));
    } catch (error) {
      if (error instanceof HttpException || error instanceof AuthThrottled) throw error;
      throw new ServiceUnavailableException('Verification is unavailable.');
    }
  }

  async request(body: unknown, ip: string) {
    if (!this.mailer) throw new ServiceUnavailableException('Verification is unavailable.');
    const mailer = this.mailer;
    return this.safe(async (db, limiter) => {
      await limiter.consume('request-ip', ip);
      const parsed = emailInput.safeParse(body);
      if (!parsed.success) throw new BadRequestException('Invalid verification request.');
      const { email } = parsed.data;
      await limiter.consume('request-email', email);
      const token = randomBytes(32).toString('base64url');
      const issued = await db.$transaction(async (tx) => {
        const found = await tx.user.findUnique({ where: { normalizedEmail: email } });
        if (!found) return null;
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.id}::uuid FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: found.id } });
        if (user.status !== 'ACTIVE' || user.emailVerifiedAt || user.normalizedEmail !== email)
          return null;
        const now = this.clock();
        await tx.emailVerificationToken.updateMany({
          where: { userId: user.id, consumedAt: null, invalidatedAt: null },
          data: { invalidatedAt: now },
        });
        const record = await tx.emailVerificationToken.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            email,
            tokenDigest: tokenDigest(token),
            purpose: 'EMAIL_VERIFICATION',
            createdAt: now,
            expiresAt: new Date(now.getTime() + 86400000),
          },
        });
        await tx.authSecurityEvent.create({
          data: {
            userId: user.id,
            action: 'VERIFICATION_REQUESTED',
            targetId: record.id,
            createdAt: now,
          },
        });
        return { id: record.id, userId: user.id };
      });
      if (issued) {
        // Delivery is outside the transaction. Only this issuance is invalidated on failure.
        try {
          await mailer.send({ email, token, requestId: issued.id });
        } catch {
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${issued.userId}::uuid FOR UPDATE`;
            const now = this.clock();
            await tx.emailVerificationToken.updateMany({
              where: { id: issued.id, consumedAt: null, invalidatedAt: null },
              data: { invalidatedAt: now },
            });
            await tx.authSecurityEvent.create({
              data: {
                userId: issued.userId,
                action: 'VERIFICATION_DELIVERY_FAILED',
                targetId: issued.id,
                createdAt: now,
              },
            });
          });
        }
      }
      return VERIFICATION_ACCEPTED;
    });
  }

  async confirm(body: unknown, ip: string) {
    return this.safe(async (db, limiter) => {
      await limiter.consume('confirm-ip', ip);
      const parsed = tokenInput.safeParse(body);
      if (!parsed.success) throw invalid();
      const digest = tokenDigest(parsed.data.token);
      await db.$transaction(async (tx) => {
        const found = await tx.emailVerificationToken.findUnique({
          where: { tokenDigest: digest },
        });
        if (!found) throw invalid();
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${found.userId}::uuid FOR UPDATE`;
        const record = await tx.emailVerificationToken.findUnique({
          where: { id: found.id },
          include: { user: true },
        });
        const now = this.clock();
        if (
          !record ||
          record.purpose !== 'EMAIL_VERIFICATION' ||
          record.consumedAt ||
          record.invalidatedAt ||
          record.expiresAt <= now ||
          record.user.status !== 'ACTIVE' ||
          record.user.emailVerifiedAt ||
          record.email !== record.user.normalizedEmail
        )
          throw invalid();
        const used = await tx.emailVerificationToken.updateMany({
          where: { id: record.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (used.count !== 1) throw invalid();
        await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } });
        await tx.authSecurityEvent.create({
          data: {
            userId: record.userId,
            action: 'EMAIL_VERIFIED',
            targetId: record.id,
            createdAt: now,
          },
        });
      });
      return { status: 'verified' };
    });
  }
}
