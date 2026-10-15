# DevFlow AI

A planned remote software-team platform connecting project delivery, transparent work records, collaboration, GitHub workflows, and evidence-grounded insights.

**Status:** TypeScript workspace foundation. Frontend and API directories are reserved; there is no running web application or database yet.

The first goal is a working job-portfolio release. A later company pilot requires separate operational and security verification before using real employee data.

## Project documents

- [Product scope and architecture](docs/PROJECT_PLAN.md)
- [Incremental task backlog](docs/BACKLOG.md)
- [Development and Git workflow](docs/WORKFLOW.md)
- [Initial environment inspection](docs/ENVIRONMENT.md)
- [Workspace setup and dependency decisions](docs/WORKSPACE.md)
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

The check currently validates the two workspace configurations and empty declaration modules, not application behavior. There are no dev servers, application tests, or production build commands yet. See the workspace guide for the file-by-file explanation.

Development targets an 8 GB Windows computer and initially uses free services. Redis and background workers will be added when a feature needs them. Docker is not required for every local development session.

## First usable milestone

Sign in, join an organization, create and assign a project task, and update that task as an authorized developer. Every implemented workflow must persist data and enforce backend permissions.

## Working agreement

Obtain explicit user approval before each small development task. Explain changes step by step, run relevant checks, and make a focused local Git commit. Pushes, pull requests, and merges require an agreed remote workflow. See the development workflow for details.
