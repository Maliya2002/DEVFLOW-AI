# DF-006: Neon PostgreSQL foundation

## Scope and design

The selected hosted database is Neon PostgreSQL. The API owns database access through Prisma; the browser never receives database credentials. Local PostgreSQL or Docker is not required on the 8 GB development machine. A free account is the initial target, not a promise of unlimited production capacity. No domain tables or migrations are introduced before the organization and permission design in DF-007/DF-008.

The Prisma CLI, runtime, and PostgreSQL adapter are pinned to 7.10.1. The CLI's latest tag resolved to an 8.0 release candidate during setup, so the matching stable release was selected. The ESM client is generated under `apps/api/src/generated/prisma`, excluded from Git/lint/formatting, and compiled with the API. Generation runs explicitly before API build and type checks because installs disable lifecycle scripts.

## Connect a development database

1. Create/select a dedicated development project on Neon's Free plan. Choose a region near the eventual API host; do not enable paid services automatically.
2. Copy `apps/api/.env.example` to `apps/api/.env`.
3. In Neon's Connect dialog, copy the pooled URL into `DATABASE_URL` and the direct URL into `DIRECT_URL`. Keep both in the ignored file; never paste credentials into chat, commits, or the frontend environment.
4. Use verified TLS (`sslmode=verify-full`). Runtime validation upgrades Neon's `sslmode=require` to `verify-full`. Percent-encode special characters if constructing a URL manually.
5. Run `npm run db:validate`, then `npm run db:check`. The latter performs only `SELECT 1`, closes the pool, and prints a generic success/failure message.
6. Start the API with `npm run start:api` after building. The start command loads `apps/api/.env`; existing shell environment variables take precedence.

No Neon project or credential connection is implied by having the code installed. Cloud verification is a separate result from the CI database test.

## Runtime behavior

`GET /api/v1/health` is process liveness and stays available without a database. `GET /api/v1/health/ready` runs a read-only database probe and returns `200 { status: "ready", service: "devflow-api" }` or generic `503 { status: "unavailable", service: "devflow-api" }`. Both disable response caching. The existing frontend Connection screen still checks API liveness; it does not claim database readiness.

A missing `DATABASE_URL` is permitted only for this foundation preview: readiness is unavailable. A configured but malformed or insecure remote URL fails initialization. Database-dependent domain features must require configuration when introduced. Query errors and connection strings are never returned to callers. The shared Prisma client uses at most three connections, a five-second connection/statement timeout, a six-second client query timeout, and ten-second idle eviction. Nest shutdown hooks disconnect the pool.

Remote URL validation rejects unknown query options to prevent SSL overrides; supported options are `sslmode` and `channel_binding`. Local loopback PostgreSQL permits explicit disabled TLS for disposable CI infrastructure.

## Schema and migrations

`apps/api/prisma/schema.prisma` currently declares the generator and PostgreSQL datasource only. `apps/api/prisma.config.ts` points migration tooling to `DIRECT_URL`; generation and validation do not require live credentials. No migration has been created or applied. Future schema changes must include reviewed SQL migrations committed alongside the Prisma schema. Do not use `db push` or `migrate reset` against shared databases. Use an isolated development/shadow database for migration development and reviewed deployment migrations for shared environments.

## Verification

Unit tests cover malformed URLs, credential redaction, remote TLS enforcement, missing configuration, probe success/failure, and pool cleanup. `TEST_DATABASE_URL` enables a real Prisma/PostgreSQL integration probe; without it, that test is explicitly skipped. CI supplies a disposable PostgreSQL 17 service with test-only credentials and runs the real adapter test. CI never connects to Neon or needs cloud secrets.

Commands from the repository root:

```sh
npm run db:generate
npm run db:validate
npm run test:api
npm run db:check
```

The first three commands work without Neon credentials (the optional live integration test skips locally). `db:check` requires a real configured database and fails rather than reporting success when absent.

References: [Prisma client generator](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators), [Prisma config](https://docs.prisma.io/docs/orm/v7/reference/prisma-config-reference), [Neon plans](https://neon.com/pricing).

Local verification on 2026-10-16: dependency installation reported zero vulnerabilities; Prisma generation/schema validation, formatting, lint, and both workspace type checks passed. API tests passed 35 tests; the one live PostgreSQL test was explicitly skipped because TEST_DATABASE_URL was absent. Neon connectivity remains pending account/project configuration.

GitHub Actions run 38855743478 passed for implementation commit a92178a: the real PostgreSQL integration test, API suite, frontend production build, dependency audit, and desktop/mobile Chromium suite all succeeded. This validates PostgreSQL integration, not a Neon cloud connection.

## Neon connection verification: 2026-10-17

The user-created development project `devflow-ai-dev` in Singapore was connected using its existing default branch. Corrected the locally pasted URL into the DATABASE_URL assignment in the ignored API environment file. Both the pooled runtime endpoint and corresponding direct endpoint passed read-only SELECT 1 probes with verified TLS. A temporary Nest API server returned HTTP 200 for liveness and database readiness, with Cache-Control: no-store, then shut down cleanly. No domain tables or migrations were created. Credentials remain exclusively in the ignored local environment file. This completes the previously pending cloud connection step; earlier pending statements above describe the historical verification state.
