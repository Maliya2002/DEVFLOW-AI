# Development workflow

## One focused task at a time

1. Inspect the current implementation and Git state.
2. State a task ID, purpose, scope, acceptance criteria, and verification plan.
3. Proceed with routine work under the user's standing authorization. Ask only for consequential missing decisions, cost, sensitive data, destructive or production actions, or required permission boundaries.
4. Create or use the agreed task branch. Implement only the approved scope and necessary fixes.
5. Run checks appropriate to the change and inspect the diff. For documentation-only work, check links, consistency, and whitespace; application tests are not applicable.
6. Update the backlog and relevant documentation. Stage explicit files and create a focused local commit.
7. Push the task branch, create a focused PR, and report changes, actual verification, limitations, and the next step. Do not repeatedly request approval for routine tasks.

For application tasks, relevant checks may include formatting, lint, type checking, unit/integration tests, critical end-to-end flows, migrations, and production builds. Record unavailable checks honestly. Never claim CI or a deployment succeeded without evidence.

## Version control

- Task IDs: `DF-001`, `DF-002`, etc.
- Branch example: `codex/DF-002-workspace-setup`.
- Commit example: `chore(repo): initialize workspace`.
- Prefer one coherent commit per small task; split further when changes are independently meaningful.
- Keep `main` in a verified state. A task branch is not automatically merged after a local commit.
- Routine pushes and task PRs are authorized by the user's updated instruction. Merge authorization remains separate.
- When the next task depends on an unmerged task branch, create a dependent branch and target its PR at the preceding task branch. State that dependency in the PR. Retarget/review the diff when the parent is merged.
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

## Approval record: 2026-10-15

The user approved DF-002 and the DF-001 push/PR. DF-001 is published as [PR #1](https://github.com/Maliya2002/DEVFLOW-AI/pull/1), without merging. DF-002 uses a dependent local branch starting at DF-001 commit `ec13221`, keeping main unchanged. The combined approval is interpreted as permission to continue from that reviewed planning baseline, not permission to merge it. DF-002 push/PR and merges still require approval; no standing remote authorization is implied.

### Superseding instruction

The user subsequently requested that the agent take responsibility and ask only about relevant consequential matters rather than every action. This supersedes the earlier task-by-task approval requirement and authorizes routine implementation, dependency work, verification, commits, branch pushes, and PR creation within the agreed roadmap. DF-002 is now published as PR #2. The previous explicit separate-merge preference is retained. No paid purchase, production deployment, destructive operation, or real employee data processing is implied.
