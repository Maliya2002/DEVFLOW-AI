# Project collaboration rules

## Approval and scope

- Ask the user for explicit approval before starting each new small development task, including documentation tasks. Approval for a phase does not automatically authorize all its tasks.
- Describe the task ID, scope, acceptance criteria, and planned verification before approval.
- Complete edits and fixes necessary for the approved task without repeatedly asking about routine implementation details.
- Do not start the next task without approval. Do not install dependencies or implement application code under a planning-only task.
- User instructions take precedence over these project defaults.

## Teaching and communication

- The user knows JavaScript and Node.js, has frontend experience, and is new to NestJS. Explain TypeScript and NestJS concepts as they are introduced.
- Write code and explain it step by step. Use Sinhala with familiar English technical terms in user-facing explanations; keep repository documentation and identifiers in English.
- Explain what changed, why, how it was checked, and remaining limitations.

## Git

- Inspect the working tree before changes; preserve existing user work.
- Use a focused `codex/DF-NNN-description` branch and a small local commit for each approved task. Do not amend or rewrite previous commits unless authorized.
- Stage specific task files. Never commit credentials, private employee data, generated dependency directories, or local environment secrets.
- Remote push, PR, and merge behavior is pending agreement. Do not infer that a local commit authorizes those actions.
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
