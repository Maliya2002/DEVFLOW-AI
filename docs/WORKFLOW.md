# Development workflow

## One approved task at a time

1. Inspect the current implementation and Git state.
2. Present a task ID, purpose, exact scope, acceptance criteria, and verification plan.
3. Wait for explicit user approval before implementation.
4. Create or use the agreed task branch. Implement only the approved scope and necessary fixes.
5. Run checks appropriate to the change and inspect the diff. For documentation-only work, check links, consistency, and whitespace; application tests are not applicable.
6. Update the backlog and relevant documentation. Stage explicit files and create a focused local commit.
7. Report the branch, commit, changes, actual verification, limitations, and proposed next task. Wait for approval again.

For application tasks, relevant checks may include formatting, lint, type checking, unit/integration tests, critical end-to-end flows, migrations, and production builds. Record unavailable checks honestly. Never claim CI or a deployment succeeded without evidence.

## Version control

- Task IDs: `DF-001`, `DF-002`, etc.
- Branch example: `codex/DF-002-workspace-setup`.
- Commit example: `chore(repo): initialize workspace`.
- Prefer one coherent commit per small task; split further when changes are independently meaningful.
- Keep `main` in a verified state. A task branch is not automatically merged after a local commit.
- Push, PR, merge strategy, and any standing remote authorization must be agreed with the user. Until then, keep commits local and report that status.
- If the next task depends on an unmerged task branch, explicitly agree the branch base or merge workflow before proceeding.
- Do not force-push, rewrite history, discard user work, or include secrets.

## Task acceptance template

Task ID and title:

Purpose:

In scope / excluded work:

Prerequisites:

Acceptance criteria:

Checks to run:

Approval status:

Result, limitations, branch, and commit:

## Explanations

At completion, explain the relevant files, request/data flow, new concepts, commands actually run, and how the user can verify the result. Keep each task small enough to understand and review.
