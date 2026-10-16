# DF-002: workspace foundation

This document records the DF-002 milestone. DF-003 subsequently adds the API, build, and tests; see [the API guide](API.md) for current backend commands. Statements about empty workspaces below describe DF-002, not the current API.

## Scope

Set up npm workspaces, a pinned TypeScript compiler, reproducible dependency resolution, shared compiler settings, and ignore rules. NestJS scaffolding is DF-003; Next.js scaffolding is DF-004. No running application is claimed here.

## Files and concepts

- `package.json`: marks the root private, declares `apps/*` workspaces, pins TypeScript, and runs both package checks sequentially to limit resource use.
- `package-lock.json`: records exact dependency resolution and integrity hashes. Commit it; use `npm ci` for repeatable installs.
- `.npmrc`: saves exact dependency versions and rejects unsupported engine ranges.
- `.nvmrc`: records the verified local Node version. It is a version-manager hint, not an automatic Windows installer.
- `tsconfig.base.json`: shared strict type checking, explicit indexed-access uncertainty, and no generated output. Framework-specific options remain in each application config.
- `apps/api`: reserved backend package with Node module resolution.
- `apps/web`: reserved frontend package with bundler resolution and browser types.
- Each `workspace.d.ts` is an empty declaration module to validate compiler configuration before application sources exist. Remove it during the corresponding scaffolding task.
- `.gitignore`: excludes dependencies, generated output, logs, local environment secrets, and scratch files while allowing environment example files.
- `.gitattributes`: gives new text files consistent LF endings; Windows command files use CRLF. Existing documents are not bulk-normalized in this task.

TypeScript checks JavaScript-like source against declared types before execution. It does not replace backend input validation. npm workspaces let related packages share one lockfile and compiler installation without requiring a separate monorepo build service.

## Versions and compatibility evidence

Public npm registry metadata was inspected on 2026-10-15 with `npm view`. Versions are observations on that date, not permanent recommendations.

| Component   | Observation / decision                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js     | Installed 24.18.0; baseline pinned in `.nvmrc`, supported range restricted to Node 24 from that patch                                                              |
| npm         | Installed 11.18.0; recorded in `packageManager`, supported range 11.18.0 to below 12                                                                               |
| TypeScript  | Stable metadata version 7.0.2; requires Node >=16.20.0; pinned and installed in this task                                                                          |
| Next.js     | Candidate 16.4.1 requires Node >=20.9.0; React peers include ^19.0.0; not installed yet                                                                            |
| NestJS core | Candidate 12.1.3 requires Node >=20; peers require compatible NestJS 12 packages, RxJS ^7.1.0 and reflect-metadata; not installed yet                              |
| Prisma      | `latest` resolved to prerelease 8.0.0-rc.23 and was not selected. Stable 7.10.0 metadata supports Node ^20.19, ^22.12 or >=24.0; defer selection to database setup |

The installed Node satisfies these observed engine constraints. This establishes runtime eligibility, not full integration compatibility. Verify TypeScript/framework compiler APIs, peers, builds, and tests when installing each framework; adjust the compiler pin if those tests reveal incompatibility. No framework dependency set is locked by this task.

Sources: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [NestJS first steps](https://docs.nestjs.com/first-steps), and npm registry metadata for the named package versions.

## Commands

```sh
npm ci --ignore-scripts
npm run typecheck
npm ls --workspaces --depth=0
```

`--ignore-scripts` is sufficient for the current compiler-only dependency set and prevents lifecycle scripts during this bootstrap. Reevaluate this choice when adding framework or database packages that need explicit build/generation steps.

There are no feature tests, lint setup, CI workflows, or production builds yet. These checks must not be reported as passing until their owning tasks add and run them.

## Verification results

- `npm install --ignore-scripts`: succeeded; npm reported zero vulnerabilities for this small dependency set.
- `npm ci --ignore-scripts --offline --no-audit`: succeeded from the populated local cache, verifying the lockfile installation path.
- `npm run typecheck`: passed for both reserved workspaces, including after the clean install.
- `npm ls --workspaces --depth=0`: resolved both workspace packages.
- `git check-ignore`: confirmed dependencies, nested environment files, and build output are excluded; environment examples remain trackable.
- `git diff --check`: passed.

Registry operations initially failed inside the network-restricted sandbox and succeeded after approved escalation. Cross-platform execution and framework integration are not yet tested.
