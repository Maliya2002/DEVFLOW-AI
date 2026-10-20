# DevFlow AI

A planned remote software-team platform connecting project delivery, transparent work records, collaboration, GitHub workflows, and evidence-grounded insights.

**Status:** Next.js workspace explorer and NestJS liveness API. The frontend includes a responsive workbench, interactive capability map, and real service connection check. PostgreSQL identity/organization persistence and the registration backend are implemented. Sign-in/session lifecycle is implemented in the backend. Verification delivery, authentication UI, and business workflows remain planned.

The first goal is a working job-portfolio release. A later company pilot requires separate operational and security verification before using real employee data.

## Project documents

- [Product scope and architecture](docs/PROJECT_PLAN.md)
- [Incremental task backlog](docs/BACKLOG.md)
- [Development and Git workflow](docs/WORKFLOW.md)
- [Initial environment inspection](docs/ENVIRONMENT.md)
- [Workspace setup and dependency decisions](docs/WORKSPACE.md)
- [API setup and request-flow explanation](docs/API.md)
- [Frontend setup, interactions, and design](docs/FRONTEND.md)
- [Quality checks and CI](docs/QUALITY.md)
- [Neon database setup and Prisma](docs/DATABASE.md)
- [Authentication and session design](docs/AUTHENTICATION.md)
- [Organization permission matrix](docs/AUTHORIZATION.md)
- [Identity and organization persistence](docs/IDENTITY_PERSISTENCE.md)
- [Registration backend and verification](docs/REGISTRATION.md)
- [Sign-in and session lifecycle](docs/SESSIONS.md)
- [Original product requirements](docs/MASTER_REQUIREMENTS.md)
- [Agent collaboration rules](AGENTS.md)

## Agreed technology direction

TypeScript, Next.js, Tailwind CSS, shadcn/ui, NestJS, PostgreSQL, and Prisma. The frontend and backend share one npm workspace repository. TypeScript is pinned; application dependencies will be installed and verified in their owning tasks.

## Workspace setup

Use Node.js 24.18.0 and npm 11.18.0 for the recorded baseline. From the repository root:

```sh
npm ci --ignore-scripts
npm run typecheck
```

To build, test, and run the API:

```sh
npm run test:api
npm run start:api
```

The test command builds the API first. Visit `http://127.0.0.1:3001/api/v1/health` for its liveness response. To build without tests, use `npm run build:api`. See the API guide for configuration and limitations.

In a second terminal, start the frontend:

```sh
npm run dev:web
```

Open `http://127.0.0.1:3000`. The overview works without the API. The Connection page reports availability of the real API; it reports unavailable if the API is stopped. For a production-mode local preview, run `npm run build:web` followed by `npm run start:web`.

Browser tests require the compiled API and frontend plus a local supported browser. See the frontend guide for commands. CI runs checks on pull requests and pushes to main; no hosted deployment is configured.

## Quality commands

```sh
npm run format
npm run check
npm run verify
```

`format` rewrites supported source/config/document files. `check` verifies formatting, lint, and types without fixing files. `verify` adds API tests, a frontend production build, and browser tests; a Playwright browser must already be installed. See the quality guide for Windows Edge usage and the CI policy.

Development targets an 8 GB Windows computer and initially uses free services. Redis and background workers will be added when a feature needs them. Docker is not required for every local development session.

## First usable milestone

Sign in, join an organization, create and assign a project task, and update that task as an authorized developer. Every implemented workflow must persist data and enforce backend permissions.

## Working agreement

Following the user's updated instruction, progress autonomously through routine tasks, explain changes step by step, run relevant checks, and make focused commits and task PRs. Ask only for consequential decisions or required permissions. Keep PRs unmerged until merge authorization is established. See the development workflow for details.
