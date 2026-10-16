# DF-003: NestJS API foundation

## Run locally

From the repository root using the recorded Node/npm baseline:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run test:api
npm run start:api
```

`test:api` builds TypeScript before running Jest and Supertest. To build without tests, run `npm run build:api`. `start:api` runs the existing compiled output; rebuild after source edits. Stop the server with Ctrl+C. A development watch workflow can be added when needed.

Open `http://127.0.0.1:3001/api/v1/health`:

```json
{ "status": "ok", "service": "devflow-api" }
```

This public endpoint reports API liveness only. It does not claim database connectivity, dependency readiness, authentication, or production readiness. It returns no secrets or internal infrastructure details and has `Cache-Control: no-store`.

## Configuration

The process reads `PORT` (integer 1–65535, default 3001) and `HOST` (default 127.0.0.1) from the environment. Invalid ports fail startup. There is no automatic `.env` loader yet. For example in PowerShell:

```powershell
$env:PORT = '3101'
npm run start:api
```

Use `HOST=0.0.0.0` only when deliberately exposing the service to a container/network. Database and other environment validation are added with those features.

## How a request flows

1. `main.ts` reads the port, creates the app, enables shutdown hooks, and starts listening.
2. `app.ts` creates the Nest application and applies `/api/v1` to all routes. Tests use the same factory without starting the CLI entrypoint.
3. `AppModule` imports `HealthModule`, which registers its controller and service.
4. `HealthController` handles `GET /health` under the global prefix and controls the response cache header.
5. Nest injects `HealthService` into the controller. The service returns the typed liveness response.

A controller maps HTTP requests to behavior. A service owns the behavior. A module groups and wires them together. Nest's dependency injection constructs the service and supplies it to the controller; application code does not manually instantiate the service.

## Compiler and tests

Nest uses legacy decorators and emitted constructor metadata for dependency injection. The API config enables `experimentalDecorators` and `emitDecoratorMetadata`; `reflect-metadata` loads before the application module. The build config overrides the shared no-output setting and writes ignored JavaScript to `apps/api/dist`.

NestJS 12 is ESM, so the API package uses `type: module` and explicit `.js` extensions for local imports, resolved to TypeScript source during compilation. Jest tests are small ESM files against the compiled API, avoiding an extra TypeScript test transformer. The test command enables Node's experimental VM modules as required by [Jest's ESM setup](https://jestjs.io/docs/ecmascript-modules); its experimental warning is expected and only applies to the test runner. Supertest exercises the real Nest HTTP stack. Tests verify the versioned response, cache/content headers, unsupported route/method behavior, and valid/invalid port configuration. Jest runs sequentially for the 8 GB machine.

Pinned dependencies: Nest common/core/platform-express 12.1.3, reflect-metadata 0.2.2, RxJS 7.8.2, Jest 30.5.2, Supertest 7.3.1, Node types 24.19.2, and the existing TypeScript 7.0.2. Metadata was checked before installation; the build and HTTP integration tests establish compatibility for this limited API, not for future Prisma or Next.js integration.

## Test-tool dependency override

The initial audit found the `sprintf-js` denial-of-service advisory [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) through Istanbul's configuration loader, js-yaml 3, and argparse 1. A scoped root override selects js-yaml 4.3.2 only beneath `@istanbuljs/load-nyc-config`, removing that old chain. The loader uses the supported `load` API; verify YAML config loading and the test suite after this override. Reevaluate and remove it when upstream no longer needs it. Do not use automatic force fixes that downgrade Jest across major versions.

## Deferred work

Frontend, database, auth, readiness checks, DTO validation for future writes, rate limiting, structured operational logging, OpenAPI, and CI are not implemented by this foundation task. No production readiness claim is made.

## Verification record

- Both workspace type checks passed.
- Clean `npm ci --ignore-scripts --offline --no-audit` succeeded from the populated cache. npm still emits an upstream glob 10 deprecation warning; the security audit reports zero current advisories after the scoped fix.
- API build passed; Jest/Supertest passed 16 tests across 2 suites.
- The compiled `main.js` was started on a temporary loopback port, returned the expected health JSON over HTTP, and was stopped after verification.
- The scoped override successfully loaded a YAML fixture through Istanbul's actual config loader.
- npm dependency resolution and diff whitespace checks passed. After updating the affected resolution, npm audit reported zero vulnerabilities.
- Verification is local on Windows; CI and other operating systems have not yet been tested.
