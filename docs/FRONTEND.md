# DF-004: interactive frontend foundation

## Current functionality

- Overview with a custom engineering workbench: narrow tool rail, dark frame, light drafting surface, cobalt selection, and a contextual inspector.
- Six explicitly planned capabilities across Delivery, Coordination, and Context. This is a navigable product map, not live organization data or implemented business workflows.
- Search titles, summaries, and planned features; combine with category filters; reset an empty result.
- Switch Map/List views, select a capability, and explore the next visible capability. Selection remains within the current filter.
- Press `/` outside editable controls to focus search; Escape clears search. All controls use native buttons/links and visible focus states.
- Responsive mobile navigation, Escape-to-close with focus return, skip link, reduced-motion support, and a link from the mobile map to the detail inspector.
- Connection page checks the actual Nest API through a same-origin Next route. Loading, unavailable, and manual retry states are real.
- Custom 404 and recoverable error view. No sign-in, task creation, or database access is implied.

## Run

From the repository root:

```sh
npm ci --ignore-scripts
npm run build:api
npm run start:api
```

In another terminal:

```sh
npm run dev:web
```

Visit `http://127.0.0.1:3000`. The overview does not require the backend. The Connection page needs the API on port 3001. Stop owned servers with Ctrl+C when finished.

For production-mode preview, replace `dev:web` with `build:web` and then `start:web`. Both default to loopback; this task does not publish the site.

## Configuration and request flow

The optional `apps/web/.env.local` can use the server-only `API_BASE_URL` from `.env.example`. It defaults to `http://127.0.0.1:3001`. Never add a `NEXT_PUBLIC_` prefix or a browser-controlled destination.

Browser `GET /api/connection` → Next route handler → fixed `/api/v1/health` at the configured backend origin. The route verifies the response contract, refuses redirects, applies a 2.5-second timeout, disables caching, and returns only generic availability. Browser requests have a 5-second timeout and abort on unmount. There is no polling loop or CORS exception.

The UI remains accessible when the service is unavailable. Availability means only that the liveness response was received; it says nothing about future database readiness.

## Files and concepts

- `src/app/layout.tsx`: document metadata, self-hosted fonts, shared shell, and skip link.
- `src/app/page.tsx`: server-rendered overview structure and honest preview messaging.
- `src/components/workspace-shell.tsx`: active route and responsive navigation.
- `src/components/workspace-map.tsx`: local search/filter/view/selection state. No server persistence or user data is involved.
- `src/components/connection-status.tsx`: fetch lifecycle, cancellation, retry, and status announcement.
- `src/app/api/connection/route.ts`: bounded server-to-server liveness check.
- `src/components/ui/button.tsx`: local shadcn-style button primitive using Radix Slot, CVA, and merged classes. `components.json` establishes future component-generation aliases. No unrelated component bundle is generated.
- `src/app/globals.css`: theme tokens, layout, workbench styling, responsive rules, and motion preferences.
- `playwright.config.ts` and `test/foundation.spec.ts`: sequential desktop/mobile browser verification.

Pages default to Server Components. Only navigation, explorer controls, and availability checks need Client Components. Type generation runs before workspace type checking; generated `next-env.d.ts` and `.next` are ignored. The framework-generated `apps/web/AGENTS.md` is committed to avoid recurring untracked changes and directs future agents to installed framework documentation.

## Dependency decisions

Pinned Next.js 16.4.1, React/React DOM 19.3.1, React types 19.3.0, Tailwind/PostCSS adapter 4.3.3, and Playwright 1.64.1. Runtime engine and React peer requirements were checked against installed Node 24.18.0. The actual production build verifies compatibility with TypeScript 7.0.2 for this scope.

Geist is served from the pinned `@fontsource/geist` package, so builds do not fetch Google Fonts. UI icons use Lucide. Use the exact committed lockfile rather than floating versions. Next/Tailwind native binaries install as optional platform packages; no custom lifecycle script is required for this dependency set.

References: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [shadcn manual setup](https://ui.shadcn.com/docs/installation/manual).

## Verification commands

```sh
npm run typecheck
npm run build:api
npm run build:web
npm run test:web
```

Playwright uses Chromium by default. Provision that browser in your environment when needed. On this Windows machine, installed Edge was used without downloading a browser:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:web
```

The suite starts and stops its own compiled API on port 3101 and production web server on 3100; it refuses to reuse existing processes. One worker limits memory use. It verifies the real successful API path and uses browser interception for unavailable/loading UI states. This is not a full fault-injection test of every backend/network failure.

Screenshots and traces are generated under ignored `apps/web/test-results`. Local checks cover desktop 1440px, mobile 390px, and 320px overflow/reduced motion. This is not a WCAG certification or a cross-browser test suite. Full lint/format/CI setup remains DF-005.

## Verified results

- Production Next build and both workspace type checks passed, including the browser test sources.
- Final Playwright run passed 20 tests across desktop and mobile Edge profiles.
- Existing API build and 16 Jest/Supertest tests passed after dependency changes.
- Desktop/mobile screenshots were visually inspected. The 320px viewport check found no horizontal overflow.
- With the real local API stopped, the Next route returned HTTP 503, only `{"status":"unavailable"}`, and `Cache-Control: no-store`.
- npm install reported zero vulnerabilities. Generated output, local secrets, and browser artifacts are ignored; `.env.example` remains trackable.
- Local documentation links and diff whitespace checks passed. No deployment, authentication, data persistence, or CI success is claimed.

The final design incorporates the user's request for a distinctive, eye-catching, interactive interface. Future screens should continue the workbench language rather than reverting to generic hero cards or mock metrics. The base layout and workbench surface overrides are grouped in CSS; project-wide formatting is the next task.
