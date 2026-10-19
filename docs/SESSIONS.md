# DF-010: sign-in and session lifecycle

## Scope and acceptance

Implement the agreed login, own-session lookup/list/revocation, password reauthentication, logout and logout-all backend. Verify cookie transport, generic credential failures, CSRF, bounded password work, live user/membership checks, expiration with an injected clock, concurrent issuance/revocation, audit rollback and database outage denial. This follows standing authorization for incremental implementation, tests, development migrations, commits and task PRs. No authentication UI, email delivery, production deployment or real employee records are included.

## Routes

All routes use `/api/v1/auth`, return `Cache-Control: no-store`, and accept only the session cookie for authentication. Mutations require the configured exact Origin, `X-DevFlow-Request: browser`, JSON and acceptable Fetch Metadata, with the shared 8 KiB body cap. Unknown JSON fields are rejected. CORS access is not enabled.

| Method | Route             | Body / result                                                                         |
| ------ | ----------------- | ------------------------------------------------------------------------------------- |
| POST   | `/login`          | `{email,password,rememberMe?}`; 200 limited identity and cookie                       |
| GET    | `/session`        | Own identity, verification state and current active memberships                       |
| GET    | `/sessions`       | Own active public session IDs/timestamps; no token digests                            |
| POST   | `/reauthenticate` | `{password}`; rotate current token, preserve original absolute deadline               |
| POST   | `/logout`         | `{}`; revoke current session then clear cookie; idempotent 204                        |
| POST   | `/logout-all`     | `{}`; recent password authentication required; revoke all, increment authVersion, 204 |
| DELETE | `/sessions/:id`   | `{}`; revoke own session, 204; other user's ID returns 404                            |

Wrong password, absent user and disabled user share `401 Authentication failed.` Unknown users still run the library verifier against a fixed valid Argon2id dummy hash. Password input is not trimmed; login accepts existing credentials without applying the registration blocklist again. Stored hashes below the selected policy are rehashed after successful verification. Hash and verify share two workers with eight queued operations per process. No claim of identical network timing is made.

Unverified accounts can use their own identity/security routes, but receive an empty membership list. Organization onboarding and resource permission enforcement remain in their owning milestones; the existing organization repository also requires verification. Membership roles and organization status are read live, never copied into the bearer cookie. There are no account-suspension or role-mutation API routes yet; their future implementations must serialize on the user row, increment authVersion and revoke sessions as specified by the authentication design. Existing sessions already deny inactive users and version mismatches immediately.

## Tokens, deadlines and concurrency

Each successful login creates a new 32-byte cryptographic random base64url token. Only its SHA-256 digest is stored. Cookie flags are HttpOnly, SameSite=Lax and Path=/, with no Domain. HTTPS origins use Secure and the `__Host-devflow_session` name; loopback HTTP uses `devflow_session`. Normal cookies omit Max-Age; Remember me sets it no longer than the remaining absolute session lifetime. Invalid/expired authentication clears the matching cookie. Database failures return generic 503 without claiming logout or clearing an unrevoked cookie.

Normal sessions have a 12-hour absolute deadline and 30-minute idle deadline. Remember me uses seven days and 12 hours respectively. Server checks occur on every protected request. Activity touches lastSeen/idle at most once per minute; the effective idle lifetime may therefore be up to one minute shorter than time since the most recent request. Renewal never exceeds the absolute deadline. Password reauthentication rotates the token without extending that deadline. Recent authentication lasts five minutes; the exact five-minute boundary requires a fresh password. Browser close is not a revocation guarantee.

Session operations lock the owning User row before checking or modifying sessions. Login hashes outside the transaction, then rechecks status, passwordHash and authVersion under that lock. A concurrent logout-all therefore prevents a login already verifying an old snapshot from issuing a valid session afterward. A newly started login after logout-all is allowed after password verification. Reauthentication consumes its old valid session once; concurrent reuse has only one winner. Failed transactional audits roll back issuance/revocation. At most five active sessions are retained; issuing another revokes the oldest under the same lock. Supplying a session cookie for a different account requires logout before switching accounts.

`AUTH_CLOCK` is injected into the Nest service so expiry boundary tests can advance time without waiting. Production uses the system clock; keep hosts time-synchronized. Rate limits use the database clock independently.

## Limits and audit retention

Login and reauthentication share PostgreSQL HMAC-keyed budgets: 30 IP attempts and five account failures/in-flight reservations per 15-minute window. The window begins on first use. Reserve before hashing to bound simultaneous attempts; successful verification refunds its own account reservation only, preserving other failures and later windows. IP quotas are never refunded. Rejected excess attempts saturate the bucket and may conservatively consume budget until expiry. Limits work across instances using the same secret. Forwarded IP headers remain untrusted; implement trusted proxy propagation before a multi-user gateway deployment.

Audit records contain action, known user ID (nullable for unknown credential failures), public target session ID where applicable, timestamp and a generated correlation UUID. No passwords, tokens, digests, raw IPs or browser metadata are added. Security writes and their audit rows commit together. Unknown-user failures are deliberately recorded without the submitted email.

Run explicit bounded maintenance from the root:

```sh
npm run db:cleanup-auth --workspace @devflow/api
```

Each invocation deletes at most 500 sessions revoked/expired more than seven days ago, 500 audit events older than 30 days, and 500 expired rate buckets. It never runs at startup. Operators must schedule repeated bounded invocations often enough to meet retention targets before a company pilot; no scheduler is provisioned by this task. The initial portfolio retention policy is from DF-007; company policy, audit database-role restrictions, backups, HTTPS deployment and browser end-to-end authentication remain pilot gates.

## Verification and next step

Local checks and disposable PostgreSQL CI results are recorded after completion. Integration tests use only `TEST_DATABASE_URL` databases ending in `_test` and delete their own synthetic fixtures. Never seed test credentials into Neon. The migration `202610180002_sessions` is additive for sessions, expands audit metadata/actions, and permits zero-valued refunded rate buckets. Its identifier reflects when implementation started; verification may occur on a later date.

Next: DF-011 verification tokens and an email-provider adapter. Frontend sign-in/account pages and the same-origin gateway remain DF-014; the current public workspace preview does not become a protected application in this task.
