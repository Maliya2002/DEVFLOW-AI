import { createHash, randomBytes } from 'node:crypto';
import {
  Inject,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  HttpException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DATABASE_CLIENT } from '../database/database.service.js';
import type { PrismaClient, Prisma, User, AuthSession } from '../generated/prisma/client.js';
import { AUTH_CONFIG, type AuthConfig } from './config.js';
import { PasswordHasher, DUMMY_PASSWORD_HASH } from './password-hasher.js';
import { LoginRateLimiter, AuthThrottled } from './login-rate-limiter.js';
import { loginInput, reauthInput, passwordChangeInput, parseInput } from './session-input.js';

export const AUTH_CLOCK = Symbol('AUTH_CLOCK');
const MINUTE = 60_000;
export const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
type Context = { user: User; session: AuthSession; now: Date };
const identity = (user: User) => ({
  id: user.id,
  email: user.normalizedEmail,
  displayName: user.displayName,
  verified: user.emailVerifiedAt !== null,
});
const unauthorized = () => new UnauthorizedException('Authentication failed.');

@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient | null,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig | null,
    private readonly hasher: PasswordHasher,
    @Inject(AUTH_CLOCK) private readonly clock: () => Date,
  ) {}

  private async safe<T>(work: (db: PrismaClient) => Promise<T>): Promise<T> {
    if (!this.database || !this.config)
      throw new ServiceUnavailableException('Authentication is unavailable.');
    try {
      return await work(this.database);
    } catch (error) {
      if (error instanceof HttpException || error instanceof AuthThrottled) throw error;
      throw new ServiceUnavailableException('Authentication is unavailable.');
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    userId: string | null,
    action: string,
    targetId?: string,
  ) {
    return tx.authSecurityEvent.create({
      data: { userId, action, targetId, createdAt: this.clock() },
    });
  }

  private valid(session: AuthSession, user: User, now: Date) {
    return (
      !session.revokedAt &&
      session.idleExpiresAt > now &&
      session.absoluteExpiresAt > now &&
      user.status === 'ACTIVE' &&
      user.authVersion === session.authVersionAtIssue
    );
  }

  private async withSession<T>(
    token: string | null,
    work: (tx: Prisma.TransactionClient, context: Context) => Promise<T>,
    touch = true,
  ): Promise<T> {
    return this.safe(async (db) => {
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized();
      return db.$transaction(async (tx) => {
        const lookup = await tx.authSession.findUnique({
          where: { tokenDigest: tokenDigest(token) },
          select: { userId: true },
        });
        if (!lookup) throw unauthorized();
        // Every session write locks its owner first, serializing issuance/revocation/access.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${lookup.userId}::uuid FOR UPDATE`;
        const session = await tx.authSession.findUnique({
          where: { tokenDigest: tokenDigest(token) },
          include: { user: true },
        });
        const now = this.clock();
        if (!session || !this.valid(session, session.user, now)) throw unauthorized();
        if (touch && now.getTime() - session.lastSeenAt.getTime() >= MINUTE) {
          const idle = (session.rememberMe ? 720 : 30) * MINUTE;
          await tx.authSession.update({
            where: { id: session.id },
            data: {
              lastSeenAt: now,
              idleExpiresAt: new Date(
                Math.min(now.getTime() + idle, session.absoluteExpiresAt.getTime()),
              ),
            },
          });
        }
        return work(tx, { session, user: session.user, now });
      });
    });
  }

  async login(body: unknown, ip: string, oldToken: string | null) {
    return this.safe(async (db) => {
      const limiter = new LoginRateLimiter(db, this.config!.rateSecret);
      await limiter.reserve('ip', ip);
      const input = parseInput(loginInput, body);
      const reservation = await limiter.reserve('email', input.email);
      const user = await db.user.findUnique({ where: { normalizedEmail: input.email } });
      const correct = await this.hasher.verify(
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        input.password,
      );
      if (!correct || !user?.passwordHash || user.status !== 'ACTIVE') {
        await this.audit(db, user?.id ?? null, 'LOGIN_FAILED');
        throw unauthorized();
      }
      const replacement = this.hasher.needsRehash(user.passwordHash)
        ? await this.hasher.hash(input.password)
        : null;
      await limiter.releaseSuccess(reservation);
      return this.issue(user, oldToken, input.rememberMe, false, replacement);
    });
  }

  async reauthenticate(token: string | null, body: unknown, ip: string) {
    return this.safe(async (db) => {
      const limiter = new LoginRateLimiter(db, this.config!.rateSecret);
      await limiter.reserve('ip', ip);
      const input = parseInput(reauthInput, body);
      const context = await this.withSession(token, async (_tx, context) => context, false);
      const reservation = await limiter.reserve('email', context.user.normalizedEmail);
      const correct = await this.hasher.verify(
        context.user.passwordHash ?? DUMMY_PASSWORD_HASH,
        input.password,
      );
      if (!correct || !context.user.passwordHash) {
        await this.audit(db, context.user.id, 'REAUTH_FAILED', context.session.id);
        throw unauthorized();
      }
      const replacement = this.hasher.needsRehash(context.user.passwordHash)
        ? await this.hasher.hash(input.password)
        : null;
      await limiter.releaseSuccess(reservation);
      return this.issue(context.user, token, context.session.rememberMe, true, replacement);
    });
  }

  async changePassword(token: string | null, body: unknown, ip: string) {
    return this.safe(async (db) => {
      // Share login budgets so changing routes cannot bypass password-guessing limits.
      const limiter = new LoginRateLimiter(db, this.config!.rateSecret);
      await limiter.reserve('ip', ip);
      const input = parseInput(passwordChangeInput, body);
      const snapshot = await this.withSession(
        token,
        async (tx, context) => {
          if (context.now.getTime() - context.session.reauthenticatedAt.getTime() >= 5 * MINUTE) {
            await this.audit(tx, context.user.id, 'SECURITY_DENIED', context.session.id);
            return null;
          }
          return context;
        },
        false,
      );
      if (!snapshot) throw new ForbiddenException('Recent password authentication is required.');
      const reservation = await limiter.reserve('email', snapshot.user.normalizedEmail);
      const correct = await this.hasher.verify(
        snapshot.user.passwordHash ?? DUMMY_PASSWORD_HASH,
        input.currentPassword,
      );
      if (!correct || !snapshot.user.passwordHash) {
        await this.audit(db, snapshot.user.id, 'REAUTH_FAILED', snapshot.session.id);
        throw unauthorized();
      }
      // Expensive Argon2 work runs outside the transaction and user lock.
      const passwordHash = await this.hasher.hash(input.newPassword);
      const changed = await this.withSession(
        token,
        async (tx, { user, session, now }) => {
          if (
            user.id !== snapshot.user.id ||
            user.authVersion !== snapshot.user.authVersion ||
            user.passwordHash !== snapshot.user.passwordHash
          )
            throw unauthorized();
          if (now.getTime() - session.reauthenticatedAt.getTime() >= 5 * MINUTE) {
            await this.audit(tx, user.id, 'SECURITY_DENIED', session.id);
            return false;
          }
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash, authVersion: { increment: 1 } },
          });
          await tx.authSession.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: now },
          });
          await this.audit(tx, user.id, 'PASSWORD_CHANGED', session.id);
          return true;
        },
        false,
      );
      if (!changed) throw new ForbiddenException('Recent password authentication is required.');
      // The password mutation is already committed; a quota-refund outage must not
      // turn a successful credential change into an ambiguous error response.
      await limiter.releaseSuccess(reservation).catch(() => undefined);
    });
  }

  private async issue(
    snapshot: User,
    oldToken: string | null,
    rememberMe: boolean,
    reauth: boolean,
    replacement: string | null,
  ) {
    return this.safe((db) =>
      db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${snapshot.id}::uuid FOR UPDATE`;
        const user = await tx.user.findUnique({ where: { id: snapshot.id } });
        if (
          !user ||
          user.status !== 'ACTIVE' ||
          user.authVersion !== snapshot.authVersion ||
          user.passwordHash !== snapshot.passwordHash
        )
          throw unauthorized();
        const now = this.clock();
        const old = oldToken
          ? await tx.authSession.findUnique({ where: { tokenDigest: tokenDigest(oldToken) } })
          : null;
        // Switching accounts requires logout; never revoke another user's session under this lock.
        if (old && old.userId !== user.id) throw unauthorized();
        if (reauth && (!old || !this.valid(old, user, now))) throw unauthorized();
        if (old && !old.revokedAt)
          await tx.authSession.update({ where: { id: old.id }, data: { revokedAt: now } });
        const active = await tx.authSession.findMany({
          where: {
            userId: user.id,
            revokedAt: null,
            idleExpiresAt: { gt: now },
            absoluteExpiresAt: { gt: now },
            authVersionAtIssue: user.authVersion,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        for (const session of active.slice(0, Math.max(0, active.length - 4))) {
          await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: now } });
          await this.audit(tx, user.id, 'SESSION_LIMIT_REVOKED', session.id);
        }
        if (replacement)
          await tx.user.update({ where: { id: user.id }, data: { passwordHash: replacement } });
        const token = randomBytes(32).toString('base64url');
        const absoluteExpiresAt = reauth
          ? old!.absoluteExpiresAt
          : new Date(now.getTime() + (rememberMe ? 7 * 24 : 12) * 60 * MINUTE);
        const session = await tx.authSession.create({
          data: {
            userId: user.id,
            tokenDigest: tokenDigest(token),
            authVersionAtIssue: user.authVersion,
            rememberMe,
            createdAt: now,
            lastSeenAt: now,
            reauthenticatedAt: now,
            absoluteExpiresAt,
            idleExpiresAt: new Date(
              Math.min(
                absoluteExpiresAt.getTime(),
                now.getTime() + (rememberMe ? 720 : 30) * MINUTE,
              ),
            ),
          },
        });
        await this.audit(tx, user.id, reauth ? 'SESSION_ROTATED' : 'LOGIN_SUCCEEDED', session.id);
        return {
          token,
          maxAge: rememberMe
            ? Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000)
            : undefined,
          identity: identity(user),
        };
      }),
    );
  }

  current(token: string | null) {
    return this.withSession(token, async (tx, { user }) => ({
      user: identity(user),
      memberships: user.emailVerifiedAt
        ? await tx.membership.findMany({
            where: { userId: user.id, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
            select: {
              id: true,
              organizationId: true,
              roles: { select: { role: true } },
              organization: { select: { name: true, ownerMembershipId: true } },
            },
          })
        : [],
    }));
  }

  list(token: string | null) {
    return this.withSession(token, async (tx, { user, session, now }) => {
      const rows = await tx.authSession.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          authVersionAtIssue: user.authVersion,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          absoluteExpiresAt: true,
          rememberMe: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => ({ ...row, current: row.id === session.id }));
    });
  }

  async logout(token: string | null) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    await this.safe((db) =>
      db.$transaction(async (tx) => {
        const session = await tx.authSession.findUnique({
          where: { tokenDigest: tokenDigest(token) },
        });
        if (!session) return;
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId}::uuid FOR UPDATE`;
        // Revoke even a disabled/expired session; account reactivation must not undo logout.
        const result = await tx.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: this.clock() },
        });
        if (result.count) await this.audit(tx, session.userId, 'LOGOUT', session.id);
      }),
    );
  }

  async logoutAll(token: string | null) {
    const allowed = await this.withSession(
      token,
      async (tx, { user, session, now }) => {
        if (now.getTime() - session.reauthenticatedAt.getTime() >= 5 * MINUTE) {
          await this.audit(tx, user.id, 'SECURITY_DENIED', session.id);
          return false;
        }
        await tx.user.update({ where: { id: user.id }, data: { authVersion: { increment: 1 } } });
        await tx.authSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit(tx, user.id, 'LOGOUT_ALL', session.id);
        return true;
      },
      false,
    );
    if (!allowed) throw new ForbiddenException('Recent password authentication is required.');
  }

  revoke(token: string | null, id: string) {
    return this.withSession(
      token,
      async (tx, { user, session, now }) => {
        const target = await tx.authSession.findFirst({ where: { id, userId: user.id } });
        if (!target) throw new NotFoundException('Session not found.');
        if (!target.revokedAt) {
          await tx.authSession.update({ where: { id }, data: { revokedAt: now } });
          await this.audit(tx, user.id, 'SESSION_REVOKED', id);
        }
        return { current: id === session.id };
      },
      false,
    );
  }
}
