# Project collaboration rules

## Approval and scope

- The user revised the workflow on 2026-10-15: take responsibility for routine technical decisions and progress through the agreed roadmap without asking for every task.
- State the task scope and verification plan, then implement, test, document, commit, and create task PRs autonomously.
- Ask only for consequential missing decisions such as material scope changes, paid services, real employee data handling, destructive actions, or production changes. Honor tool-enforced permission boundaries.
- Keep work incremental and explain completed milestones. This is not permission to generate the entire product in one unreviewable change.
- User instructions take precedence over these project defaults.

## Teaching and communication

- The user knows JavaScript and Node.js, has frontend experience, and is new to NestJS. Explain TypeScript and NestJS concepts as they are introduced.
- Write code and explain it step by step. Use Sinhala with familiar English technical terms in user-facing explanations; keep repository documentation and identifiers in English.
- Explain what changed, why, how it was checked, and remaining limitations.

## Git

- Inspect the working tree before changes; preserve existing user work.
- Use a focused `codex/DF-NNN-description` branch and a small local commit for each approved task. Do not amend or rewrite previous commits unless authorized.
- Stage specific task files. Never commit credentials, private employee data, generated dependency directories, or local environment secrets.
- Routine task branch pushes and PR creation are authorized. Keep PRs unmerged unless merge authorization is established; the earlier separate-merge preference remains in effect.
- Do not mark a task as merged or released merely because it is committed locally.

## Engineering constraints

- Target an 8 GB Windows development machine and free services initially. Avoid unnecessary always-running services.
- Verify dependency compatibility and pin selected versions during setup; do not claim versions have been verified during planning.
- Enforce organization and resource permissions in the backend, validate writes, and use database constraints and transactions where appropriate.
- Add meaningful tests alongside features. Report only checks actually run.
- Keep attendance and worklog semantics distinct. Never equate tracked hours or commit count with productivity.
- No hidden surveillance. Keep private reflections and leave details restricted.
- AI tools must be typed, allowlisted, read-only, individually authorized, and grounded in actual records. State-changing AI actions require explicit human approval.
- Follow docs/WORKFLOW.md and update task documentation within the approved task.
