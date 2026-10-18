import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DATABASE_CLIENT } from '../database/database.service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { PasswordHasher } from './password-hasher.js';
import { RegistrationRateLimiter } from './rate-limiter.js';
import { parseRegistrationInput } from './registration-input.js';

export class RegistrationThrottled extends Error {
  constructor(readonly retryAfter: number) {
    super('Too many registration requests.');
  }
}
export const REGISTRATION_ACCEPTED = {
  status: 'accepted',
  message: 'If registration can proceed, the request has been accepted.',
};

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: PrismaClient | null,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    private readonly hasher: PasswordHasher,
  ) {}

  async register(body: unknown, ip: string) {
    if (!this.db || !this.config)
      throw new ServiceUnavailableException('Registration is unavailable.');
    const limiter = new RegistrationRateLimiter(this.db, this.config.rateSecret);
    const consume = async (scope: 'ip' | 'email', value: string) => {
      let retry: number;
      try {
        retry = await limiter.consume(scope, value);
      } catch {
        throw new ServiceUnavailableException('Registration is unavailable.');
      }
      if (retry) throw new RegistrationThrottled(retry);
    };
    await consume('ip', ip);
    const input = parseRegistrationInput(body);
    await consume('email', input.email);
    // Hash even duplicate requests; never expose whether an address exists.
    const passwordHash = await this.hasher.hash(input.password);
    try {
      await this.db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            normalizedEmail: input.email,
            displayName: input.displayName,
            passwordHash,
            securityEvents: { create: { action: 'REGISTRATION_CREATED' } },
          },
        });
      });
    } catch (error) {
      // Only the email uniqueness conflict is an accepted duplicate.
      const conflict = error as { code?: string; meta?: { target?: string[]; modelName?: string } };
      if (
        conflict.code !== 'P2002' ||
        conflict.meta?.modelName !== 'User' ||
        !conflict.meta?.target?.includes('normalizedEmail')
      )
        throw new ServiceUnavailableException('Registration is unavailable.');
    }
    return REGISTRATION_ACCEPTED;
  }
}
