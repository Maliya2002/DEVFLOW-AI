# MASTER PROJECT PROMPT — DEVFLOW AI
## Enterprise Remote Work & Software Engineering Management Platform

Act as a Senior Software Architect, Full-Stack Software Engineer, UI/UX Designer, QA Engineer, DevOps Engineer, Security Engineer, and Product Designer.

Build a complete, production-oriented software product called **DevFlow AI**.

This must be a real, working, deployable full-stack web application for software engineering companies that manage remote and hybrid teams. It must support employee authentication, attendance, work schedules, tasks, projects, team collaboration, meetings, time tracking, performance analytics, work-life balance, and AI-powered engineering insights.

The main objective is to create a professional portfolio project that demonstrates the skills required for remote Software Engineering Intern, Junior Software Engineer, Full-Stack Developer, and related positions.

Do not create a basic CRUD application, a static dashboard, a clickable prototype, or a simple task-management clone.

Build a cohesive software product with working backend logic, persistent database storage, secure authorization, meaningful business rules, automated tests, and production deployment support.

---

# 1. CORE PRODUCT REQUIREMENTS

The application must support:

- Remote employees working from different locations and time zones.
- Hybrid employees working remotely or from the office.
- Team leads managing distributed developers.
- Project managers monitoring projects, deadlines, and sprint progress.
- HR and operations teams managing attendance, leave, and schedules.
- Software engineering teams tracking tasks, pull requests, bugs, and deployments.
- Employees tracking working time, breaks, meetings, and daily progress.
- Managers identifying blocked work, overloaded schedules, and delivery risks.
- Employees maintaining healthy work-life boundaries.
- AI-assisted project analysis and asynchronous collaboration.

All important functionality must be operational, not merely displayed in the interface.

# 2. TECHNOLOGY STACK

Use the following stack unless a concrete technical limitation requires a documented alternative.

Frontend:
- Next.js with TypeScript.
- Tailwind CSS.
- shadcn/ui.
- TanStack Query.
- React Hook Form.
- Zod validation.
- Recharts for analytics.
- Accessible reusable UI components.

Backend:
- NestJS with TypeScript.
- REST API with versioning.
- PostgreSQL database.
- Prisma ORM with pinned dependencies and reproducible migrations.
- Redis and BullMQ for background jobs where appropriate.
- WebSocket or Server-Sent Events for justified real-time features.

Authentication:
- A maintained authentication library or a securely implemented session-based solution.
- Secure HTTP-only cookies.
- Appropriate CSRF protection.
- Email verification and password reset.
- Optional OAuth sign-in where configured.

Engineering integrations:
- GitHub API and webhooks.
- Calendar integration as an optional later phase.
- Email delivery provider through an adapter.
- Optional Slack integration after the core system works.

Testing:
- Jest.
- Supertest.
- Playwright.
- Unit, integration, security, and end-to-end tests.

Deployment:
- Docker.
- Docker Compose for local development.
- GitHub Actions CI/CD.
- Managed PostgreSQL.
- Managed Redis if background workers require it.
- HTTPS production deployment.

Use current stable, mutually compatible dependencies. Pin versions and document any compatibility decisions.

# 3. USER ROLES AND PERMISSIONS

Implement proper role-based access control.

## Organization Owner
- Manage organization settings.
- Manage administrators and integrations.
- Configure security policies.
- View organization-wide reports.
- Manage workspace lifecycle.

## Administrator
- Manage users, teams, roles, projects, schedules, and organization settings.
- Configure attendance and leave policies.
- Review audit logs and operational reports.

## HR / Operations
- Manage employee profiles and approved attendance records.
- Review leave requests.
- Manage holidays and work schedules.
- Access only the personal and organizational data permitted by policy.

## Project Manager
- Create projects and assign project members.
- Manage deadlines, milestones, sprints, and project reports.
- Review delivery risks and project workload.
- Access authorized project analytics.

## Team Lead
- Manage team tasks, reviews, blockers, and sprint priorities.
- Review team availability and workload.
- Coordinate daily updates and team meetings.
- View authorized team-level work metrics.

## Developer / Employee
- Sign in and sign out.
- Start and end a work session.
- Record breaks and working time.
- Manage assigned tasks.
- Submit daily updates.
- Request leave.
- View schedules and attendance.
- Track personal workload and work-life balance.
- Participate in authorized projects and team discussions.

## Viewer / Stakeholder
- View specifically authorized project reports.
- Cannot modify project or employee records.

Enforce permissions on the backend. Hiding a frontend button is not an authorization mechanism.

# 4. COMPLETE AUTHENTICATION SYSTEM

Implement all of the following:

- Sign up.
- Sign in.
- Sign out.
- Sign out from all sessions.
- Email verification.
- Forgot password.
- Secure password reset.
- Session expiration.
- Session revocation.
- Remember-me behavior where safely supported.
- Profile management.
- Change password.
- Profile avatar upload with file validation.
- Account settings.
- Optional Google or GitHub sign-in.
- Login history and security events.
- Rate limiting for authentication endpoints.
- Protection against brute-force attempts.
- Generic authentication errors that do not expose whether an account exists.
- Secure logout behavior.
- Appropriate session invalidation after password changes.

After successful sign-in, redirect users to their role-appropriate workspace.

Unauthenticated users must not access protected pages or APIs.

After sign-out, protected resources must no longer be accessible through browser history, direct URLs, or API calls.

Do not store passwords, session tokens, or OAuth secrets in plaintext.

# 5. EMPLOYEE PROFILE AND REMOTE WORK SETTINGS

Each employee should have:

- Name and profile picture.
- Job title.
- Department.
- Team.
- Manager.
- Work email.
- Time zone.
- Work location preference: Remote, Hybrid, or Office.
- Standard working days.
- Configurable working hours.
- Preferred focus hours.
- Skills and areas of responsibility.
- Assigned projects.
- Notification preferences.
- Calendar availability.
- Leave balance where applicable.
- Personal work summary.
- Account status.

Allow users to update permitted personal information.

Restrict sensitive employee data to authorized roles.

Do not expose home addresses, precise personal location, or private calendar details to ordinary team members.

# 6. ATTENDANCE AND WORK SESSION MANAGEMENT

Build a complete remote-work attendance module.

Features:
- Start work session.
- End work session.
- Start break.
- End break.
- Record lunch breaks.
- View today's work session.
- View previous attendance records.
- View total tracked work duration.
- View total break duration.
- View approved overtime where relevant.
- Submit attendance correction requests.
- Manager approval workflow for corrections.
- Configurable work schedules.
- Public holidays and approved leave handling.
- Late-start and missing-check-out indicators based on configured schedules.
- Weekly and monthly attendance reports.

Business rules:
- A user cannot start multiple active work sessions.
- A user cannot end a session that does not exist.
- A user cannot end a session before it starts.
- Breaks must belong to a valid work session.
- Reject overlapping sessions unless an explicitly documented correction workflow permits them.
- Store timestamps in UTC and display them in the employee's configured time zone.
- Handle daylight-saving changes correctly for international teams.
- Calculate durations on the server.
- Use an auditable correction workflow for manual changes.
- Never silently overwrite attendance history.

IMPORTANT PRIVACY RULE:

Do not implement secret screenshots, keylogging, webcam monitoring, continuous GPS tracking, or hidden activity surveillance.

Use transparent, user-initiated work sessions and explicit activity records.

A work timer must not be treated as proof of productivity. Employees may be reading documentation, thinking, or working offline.

# 7. WORK SCHEDULES AND AVAILABILITY

Implement:

- Personal work schedules.
- Team working hours.
- Organization time zone.
- Employee time zones.
- Public holidays.
- Approved leave integration.
- Flexible schedules.
- Recurring availability.
- Focus blocks.
- Meeting availability.
- Out-of-office status.
- Configurable overlap hours for distributed teams.
- Availability view that respects employee privacy.

Show local times clearly when team members work in different time zones.

Prevent the system from interpreting someone as absent merely because their local working day has not started.

# 8. TASK AND PROJECT MANAGEMENT

Build complete project-management functionality.

Projects:
- Create, update, archive, and view projects.
- Assign project managers and team members.
- Set project goals, deadlines, and status.
- Create milestones.
- Display project health.
- Maintain project activity history.

Tasks:
- Create and update tasks.
- Assign employees.
- Set priority, status, due date, estimate, and labels.
- Add descriptions, comments, and attachments.
- Track task changes.
- Create subtasks.
- Link related issues.
- Add dependencies.
- Prevent circular dependencies.
- Record blockers.
- Track task start and completion times.
- Filter and search tasks.

Task views:
- Kanban board.
- List view.
- Sprint board.
- Calendar view.
- Timeline view.
- My Tasks.
- Team Tasks.
- Overdue Tasks.
- Blocked Tasks.

Implement valid task-state transitions, server-side authorization, pagination, filtering, and persistent storage.

# 9. AGILE AND SOFTWARE ENGINEERING WORKFLOWS

Implement:

- Product backlog.
- Sprint planning.
- Sprint start and completion.
- Story points or configurable effort estimates.
- Sprint goals.
- Sprint burndown or progress visualization.
- Task dependencies.
- Bug tracking.
- Technical debt records.
- Engineering decision records.
- Release milestones.
- Retrospective notes.
- Sprint reports.

Integrate GitHub to retrieve authorized repository data, pull requests, reviews, and workflow status.

Show:
- Open PR count.
- PRs waiting for review.
- Review waiting time.
- Failed CI workflows.
- Recent commits.
- Linked tasks.
- Release activity.

Do not assume that commit count or lines of code equal developer productivity.

# 10. TIME TRACKING AND WORKLOGS

Provide:

- Start and stop timer.
- Manual time entries subject to configured policy.
- Associate time entries with tasks and projects.
- Add descriptions.
- Track estimated versus actual effort.
- View daily and weekly timesheets.
- Edit entries through an auditable correction process.
- Submit timesheets for approval if required.
- Display time allocation by project.
- Export authorized worklogs.

Use server-side calculations and validate overlapping entries.

Make it clear whether a duration represents a user-entered estimate, an active timer, or an approved worklog.

Do not automatically count meetings, idle time, or browser activity as productive work.

# 11. BREAKS AND WORK-LIFE BALANCE

This is a core differentiator of DevFlow AI.

Implement a privacy-conscious wellbeing module.

Features:
- Configurable break reminders.
- User-controlled focus sessions.
- Meeting-free focus blocks.
- Personal workload overview.
- Daily and weekly working-time summaries.
- Overtime trend indicators based on configured schedules.
- Consecutive meeting summaries.
- After-hours work summaries.
- Upcoming deadline and workload warnings.
- Personal work-hour preferences.
- Notification quiet hours.
- Daily shutdown checklist.
- Optional end-of-day reflection.
- Personal work-life balance dashboard.

Example insights:
- "You have four consecutive meetings scheduled."
- "Your calendar contains no focus block today."
- "Your tracked work time is above your configured weekly target."
- "Several tasks are due on the same day."
- "You may want to review your workload with your team lead."

All alerts must be based on transparent rules and actual authorized data.

Do not diagnose health conditions, infer mental health, rank employees by wellbeing, or automatically punish employees for working different schedules.

Employees must be able to configure or disable nonessential reminders.

Keep personal reflections private unless the user explicitly chooses to share them.

# 12. REMOTE TEAM COLLABORATION

Implement:

- Team directory.
- Team membership.
- Project-specific discussion threads.
- Task comments and mentions.
- Notifications.
- Activity feed.
- Daily asynchronous stand-ups.
- Weekly team summaries.
- Meeting scheduling records.
- Meeting agendas and action items.
- Decision records.
- Blocker reporting.
- Shared project documents.
- File attachments with safe upload validation.
- Read/unread notification status.

Stand-up questions:
1. What did you complete?
2. What are you working on?
3. Are you blocked?
4. What support do you need?

Allow asynchronous submission at different local times.

Do not require every team member to be online simultaneously.

Do not generate or publish stand-up reports without the employee's review and approval.

# 13. LEAVE MANAGEMENT

Implement:

- Leave types.
- Leave request submission.
- Start and end dates.
- Optional employee notes.
- Approval and rejection workflow.
- Cancellation requests.
- Configurable leave policies.
- Leave balances where applicable.
- Holiday calendars.
- Team availability integration.
- Leave history.
- Notifications.
- Authorized reports.

Prevent conflicting leave requests and invalid date ranges.

Keep leave details private from ordinary team members; expose only availability information where appropriate.

Do not assume that every company follows the same leave or overtime rules. Make policies configurable and document the limitations.

# 14. NOTIFICATIONS AND REMINDERS

Implement in-app notifications for:

- Task assignments.
- Mentions.
- Upcoming deadlines.
- Approved or rejected leave.
- Attendance correction decisions.
- Pull-request review requests.
- Failed integrations.
- Important project risks.
- Meeting updates.
- Stand-up reminders.

Support:
- Read/unread status.
- Notification preferences.
- Quiet hours.
- Appropriate deduplication.
- Background delivery retries.
- Optional email notifications through a provider adapter.

Do not spam users or bypass quiet-hour preferences for ordinary notifications.

# 15. AI ENGINEERING ANALYST

Build an AI assistant that can answer authorized questions about project data.

Examples:
- "What is blocking our current sprint?"
- "Which pull requests have waited longest for review?"
- "What changed in this project today?"
- "Which tasks may miss their deadlines?"
- "Is my workload unusually high compared with my configured schedule?"
- "Summarize the project risks for our next team meeting."

Architecture:
- Use a server-side LLM provider adapter.
- Define allowlisted, typed, read-only tools.
- Authorize every tool call.
- Calculate metrics in deterministic backend services.
- Pass only necessary evidence to the model.
- Include links or IDs for supporting records.
- Explicitly identify missing or stale data.
- Apply request limits and usage budgets.
- Keep provider keys server-side.
- Handle provider timeouts and failures gracefully.

The model must not invent attendance records, task status, employee performance, or work hours.

Do not use AI to secretly monitor workers or make employment decisions.

Any state-changing action must require explicit human approval.

# 16. ENGINEERING DELIVERY RISK

Build a deterministic risk engine that identifies:

- Stale pull requests.
- PRs awaiting review.
- Overdue tasks.
- Blocked dependencies.
- Repeated CI failures.
- Sprint delivery risks.
- Workload conflicts.
- Excessive meeting concentration.
- Unresolved project blockers.

Each finding must contain:
- Rule identifier.
- Severity.
- Supporting record IDs.
- Triggering values and thresholds.
- Detection time.
- Current status.
- Recommended next action.
- Acknowledgment and resolution history.

Clearly distinguish deterministic findings from AI-generated explanations.

Do not label heuristic indicators as scientifically validated predictions.

# 17. ANALYTICS AND REPORTS

Create dashboards appropriate to each role.

Employee dashboard:
- Today's schedule.
- Start/end work session controls.
- Current timer and break status.
- My Tasks.
- Today's meetings.
- Personal workload.
- Leave status.
- Work-life balance summaries.
- Daily stand-up.

Team lead dashboard:
- Team availability.
- Assigned and blocked tasks.
- Sprint progress.
- PR review queue.
- Project risks.
- Upcoming deadlines.
- Team-level workload distribution.

Project manager dashboard:
- Project status.
- Milestones.
- Delivery risks.
- Sprint reports.
- Task completion.
- Dependencies.
- Engineering activity.

HR/operations dashboard:
- Attendance exceptions.
- Approved leave.
- Correction requests.
- Schedule configuration.
- Authorized aggregate reports.

Administrator dashboard:
- Organization configuration.
- Membership and role management.
- Integration status.
- Audit events.
- System health.

Use real persisted data. Include date filters, clear metric definitions, loading states, empty states, and export permissions.

Do not equate attendance duration with productivity or use raw commit counts to rank employees.

# 18. DATABASE AND DATA INTEGRITY

Design a normalized PostgreSQL schema with UUID identifiers, foreign keys, unique constraints, appropriate indexes, and migrations.

Include entities for:
- User.
- Session.
- Organization.
- OrganizationMembership.
- Team.
- TeamMembership.
- Project.
- ProjectMembership.
- Sprint.
- Task.
- TaskDependency.
- TaskComment.
- WorkSession.
- BreakSession.
- Worklog.
- WorkSchedule.
- AvailabilityBlock.
- LeavePolicy.
- LeaveRequest.
- Holiday.
- StandupReport.
- Meeting.
- MeetingParticipant.
- MeetingActionItem.
- Notification.
- Integration.
- PullRequest.
- PullRequestReview.
- BuildRun.
- Deployment.
- ActivityEvent.
- RiskFinding.
- AuditLog.
- WebhookDelivery.
- AIAnalysis.

Add other entities only when a real feature requires them.

Use database transactions for related changes. Prevent duplicate external events. Define retention policies for attendance, audit events, and personal information.

Do not store secrets or passwords in plaintext.

# 19. API DESIGN

Build versioned REST endpoints under /api/v1.

Create appropriate endpoints for:
- Authentication and sessions.
- Users and profiles.
- Organizations and memberships.
- Teams.
- Projects and project memberships.
- Tasks, dependencies, and comments.
- Sprints and analytics.
- Work sessions and breaks.
- Timesheets and worklogs.
- Schedules and availability.
- Leave requests and approvals.
- Stand-ups.
- Meetings and action items.
- Notifications.
- GitHub integrations and webhooks.
- Risk findings.
- AI analysis.
- Reports.
- Audit events.
- Health and readiness.

Requirements:
- DTO validation.
- Typed responses.
- Consistent error codes.
- Pagination and filtering.
- Rate limiting.
- Authorization guards.
- OpenAPI documentation.
- Idempotency for retried writes where appropriate.
- Request IDs and safe error logging.

Never allow arbitrary client input to become an unrestricted database update.

# 20. SECURITY AND PRIVACY

Implement:
- Secure authentication.
- Strong session handling.
- Role-based and resource-level authorization.
- Organization and project isolation.
- Input validation.
- Output encoding.
- Secure file uploads.
- CSRF protections where applicable.
- Rate limiting.
- Secret management.
- Webhook signature verification.
- Audit logging.
- Dependency vulnerability checks.
- Secure HTTP headers.
- Appropriate CORS configuration.
- Data retention and account deletion policies.
- Protection against insecure direct object references.
- Safe error handling.
- Protection against prompt injection in external repository content.

Do not implement hidden surveillance, keylogging, secret screenshots, or continuous GPS tracking.

Provide employees with transparent information about which work records are collected and which roles can access them.

# 21. PROFESSIONAL UI/UX

Create a distinctive, premium software engineering SaaS interface.

Visual direction:
- Dark charcoal and deep navy base.
- Restrained indigo, electric blue, and cyan accents.
- Clear typography using Geist or Inter.
- Responsive desktop, tablet, and mobile layouts.
- Consistent spacing and component tokens.
- Accessible contrast and visible focus states.
- Subtle motion and meaningful transitions.
- Reduced-motion support.
- Polished charts, tables, drawers, and detail panels.
- Skeleton loaders and useful empty states.
- Toast notifications for meaningful actions.
- Confirmation dialogs for destructive operations.

Required pages:
- Landing page.
- Sign up.
- Sign in.
- Email verification.
- Password reset.
- Onboarding.
- Organization setup.
- Main dashboard.
- My Tasks.
- Projects.
- Kanban board.
- Sprint planning.
- PR intelligence.
- Risk center.
- Attendance.
- Time tracking.
- Work schedules.
- Work-life balance.
- Team directory.
- Stand-ups.
- Meetings.
- Leave management.
- Reports.
- AI analyst.
- Notifications.
- User profile.
- Security settings.
- Organization settings.
- Team management.
- Integration settings.
- Audit logs.
- Not-found and error pages.

Build a consistent design system. Do not create every page as an unrelated template.

# 22. TESTING REQUIREMENTS

Write unit, integration, and end-to-end tests.

Test at minimum:
- Sign-up and sign-in.
- Sign-out and session revocation.
- Password reset.
- Organization isolation.
- Role-based access.
- Task creation and updates.
- Dependency cycle rejection.
- Attendance start/end rules.
- Break calculations.
- Time-zone conversion.
- Worklog validation.
- Leave approval.
- Notification access.
- GitHub webhook signatures.
- Duplicate event handling.
- Risk-engine rules.
- AI tool authorization.
- AI provider failure handling.
- Responsive critical workflows.

Use deterministic fixtures and mock external services in automated tests.

Run tests and fix failures. Do not claim tests passed unless they actually ran.

# 23. DEVOPS AND DEPLOYMENT

Implement:
- Docker-based local development.
- PostgreSQL setup.
- Redis setup where required.
- Environment variable validation.
- Database migrations.
- Safe seed scripts.
- GitHub Actions CI.
- Formatting and lint checks.
- Type checking.
- Automated tests.
- Production build.
- Dependency scanning.
- Deployment documentation.
- Health and readiness endpoints.
- Structured logs.
- Error reporting.
- Database backup and restore instructions.
- Demo organization with synthetic data.
- Production configuration guide.

Provide .env.example without actual secrets.

Make it possible for another developer to clone the repository, follow the README, configure credentials, and run the application.

# 24. IMPLEMENTATION PHASES

Develop the project incrementally in this order.

Phase 1: Repository setup, authentication, sessions, organizations, roles, and design system.

Phase 2: Employee profiles, teams, projects, tasks, sprints, and dependencies.

Phase 3: Attendance, work sessions, breaks, schedules, time tracking, and worklogs.

Phase 4: Leave management, notifications, asynchronous stand-ups, meetings, and collaboration.

Phase 5: GitHub integration, webhook processing, pull-request intelligence, and CI status.

Phase 6: Risk engine, dashboards, analytics, reports, and workload insights.

Phase 7: Work-life balance tools and privacy-conscious AI engineering analyst.

Phase 8: Security hardening, automated tests, CI/CD, deployment, documentation, and demo.

For each phase:
1. Inspect the existing implementation.
2. Identify dependencies and prerequisites.
3. Implement complete functionality for that phase.
4. Add and apply database migrations.
5. Add tests.
6. Run lint, type checks, tests, and production build where applicable.
7. Fix failures before continuing.
8. Update documentation.
9. Report completed work, verified results, and known limitations.
10. Wait for explicit approval before starting the next phase.

Do not generate the entire project at once.

# 25. DEFINITION OF DONE

The final product must have:
- Working sign-in and sign-out.
- Secure session handling.
- Role-based permissions.
- Remote-work attendance and time tracking.
- Task and project workflows.
- Team collaboration.
- Leave management.
- Work-life balance tools.
- GitHub integration.
- Engineering risk analysis.
- Evidence-grounded AI features.
- Persistent database storage.
- Automated tests.
- CI/CD.
- Deployment instructions.
- A working hosted demo where infrastructure permits.
- Professional documentation and screenshots.

A feature is not complete merely because its UI exists. It must work through the frontend, backend, database, validation, authorization, and relevant tests.

Begin with Phase 1 only. Inspect the repository, explain the implementation plan briefly, and then implement Phase 1 completely. Do not proceed to Phase 2 without my approval.