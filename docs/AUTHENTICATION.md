# DF-007: authentication and session design

Status: implementation contract, 2026-10-17. This milestone adds documentation only. DF-009 implements the registration backend; see [registration](REGISTRATION.md) for current behavior and limitations. DF-010 implements [sessions](SESSIONS.md); email delivery remains planned, and the current overview remains a public foundation preview. Read alongside [authorization](AUTHORIZATION.md) and [database setup](DATABASE.md).

## Decision and boundaries

Use a small server-managed opaque session implementation in NestJS backed by PostgreSQL. This follows the original requirement's session-based option and keeps immediate revocation in the existing backend without introducing another identity provider or Redis service. Use Node cryptographic primitives for randomness/digests and a maintained Argon2id implementation for password hashing; do not design encryption or password algorithms. Pin and verify the hashing package's Node 24/Windows compatibility in DF-009 before installation. The additional implementation/review responsibility is explicit: no company pilot until the security acceptance cases below pass and deployment controls are reviewed.

Alternatives: a managed identity provider can reduce credential-management work but adds provider lifecycle/configuration decisions. A maintained all-in-one auth library can supply flows, but its session storage and adapter behavior must fit our hashed-token and revocation contract. Neither is ruled out permanently; a switch needs a replacement decision record and equivalent tests. JWT access/refresh tokens offer no required advantage for this browser-first application and complicate immediate revocation. OAuth and MFA are deferred features; privileged MFA is a company-pilot gate to resolve, not an implemented capability.

## Browser and deployment topology

Use one browser origin. Next serves pages; an explicit allowlisted `/api/v1/*` gateway forwards supported routes to the configured Nest upstream. The gateway must preserve method, status, request body, separate Set-Cookie headers and no-store headers, with bounded bodies/timeouts. Never forward a client-selected URL, arbitrary Cookie/Authorization headers, or untrusted forwarded-host headers. Forward only DevFlow's session cookie and required request headers. The existing `/api/connection` probe is not an authentication gateway.

Local browser origin is `http://127.0.0.1:3000`; Nest remains on loopback 3001. Production requires an explicit HTTPS `APP_ORIGIN` and a fixed private/server-to-server API origin. Cookie origin comes from trusted configuration, never a request Host header. No browser credentialed cross-origin API deployment is assumed. If hosting requires different public origins, revisit cookie/CSRF design before deployment rather than relaxing it ad hoc. Direct API access still enforces session, origin and permission checks.

| Setting                          | Local development              | Production                                        |
| -------------------------------- | ------------------------------ | ------------------------------------------------- |
| Session cookie                   | `devflow_session`              | `__Host-devflow_session`                          |
| Flags                            | HttpOnly; SameSite=Lax; Path=/ | Secure; HttpOnly; SameSite=Lax; Path=/; no Domain |
| Persistence                      | No Max-Age unless Remember me  | Same rule; Max-Age cannot exceed server expiry    |
| Session/token storage in browser | Cookie only                    | Cookie only                                       |
| Auth/private responses           | Cache-Control: no-store        | Cache-Control: no-store                           |

For every POST/PATCH/PUT/DELETE, including registration, login, resend, reset and logout: require JSON (except explicitly reviewed future upload routes), exact configured Origin, and `X-DevFlow-Request: browser`. Reject missing/null/foreign Origin and, when supplied, cross-site Sec-Fetch-Site. Disable CORS access for other origins; do not reflect Origin or allow wildcard credentialed requests. A cross-site form cannot supply the required custom header, and cross-origin JavaScript must not pass preflight. These combined controls are the selected CSRF defense, including login CSRF; SameSite alone is insufficient. They do not replace authorization or protect against same-origin XSS. Future non-browser clients need a separately specified authentication contract. State-changing GET endpoints are forbidden. A narrowly routed authenticated webhook is a separate signature-verified flow, never a global CSRF bypass.

## Identity and credentials

A global User may hold memberships in multiple organizations; signing up does not join any company. Store a unique normalized email, display name, status, emailVerifiedAt, passwordHash and authVersion. For the initial email policy, trim surrounding email whitespace and lowercase the entire address; document this deliberate case-insensitive account convention, validate format/length, and never apply provider-specific dot/plus rewriting. Preserve a display email if needed. Passwords are not trimmed, normalized, logged or silently truncated.

Initial password policy: 15�128 Unicode code points, permit spaces/Unicode and password managers, reject a maintained local compromised/common-password list, no arbitrary composition rules or periodic forced changes. Bound the JSON payload before hashing. Use Argon2id with a unique random salt, initially 19 MiB memory, 2 iterations and parallelism 1; benchmark on target hardware and increase the cost within measured capacity. Store the encoded hash/parameters, rehash after successful login when policy changes, and use the library's verifier. Cap concurrent hash work to two per API process with a bounded queue; overload returns 429/503 without unbounded memory growth.

Unknown-email login uses a fixed valid dummy hash with the same parameters. Wrong password, disabled user and nonexistent user return the same 401 code/message without account-specific details. Registration, reset-request and verification-resend return the same 202 response for eligible/ineligible addresses; delivery runs through an adapter without leaking account status or tokens. Avoid claims of identical network timing; test response equivalence and remove obvious early-return paths.

## Session contract

Generate a fresh 32-byte random base64url token after successful authentication; store only its SHA-256 digest, never the bearer value. Session fields: id, userId, tokenDigest (unique), authVersionAtIssue, createdAt, lastSeenAt, idleExpiresAt, absoluteExpiresAt, reauthenticatedAt and revokedAt. Initial sessions last at most 12 hours with 30-minute inactivity; Remember me explicitly selects 7-day absolute and 12-hour idle limits. These are product defaults, not security-standard mandates. Enforce time on the server; browser-close behavior is not a revocation guarantee. Activity can extend idle expiry only up to absolute expiry. Update lastSeen/idle timestamps at most once per minute, with a documented one-minute boundary tolerance and tests.

Every protected request checks digest lookup, expiry/revocation, user active status, and current authVersion. Then load live organization/resource grants; never embed authoritative roles in the cookie or cache them across revocation. Database failures deny protected requests with generic 503 and do not fall back to trusting cookies. Expired/invalid sessions return 401 and clear the cookie.

Rotate by issuing a new token and revoking the old session atomically on login and password reauthentication; concurrent requests using an old token may receive 401 and must not revive it. Reauthentication is valid for five minutes for password/email changes, session-wide revocation, ownership/admin grants, security policy and future integration-secret changes. Account password reset/change increments authVersion and revokes every session in the same transaction; require a fresh login afterward. A global account suspension revokes all sessions. Removing/suspending one organization membership denies only that organization's access on the next authorization check, preserving unrelated memberships. Role changes take effect immediately via live checks and revoke the affected user's sessions as an additional conservative measure.

Logout revokes the current session before clearing its cookie; repeated logout with no session returns 204 after CSRF validation. If persistence fails, return 503 rather than claim revocation. Logout-all increments authVersion and revokes all sessions atomically. Concurrent session issuance/password changes must serialize on the user row so issuance cannot slip past revocation. Limit active sessions to five; creating a sixth revokes the oldest atomically. Users may list and revoke their own sessions using public session IDs, never bearer tokens. No administrator impersonation or ability to read session tokens.

## Verification, recovery and invitations

Use separate purposes for 32-byte random email-verification, password-reset and invitation tokens. Store their SHA-256 digests, purpose, subject/email, expiresAt, consumedAt and creator/organization where relevant. Verification expires after 24 hours, reset after 30 minutes, invitations after 72 hours. These are configurable initial defaults. Consume using a conditional write in the same transaction as the effect; concurrent reuse has exactly one winner. Resending invalidates earlier tokens of the same purpose. Password resets revoke outstanding reset tokens and every session. Verification alone never creates an authenticated session.

Email links use an allowlisted APP_ORIGIN, never client Host or arbitrary redirect URLs. Put the token in a URL fragment for the web landing page; read it into memory and remove it with history.replaceState immediately, then submit by POST. Landing pages have Referrer-Policy: no-referrer, no analytics/third-party resources, no token logging and no service-worker caching. GET/link prefetch does not consume tokens. Invalid/expired/consumed tokens share one generic error; UI can request a fresh link.

Unverified users may log in only to a restricted account shell with verification resend, own session/logout and security actions. They cannot create/join organizations or access member data. A verified signed-in user creates an organization and owner membership atomically. Joining an existing organization requires an unexpired invitation whose normalized email matches the verified signed-in identity; never join by email domain alone. At acceptance re-check organization status, inviter's current grant authority, target role, and existing membership; unique constraints and transaction consumption make replay safe. Invitation role cannot be elevated by the recipient. No first-user-of-the-system super-admin shortcut.

Actual email delivery, credentialed provider choice and domain verification are separate DF-011/012 work. A test email adapter is test-only and must not log live links or be presented as delivery. Email changes require recent reauthentication and verification of the new address, retain the old identity until confirmation, notify the old address, and revoke sessions on completion; implement this with profile/account settings later.

## Planned API contracts

All routes below are under `/api/v1`; none are implemented by DF-007. All mutations use the CSRF controls above, validate DTOs with unknown fields rejected, and return stable public error codes without internal stack traces.

| Route                                                            | Access / behavior                                                         | Owner task |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| POST /auth/register                                              | Public; generic 202, pending verification                                 | DF-009/011 |
| POST /auth/login                                                 | Public; 200 with limited identity and session cookie, generic 401 failure | DF-010     |
| GET /auth/session                                                | Authenticated; own identity, verification state, allowed memberships      | DF-010     |
| POST /auth/reauthenticate                                        | Current session + password; rotate session                                | DF-010     |
| POST /auth/logout                                                | Idempotent 204; revoke current session                                    | DF-010     |
| POST /auth/logout-all                                            | Session + recent reauthentication; revoke all                             | DF-010     |
| GET /auth/sessions; DELETE /auth/sessions/:id                    | Own session list/revoke; cannot address another user's session            | DF-010     |
| POST /auth/verification/request; POST /auth/verification/confirm | Generic resend; one-time token confirmation                               | DF-011     |
| POST /auth/password/reset-request; POST /auth/password/reset     | Generic request; token + new password, no auto-login                      | DF-012     |
| POST /auth/password/change                                       | Session + recent reauthentication + current/new password                  | DF-012     |
| POST /organizations; POST /organizations/:id/invitations         | Verified user; creation or grant authority                                | DF-013     |
| POST /invitations/accept                                         | Verified session + matching one-time invite                               | DF-013     |

Return 401 for absent/invalid authentication, 403 for an authenticated actor's prohibited known action, and 404 for nonexistent or unauthorized organization-scoped resources. A user with no memberships sees onboarding, not fabricated company data. Multi-membership users choose a workspace; the choice in a URL is not proof of access. Redirect targets must be local allowlisted paths. Logout clears query caches and private component state; protected pages revalidate on navigation/pageshow, use no-store and never persist private data in localStorage. Browser-history tests must verify that back navigation cannot retrieve protected data after logout.

## Abuse protection, audit and operations

Initial rate limits: login 5 failed attempts per normalized-email key per 15 minutes and 30 attempts per IP per 15 minutes; register/reset/resend 3 per email per hour and 20 per IP per hour; token confirmation 10 attempts per IP per 15 minutes. Hash email rate keys using a server-side keyed digest. Use PostgreSQL atomic counters initially so limits survive restarts/multiple instances; add expiry cleanup. Do not hold DB transactions while hashing passwords or delivering email. Successful login may reset its account failure counter but not IP limits. Return generic 429 with Retry-After. Avoid indefinite lockouts that let attackers disable another user's account. Trust forwarded client IP only from explicitly configured proxies; benchmark and adjust limits for shared-office networks before a pilot.

Audit login/logout, resets, token consumption, revocation, invitation acceptance, membership/role changes and denied sensitive actions. Include actor/organization IDs where known, action, target ID, outcome, time and correlation ID; never passwords, cookies, token digests, raw URLs, reset links, request bodies or private leave/reflection content. Security metadata is for account protection, not attendance or productivity. Initial portfolio retention: 30 days for security events/minimized client metadata, purge expired/consumed auth tokens within 24 hours and revoked/expired sessions within 7 days. Organization audit retention and company-pilot privacy policy require a separate decision; no real employee-data pilot before that decision and cleanup verification. Security-critical write + audit records commit together. Restrict application-role audit mutation; backups/restoration remain a pilot gate.

## Implementation acceptance

DF-008 must establish user/organization/membership constraints and isolation before routes trust them. DF-009 tests duplicate-email races, normalization, hash verification and generic responses. DF-010 tests fixation/rotation, idle/absolute expiry with an injected clock, all-session revocation and concurrent issuance, disabled users, CSRF/CORS, cookie flags and database-outage denial. DF-011/012 test expired/wrong-purpose/replayed tokens, concurrent consumption, no auto-login, reset revocation, delivery failure and generic messages. DF-013 tests atomic onboarding/invitation acceptance, verified-email matching and inviter authority changes. DF-014/015 test browser logout/back behavior, workspace switching, direct API denial and every permission matrix boundary. Deployment tests must use HTTPS for production cookie assertions.

## Reference basis

These documents inform the mechanisms; exact product TTLs, limits and role policy above are DevFlow decisions: [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## DF-007 verification

Reviewed against the original role/authentication/privacy requirements and cross-checked the two design documents. Local documentation links, Prettier formatting and git diff whitespace checks passed. No runtime code, dependencies, credentials, database schema or data changed; application tests were not rerun for this documentation-only task. Implementation security tests above remain future acceptance criteria.
