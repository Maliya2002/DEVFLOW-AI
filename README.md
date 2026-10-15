# DevFlow AI

A planned remote software-team platform connecting project delivery, transparent work records, collaboration, GitHub workflows, and evidence-grounded insights.

**Status:** planning only. No application, database, or runnable development setup exists yet.

The first goal is a working job-portfolio release. A later company pilot requires separate operational and security verification before using real employee data.

## Project documents

- [Product scope and architecture](docs/PROJECT_PLAN.md)
- [Incremental task backlog](docs/BACKLOG.md)
- [Development and Git workflow](docs/WORKFLOW.md)
- [Initial environment inspection](docs/ENVIRONMENT.md)
- [Original product requirements](docs/MASTER_REQUIREMENTS.md)
- [Agent collaboration rules](AGENTS.md)

## Agreed technology direction

TypeScript, Next.js, Tailwind CSS, shadcn/ui, NestJS, PostgreSQL, and Prisma. Keep the frontend and backend in one repository, with separate application directories. Exact versions and compatibility remain to be verified during setup.

Development targets an 8 GB Windows computer and initially uses free services. Redis and background workers will be added when a feature needs them. Docker is not required for every local development session.

## First usable milestone

Sign in, join an organization, create and assign a project task, and update that task as an authorized developer. Every implemented workflow must persist data and enforce backend permissions.

## Working agreement

Obtain explicit user approval before each small development task. Explain changes step by step, run relevant checks, and make a focused local Git commit. Pushes, pull requests, and merges require an agreed remote workflow. See the development workflow for details.
