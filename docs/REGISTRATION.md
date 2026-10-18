# DF-009: registration backend

## Scope and acceptance

Add `POST /api/v1/auth/register`, validated credentials, bounded Argon2id hashing, atomic database rate limits, and transactional user/audit persistence. Verify invalid input, browser request boundaries, duplicate/concurrent requests, hashing, quotas, expiration, and rollback. Routine implementation, migrations to the development database, commits and task PR are authorized by the standing workflow. Sign-in, sessions, verification delivery and the frontend gateway are separate milestones.

## Request and result

Send JSON with exactly `email`, `displayName`, and `password`. Require an exact configured `Origin`, `X-DevFlow-Request: browser`, and JSON content type. Supplied cross-site Fetch Metadata is rejected. The parser limits JSON to 8 KiB; CORS access is not enabled. These are the browser CSRF controls, not proof of identity or bot prevention.

Email is trimmed, lowercased and format-validated, up to 254 characters. Provider-specific dots/plus signs are preserved. Display name is trimmed and bounded to 100 characters. Passwords contain 15–128 Unicode code points; spaces and Unicode are preserved exactly. Malformed Unicode, repeated single-character passwords and exact case-insensitive entries in the maintained zxcvbn common-password dictionary are rejected. This is a local common-password blocklist, not a comprehensive live breach lookup. Review/update that pinned dictionary as part of dependency maintenance.

Successful and duplicate-email requests both return 202 with the same body:

```json
{
  "status": "accepted",
  "message": "If registration can proceed, the request has been accepted."
}
```

No user ID, cookie, token, account-existence flag or email-delivery claim is returned. An existing account is never overwritten. New accounts remain unverified, with no organization membership. Invalid data returns generic 400; invalid origin/custom header returns 403; oversized JSON 413; wrong content type 415; rate limits 429 with `Retry-After`; missing configuration/database or saturated hashing capacity 503. Registration responses are non-cacheable. The endpoint does not guarantee identical wall-clock timings for duplicate and new records; both execute password hashing and use the same outward success contract.

## Configuration and deployment boundary

Set `APP_ORIGIN` and `AUTH_RATE_LIMIT_SECRET` in the ignored API environment file. The secret must be 32 random bytes encoded as 64 hexadecimal characters; never reuse a password or commit it. Both absent disables registration; partial/invalid settings reject application startup. Production requires an exact HTTPS origin without path, query or trailing slash; HTTP is accepted only for loopback in development.

The limiter uses the socket peer address and deliberately ignores forwarding headers. Do not expose this API through a multi-user reverse proxy until trusted-proxy address propagation and the same-origin Next gateway are implemented and tested; otherwise the proxy shares one IP quota. There is currently no browser registration form or gateway, so the existing UI remains unchanged. No production rollout or real employee account creation is part of this task.

## Implementation and storage

- `AuthModule` registers the controller and injectable services. Nest dependency injection supplies the database, validated configuration and singleton hasher.
- `RegistrationService` consumes the IP budget before input validation, then the normalized-email budget before hashing. HMAC-SHA256 keys hide raw emails/IPs in rate storage. All instances must share the same secret; rotation resets quota identities.
- PostgreSQL atomic upserts enforce 20 attempts/IP/hour and 3 attempts/email/hour, using database-clock fixed UTC hour boundaries. Counters saturate at limit+1; boundary bursts are possible. Each admitted limiter call deletes at most 100 expired rows using `SKIP LOCKED`. No cleanup happens while idle; before a company pilot, schedule bounded expiration cleanup and define retention for audit records. This is application throttling, not infrastructure DDoS protection.
- `PasswordHasher` uses `@node-rs/argon2` 2.2.2 with Argon2id v19, 19 MiB, two passes, parallelism one and independently generated salts. At most two hashes run with eight pending per API process; excess requests fail without unbounded work. Zod 4.6.7 validates input; `@zxcvbn-ts/language-common` 4.1.3 supplies the dictionary. Native prebuilt binaries support the locked install with scripts disabled.
- User creation and `REGISTRATION_CREATED` audit insertion share a transaction. Audit records contain only user ID, action and time. Database unique-email constraints resolve concurrent duplicates. The additive `202610180001_registration_controls` migration adds `AuthRateBucket` and `AuthSecurityEvent`, indexes, positive-counter/digest/action constraints and a restrictive user foreign key.

## Verification

Run `npm run check`, `npm run test:api` and `npm run db:validate`. Database integration cases run only when `TEST_DATABASE_URL` points to a dedicated database ending in `_test`; CI applies migrations to disposable PostgreSQL. Never run synthetic registration fixtures against Neon. The suite cleans up its own generated users, audit events and rate keys.

Local verification on 2026-10-18: formatting, ESLint, API/web TypeScript checks, Prisma schema validation and `git diff --check` passed. API build/tests passed: 65 tests, with 21 database cases skipped locally because no disposable test database is configured. Native Argon2id hashing and verification passed on Windows/Node 24 with install scripts disabled. The install audit reported zero vulnerabilities. CI database verification and the task PR are pending. Login, verification delivery, session revocation and browser registration remain unimplemented.
