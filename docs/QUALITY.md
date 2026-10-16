# DF-005: quality checks and continuous integration

## Local workflow

Use the repository's Node/npm versions and run `npm ci --ignore-scripts` first.

| Command                | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `npm run format`       | Apply consistent formatting to supported source, configuration, and documentation files |
| `npm run format:check` | Fail when tracked project content needs formatting                                      |
| `npm run lint`         | Run ESLint with zero allowed warnings                                                   |
| `npm run check`        | Formatting check, lint, and both workspace type checks                                  |
| `npm run verify`       | All checks, compiled API tests, production frontend build, and browser tests            |

`verify` needs a supported browser already installed. On the current Windows machine:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run verify
```

Other environments can provision Chromium with `npm exec --workspace @devflow/web -- playwright install chromium`. Browser/system dependency installation is explicit; it does not run as an npm lifecycle script. Verification starts and stops its own API/web servers on 3101/3100. Keep those ports free.

## What each check catches

Prettier standardizes indentation, wrapping, quotes, and line endings. The formatter does not change the original user-supplied master requirements, framework-managed agent rules, generated output, lockfile, local secrets, or scratch files. `.editorconfig` aligns editor behavior across platforms.

ESLint applies recommended JavaScript and TypeScript checks to the repository. React Hooks rules are scoped to the frontend. API tests receive Jest globals. Prettier's compatibility config disables conflicting stylistic lint rules, not correctness checks. This is static linting rather than a substitute for type checking or tests.

Both workspaces run the actual TypeScript compiler. The frontend generates Next route types first. Playwright rejects accidental `test.only` in CI and runs with one worker to keep resource use predictable.

## Compatibility decision

TypeScript was changed from 7.0.2 to **6.0.3** because typescript-eslint 8.71.2 declares support for TypeScript `>=4.8.4 <6.1.0`. TypeScript 7 compiled the previous application but falls outside this lint tool's supported peer range. No force or legacy-peer-deps install flags are used.

ESLint 10.12.0, @eslint/js 10.0.1, and eslint-plugin-react-hooks 7.1.1 use compatible peer ranges. The Next lint bundle is omitted because its dependency chain introduced an unpatched high-severity braces advisory during setup, while its React plugin did not support ESLint 10. Consequently Next-specific Core Web Vitals lint rules are not enabled; production builds and browser tests remain separate checks. Reassess the bundle when compatible patched dependencies are available. Prettier is pinned to 3.9.10, with eslint-config-prettier 10.1.8 and globals 17.13.0. Older milestone documents record the versions used at those milestones; the current package manifests and lockfile are authoritative.

## GitHub Actions

`.github/workflows/ci.yml` runs on all pull requests (including the dependent task PRs), pushes to main, and manual dispatch once the workflow is available on the default branch. One Ubuntu job performs:

1. Read-only checkout and setup of Node from `.nvmrc`, plus npm 11.18.0.
2. Clean locked dependency installation, with lifecycle scripts disabled.
3. Formatting, lint, and type checks.
4. API build/tests and frontend production build.
5. Dependency audit across production and development packages; high/critical advisories fail CI. Lower-severity findings remain visible for triage.
6. Explicit Chromium and Linux browser dependency installation, then desktop/mobile Playwright checks.
7. Upload browser failure diagnostics if available, retained for three days.

Actions are pinned to immutable commit SHAs resolved from the official checkout v7, setup-node v7, and upload-artifact v6 tags. The token has only `contents: read`, checkout does not persist credentials, and no application secrets are required. New runs cancel obsolete work for the same branch; each run has a 15-minute timeout. No automatic deployment, merge, billing changes, or branch-protection settings are configured.

A failed run can be diagnosed from the failing step's logs and its browser artifact. Use `npm run check` first for a local formatting/lint/type failure, then the specific failing test or build. Do not bypass checks to make a badge green.

The workflow defines checks; it does not by itself enforce a merge gate. Required branch-protection checks can be configured separately once a merge policy is agreed. Repository/account Actions availability and free usage limits still apply.

References: [Next ESLint guidance](https://nextjs.org/docs/app/api-reference/config/eslint), [Playwright CI setup](https://playwright.dev/docs/ci-intro), [setup-node](https://github.com/actions/setup-node), and [checkout](https://github.com/actions/checkout).

## Verification record

On 2026-10-15, a clean `npm ci --ignore-scripts` completed with zero reported vulnerabilities. `npm run verify` passed formatting, zero-warning lint, both TypeScript checks, 16 API tests, the production frontend build, and 20 desktop/mobile browser tests using installed Windows Edge. GitHub-hosted Chromium verification is recorded by the PR check; local success does not imply hosted CI success.

GitHub Actions run 38768953546 for PR #5 also passed on Ubuntu with Chromium, including all quality checks, API tests, production build, dependency audit, and desktop/mobile browser tests. Confirmed on 2026-10-16 (Asia/Colombo).
