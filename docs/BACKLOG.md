# Incremental backlog

The user has authorized autonomous routine progress through the agreed roadmap. Larger modules will still be split into small acceptance-driven tasks. Ask only about consequential decisions, not every task.

## Planning and foundation

| ID     | Task                                                                                            | Dependency     | Status                                       |
| ------ | ----------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------- |
| DF-001 | Inspect repository/tools; record scope, workflow, and backlog                                   | None           | Completed; pushed; PR #1 open, not merged    |
| DF-002 | Verify compatible versions; initialize minimal TypeScript workspace, lockfile, and ignore rules | DF-001         | Completed; PR #2 open, not merged            |
| DF-003 | Scaffold minimal NestJS API and health endpoint                                                 | DF-002         | Completed; PR #3 open, not merged            |
| DF-004 | Scaffold Next.js app, distinctive interactive workbench, and accessible base layout             | DF-003         | Completed; PR #4 open, not merged            |
| DF-005 | Configure formatting, lint, type checks, and initial CI/build checks                            | DF-003, DF-004 | Completed; PR #5 open, CI passed, not merged |
| DF-006 | Select development PostgreSQL setup; configure validated environment and Prisma baseline        | DF-003         | Completed; PR #6 open; CI and Neon verified  |
| DF-007 | Document authentication/session design and permission matrix                                    | DF-006         | Design complete; PR #7 open, not merged      |
| DF-008 | Implement organization and membership persistence with isolation checks                         | DF-007         | Proposed                                     |
| DF-009 | Implement registration and password hashing with tests                                          | DF-008         | Proposed                                     |
| DF-010 | Implement sign-in, sessions, logout, and revocation with tests                                  | DF-009         | Proposed                                     |
| DF-011 | Implement email verification through a provider adapter                                         | DF-010         | Proposed                                     |
| DF-012 | Implement password reset/change and required session invalidation                               | DF-011         | Proposed                                     |
| DF-013 | Implement organization onboarding and invitation workflow                                       | DF-012         | Proposed                                     |
| DF-014 | Connect authentication UI and protected workspace flows                                         | DF-013, DF-004 | Proposed                                     |
| DF-015 | Verify foundation end-to-end, permissions, and documentation                                    | DF-014, DF-005 | Proposed                                     |

Cross-cutting protections such as rate limits, CSRF and generic authentication errors belong in the relevant authentication task, not a deferred final hardening task. Task scope can be narrowed before approval when needed.

## Later phases, to be broken down before approval

| Phase | Outcome                                   | Key acceptance examples                                                                                   |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 2     | Profiles, teams, projects, tasks, sprints | Authorized assignment; persisted updates; no dependency cycles                                            |
| 3     | Attendance, breaks, schedules, worklogs   | No duplicate active sessions; correct durations/timezones; auditable corrections                          |
| 4     | Leave, notifications, stand-ups, meetings | Authorized approvals; private leave details; quiet hours and deduplication                                |
| 5     | GitHub integration                        | Verified signatures; idempotent event handling; authorized repository data                                |
| 6     | Risk engine and reports                   | Rule IDs, thresholds, evidence and resolution history; permission-aware exports                           |
| 7     | Wellbeing and AI                          | Configurable reminders; private reflections; authorized evidence; graceful provider failures              |
| 8     | Release readiness                         | Security review; reproducible deployment; restore verification; synthetic demo and documented limitations |

## DF-001 acceptance and verification

- Inspect existing files, Git status/history/remotes, and installed development tools.
- Preserve the original requirements and document the user's later approval and teaching preferences.
- Record stack direction, release boundaries, resource constraints, and unresolved decisions.
- Create project instructions and a small-task Git workflow.
- Check Markdown links and `git diff --check`; commit only the approved documentation.
- No application code or dependency installation in this task.
