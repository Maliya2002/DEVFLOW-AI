# Product and architecture plan

## Purpose

Build a demonstrable portfolio product that can evolve into a company pilot. Remote engineering teams should coordinate delivery and availability without hidden surveillance or misleading productivity rankings.

## Users and access

Organization owner, administrator, HR/operations, project manager, team lead, developer/employee, and restricted stakeholder. Roles are scoped to organizations, teams, and projects as appropriate. A role alone must not grant access to unrelated organizations or private employee records.

## Release boundaries

1. **Core milestone:** sessions, organizations, membership permissions, projects, task assignment and updates.
2. **Portfolio release:** extend the core with sprints, transparent attendance and worklogs, leave, async collaboration, GitHub data, deterministic risks, dashboards, wellbeing preferences, and a read-only AI analyst. Include synthetic demo data, tests, CI, documentation, and deployment where free infrastructure permits.
3. **Company pilot gate:** review access isolation, retention/deletion, backup restoration, monitoring, capacity, incident handling, and actual hosting limitations before processing real employee data. Portfolio completion alone does not establish production readiness.

The original requirements remain the long-term scope. Implement them incrementally under the user's updated authorization for routine progress, with focused tasks and meaningful milestone reports.

## Architecture direction

- One repository: `apps/web` for Next.js, `apps/api` for NestJS, and `docs` for decisions and operations. Add shared packages only when a real shared contract needs them.
- A modular backend with versioned REST endpoints under `/api/v1`; no initial microservice split.
- PostgreSQL is the source of truth. Prisma migrations are reviewed and versioned with the owning feature.
- Modules grow incrementally: identity, organizations, teams, projects/tasks, work records, schedules/leave, collaboration, notifications, integrations, risks, reporting, and AI.
- Validate API inputs and enforce both membership and resource-level permissions on the server. Scope queries to the authorized organization.
- Use secure server-managed sessions and HTTP-only cookies. Choose the implementation after evaluating compatibility and security requirements; cookie flags, CSRF, revocation, reset and verification flows are acceptance criteria.
- Store instants in UTC and retain IANA timezone identifiers for schedule interpretation. Calculate durations server-side; attendance is distinct from task-specific worklogs.
- GitHub webhooks require signature checks and duplicate-event handling. Add queues and Redis when delivery/retry requirements justify them.
- Risk metrics are calculated deterministically. AI explains authorized evidence and reports missing or stale data; it does not invent facts or make employment decisions.

## Delivery approach

Build each feature through database, backend, interface, validation, authorization, and relevant tests. Include loading, empty, error, and accessible keyboard states. Security, testing, CI, and documentation start early and continue throughout implementation.

Use a consistent charcoal/navy design system with restrained blue/indigo accents. Do not build unrelated page templates or placeholder dashboards that imply unfinished features work.

## Local resources and costs

The machine has 8 GB RAM. Start with only the required frontend, API, and database processes. Evaluate native versus hosted development PostgreSQL during its own setup task. Docker configuration can be provided later without requiring the entire stack to run constantly.

Use free services initially. Recheck current quotas, availability, retention, and cold-start behavior when selecting providers. Do not assume free hosting provides company-grade uptime or backups. AI integration needs a separately agreed provider and budget; a mock adapter is useful for tests but must not be presented as a live AI feature.

## Open decisions

- Feature-specific dependency versions; the workspace baseline is pinned and verified.
- Authentication design is selected in [AUTHENTICATION.md](AUTHENTICATION.md); HTTPS hosting must satisfy its same-origin cookie topology. Implementation starts in DF-008 onward.
- Neon PostgreSQL is configured and verified. Email provider, file storage, hosting and AI provider remain open.
- Merge authorization and branch protection availability. Routine task pushes and PRs are authorized; see the workflow record.
- Weekly time budget and target date; no completion date has been promised.

## Completion standard

A completed feature has persisted behavior, correct permissions, validated business rules, applicable passing checks, understandable documentation, and a focused commit. The final release also needs reproducible setup, synthetic seed data, deployment instructions, and explicitly documented limitations.
