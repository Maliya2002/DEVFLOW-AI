# Password security: DF-012

## Milestone A: signed-in password change

POST /api/v1/auth/password/change accepts exactly currentPassword and newPassword.
It requires a valid own session, password authentication within the preceding five
minutes, the correct current password, and the same new-password policy used by
registration. Passwords are never trimmed or normalized; reusing the current value
is rejected. Existing browser Origin/header/JSON protections and the body-size cap
apply. Responses are no-store.

The service uses the existing login IP and account budgets, preventing password
guesses from bypassing limits by switching routes. Argon2 verification and hashing
run outside database transactions using the shared bounded hasher. After hashing,
the service locks the user and rechecks session validity, authentication freshness,
authVersion and passwordHash against the previously authorized snapshot.

One transaction updates the password, increments authVersion, revokes every own
session, and writes PASSWORD_CHANGED. Audit failure rolls all changes back. Other
users' sessions remain intact. Success returns 204 and clears the current cookie;
it never auto-logs in. A concurrent login using an old password snapshot cannot
issue a session after the version/hash change. A quota-refund failure after commit
does not turn success into an ambiguous error response.

Wrong credentials/invalid sessions use generic 401; stale reauthentication uses
403; invalid input uses 400; exhausted quotas use 429 with Retry-After; unavailable
persistence uses 503. The controller clears invalid session cookies on 401, as for
other session operations. A 503 does not claim success or clear the cookie.

## Remaining DF-012 milestone

Forgotten-password reset request/confirmation, purpose-bound 30-minute reset tokens,
resend invalidation, and a reset mail adapter are not implemented by this milestone.
When those tokens are introduced, password change must invalidate outstanding reset
tokens in the same transaction. Live delivery, notification emails and the frontend
security/password pages remain pending. No provider account or domain is configured.

## Acceptance and verification

Branch: codex/DF-012-password-change, stacked on PR #12. Routine implementation,
checks, commits and PR publication are authorized; merging remains separate.

Required checks: shared password policy, CSRF/cookie contract, wrong-password quota,
reauthentication expiry, own-session revocation, other-account isolation, audit
rollback, concurrent changes, and login/revocation races during hashing.

On 2026-10-22, npm run check passed (format, lint and API/web types).
Local API tests: 121 passed, 73 database tests skipped because no disposable
test database is configured locally. Database CI verification is pending.
No live email is sent by this flow.
