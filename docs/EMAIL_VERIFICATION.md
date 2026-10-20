# Email verification: DF-011

## Milestone A: provider boundary

The Resend adapter is implemented as an isolated, opt-in factory. It is not
connected to registration or exposed through an HTTP endpoint yet. Existing
registration does not send email. DF-011 remains in progress.

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

The caller must enforce eligibility, quotas, a 24-hour token lifetime, and
database transactions. Never hold a database transaction open during delivery.
Do not connect or activate this factory until the verification flow and landing
page are ready.

## Remaining milestones

- Persist hashed, purpose-bound, email-bound one-time tokens; add expiry,
  resend invalidation, atomic consumption, and retention cleanup.
- Add generic request/confirm endpoints, shared database rate limits, audit
  events, and concurrency tests.
- Connect a landing page that removes the fragment before posting, uses
  `Referrer-Policy: no-referrer`, and never logs or caches the link.
- Configure a verified sender and explicitly test delivery before enabling it.

## Verification

Local verification on 2026-10-20: `npm run check` passed (format, lint, API/web types).
`npm run test:api` passed 102 tests, including 20 adapter tests; 41 database
integration tests were skipped because a disposable test database was not
configured. Provider responses are mocked; no live delivery was tested.
No database schema changes or UI changes are included.

Provider contract checked against the official
[send-email API](https://resend.com/docs/api-reference/emails/send-email) and
[idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)
on 2026-10-20.
