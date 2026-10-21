# Email verification: DF-011

## Provider boundary

The Resend adapter is connected to an opt-in verification request service.
Registration still does not send email automatically: the client must explicitly
request verification. Token endpoints are implemented; live delivery and the
frontend landing page remain disabled/pending.

`VerificationMailer` is a TypeScript interface: callers depend on the mail
operation rather than a specific provider. Tests inject a fake HTTP transport;
no live email is sent and no extra SDK dependency is installed.

The factory returns null when both mail settings are absent. Partial or unsafe
configuration fails. Future integration must supply `RESEND_API_KEY`,
`VERIFICATION_EMAIL_FROM` (a single sender address), and the existing validated
authentication configuration. Keep credentials only in the ignored API `.env`
or deployment secret store. Sender-domain verification and provider setup have
not been performed.

On 2026-10-20 the user confirmed that neither a Resend account nor an owned
domain is available. Continue backend development with an injected test transport;
live delivery remains disabled. No domain purchase is required for this milestone.

Messages use a fixed provider endpoint, the trusted `APP_ORIGIN`, a fixed
`/verify-email` path, and a token fragment. Caller-supplied redirects are rejected.
A public issuance UUID supplies the idempotency key; never use the raw token.
The adapter bounds requests to eight seconds, rejects redirects, does not retry,
and discards provider response bodies and raw errors. A resolved send means
provider acceptance, not confirmed inbox delivery. Timeout outcomes are uncertain;
future orchestration must handle them without exposing account eligibility.

The service enforces eligibility, quotas, a 24-hour token lifetime, and
database transactions. Delivery runs outside the transaction.
Do not activate delivery until the landing page is ready.

## Token endpoints (milestone B)

- POST /api/v1/auth/verification/request accepts only an email. Normalization
  precedes quota and lookup. Active unverified accounts receive a 32-byte random
  token; all eligible/ineligible addresses receive the same 202 body. Provider
  failure also returns that body after invalidating only the failed issuance.
- POST /api/v1/auth/verification/confirm accepts only a token. Invalid, expired,
  replayed, invalidated, or mismatched-account tokens receive the same 400 error.
  Success returns status verified and never issues a session cookie.
- Both require the exact trusted Origin, browser request header, JSON content
  type and existing body-size cap. GET cannot consume a token. Responses use
  Cache-Control: no-store; forwarded client-IP headers are ignored.
- Shared database quotas: 20 requests/IP/hour, 3 requests/email/hour and
  10 confirmations/IP/15 minutes. HMAC keys use a separate verification namespace.
  Rate limits return 429 with Retry-After; database outages return generic 503.
- EmailVerificationToken stores only a SHA-256 digest, fixed purpose, subject,
  email, expiry and consumption/invalidation timestamps. Constraints enforce the
  purpose, digest, lifetime and at most one pending token per user. This table
  cannot accept password-reset tokens; later purposes get their own boundary.
- Issuance/resend and confirmation lock the user row before rechecking current
  state. Conditional consumption, emailVerifiedAt and audit events commit in one
  transaction. Concurrent consumption has one winner. Resend invalidates old
  tokens. An old delivery failure cannot invalidate a newer resend.
- db:cleanup-auth additionally deletes bounded batches of tokens expired,
  consumed or invalidated. There is no automatic scheduler; operations must run
  enough bounded batches at least daily to meet the 24-hour removal policy.

EMAIL_VERIFICATION_ENABLED defaults to false. Enabling it requires the provider
settings and validated auth configuration; malformed activation fails startup.
Disabled request delivery returns 503 before account lookup. Confirm remains
available for previously issued tokens even when delivery is disabled.

## Remaining activation work and limitations

- Build the landing page that removes the fragment before posting, uses
  Referrer-Policy: no-referrer, and never logs or caches the link (DF-014).
- Configure a verified sender and explicitly test live delivery before activation.
- Delivery is synchronous and bounded; response bodies are equivalent but network
  timing is not guaranteed equivalent between eligible/ineligible addresses.
  Review asynchronous delivery and timing-enumeration protection before a public
  deployment. No durable outbox or automatic retries are implemented. A process
  exit after issuance can lose delivery; the user must resend. No raw tokens are
  persisted to support retries. These are activation gates, not production claims.

## Milestone A verification (provider adapter)

Local verification on 2026-10-20: `npm run check` passed (format, lint, API/web types).
`npm run test:api` passed 102 tests, including 20 adapter tests; 41 database
integration tests were skipped because a disposable test database was not
configured. Provider responses are mocked; no live delivery was tested.
That adapter-only milestone included no database or UI changes.

Provider contract checked against the official
[send-email API](https://resend.com/docs/api-reference/emails/send-email) and
[idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)
on 2026-10-20.

## Milestone B verification

Branch: codex/DF-011-verification-tokens, stacked on the provider adapter PR #11.
Scope: token persistence, request/confirm HTTP routes, quotas, audit and cleanup.
On 2026-10-22, npm run check passed; npm run test:api passed 118 tests with
63 disposable-database tests skipped locally. [CI run 39663350872](https://github.com/Maliya2002/DEVFLOW-AI/actions/runs/39663350872)
passed all 181 API tests, including 63 database tests, and 20 browser tests on
code commit 0e8e524. Prisma migrations/validation, formatting, lint, types,
frontend build and dependency audit also passed.

Development Neon migration 202610200001_email_verification was applied and
db:status confirmed all four migrations are current. Initial connection attempts
failed/timed out; read-only checks succeeded on retry before applying the migration.
No synthetic users were added to Neon, and no live email was sent.

Published as [PR #12](https://github.com/Maliya2002/DEVFLOW-AI/pull/12), unmerged.
Live delivery, its public-activation hardening, and the landing page remain pending.
