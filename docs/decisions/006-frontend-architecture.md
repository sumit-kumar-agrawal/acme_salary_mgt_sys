# ADR 006: Frontend Architecture and Technology Stack

- **Status:** Accepted
- **Date:** 2026-09-29
- **Related:** FRONTEND_PLAN.md (decisions FD1–FD13, gaps G1–G7); ADR 001 (monorepo), ADR 002 (currency), ADR 004 (session-cookie authentication); `docs/api-specification.md` v2.1 §13; `.claude/rules/frontend/*`

## Context

The Rails JSON API is complete (BACKEND_PLAN.md Phases 1–7). `CLAUDE.md` fixes React with Bootstrap, React Testing Library, and Playwright. ADR 004 requires the frontend to be served **same-site** with the API, because authentication uses an `HttpOnly`, `SameSite=Lax` session cookie with CSRF tokens and no CORS. The single user is an HR Manager working with about 10,000 employees, and salary data is sensitive and multi-currency.

## Decision

A single-page application in `frontend/` (monorepo, ADR 001), built with Vite. In development, Vite proxies `/api` to the Rails server on `:3000`, so the browser sees one origin and the backend needs no change.

| Concern | Choice (versions installed in F2.1, 2026-09-29) |
|---|---|
| Runtime | Node 22 via nvm (v22.23.3), `.nvmrc` = `22`, `engines` `>=22.22.2` (jsdom 30's minimum) |
| Language | TypeScript 6.0 (strict + `noUncheckedIndexedAccess`). TypeScript 7 is not yet supported by typescript-eslint |
| Build and dev server | Vite 8.3 with @vitejs/plugin-react 6.1 (dev proxy `/api` → `VITE_PROXY_TARGET`, default `http://localhost:3000`, `changeOrigin: false`) |
| UI | React 19.3; Bootstrap 5.3.8 with react-bootstrap 2.10 |
| Routing | React Router 8.4 in declarative mode (installed in F3.2; FRONTEND_PLAN.md R1): `BrowserRouter` in `main.tsx`, routes in `src/routes/` |
| Server state | TanStack Query 5 (installed in F2.2), through typed service objects in `src/services/` |
| Session state | React Context (`AuthProvider`): user and CSRF token, in memory |
| UI state | Local component state and the URL (filters, sort, page; not `q`) |
| Charts | None. The salary distribution is an accessible table per currency with Bootstrap bars (FRONTEND_PLAN.md V8, 2026-09-29, replacing Chart.js 4.5 with react-chartjs-2 5.3) |
| Forms | Plain controlled components; the API's `422` `details` are shown per field |
| Unit and component tests | Vitest 5.0, jsdom 30, React Testing Library 16.3, user-event 14.6, jest-dom 7.0, MSW 3.0 |
| End-to-end tests | Playwright 1.63, Chromium only (installed in F3.1; the browser lives in the user cache, not the repo), against the real Rails API and development database. One sign-in per run via a setup project; the saved session file (`playwright/.auth/`) is git-ignored |
| Lint and format | ESLint 9.39 (typescript-eslint 8.71 `recommendedTypeChecked`, react-hooks, react-refresh, jsx-a11y), eslint-config-prettier, Prettier 3.9 (defaults). ESLint 9 is marked deprecated upstream, but jsx-a11y does not support ESLint 10 yet; move to 10 when it does |
| Package manager | npm (lockfile committed) |

Conventions (enforced by `.claude/rules/frontend/*`):

- **API access:** only `src/services/` calls `fetch`. One client owns the base path (`VITE_API_BASE_URL`, default `/api/v1`, same-site only), `credentials`, JSON, `X-CSRF-Token` on writes, and mapping the error envelope to a typed error.
- **Session:** the signed-in user and CSRF token live in memory (React context), never in browser storage. The token returned by sign-in replaces the earlier one. A `401` means signed out.
- **Money:** amounts are shown as the API's decimal strings, always with `currency_code`, labelled monthly. There is no cross-currency arithmetic and no floating-point money; `Number` is used only to size chart bars (ADR 002).
- **URL state:** list filters, sort, and page live in the URL so they can be shared and work with the back button, **except the search text `q`**, which is kept out of URLs and browser history.
- **Structure (owner decision 2026-09-29):** `src/components/common/` reusable UI; `src/components/<feature>/` per feature (`auth`, `employees`, `salaries`, `dashboard`, `reports`: pages and feature components); `src/layouts/` main layout, header, navbar, sidebar; `src/routes/` app routes; `src/hooks/` custom hooks (e.g. `useAuth`); `src/services/api.ts` HTTP core (`apiRequest`, `ApiError`, in-memory CSRF token, envelope types), `src/services/queryClient.ts`, and one service object per feature (`authService.ts` + `auth.types.ts`, later `employeeService.ts` + `employee.types.ts`, …). Folders are created only when a real feature needs them.
- **Render errors:** the React root is created with `onCaughtError`, `onUncaughtError`, and `onRecoverableError` handlers that log only the error name (`reportRenderError`). React 19's default logs the full error object to the console, even in production.
- **Testing:** there is no separate testing phase. Each module ships with its own component tests (Vitest, React Testing Library, MSW) and, where it completes a user journey, a Playwright test, and is validated before it is Done (FRONTEND_PLAN.md module workflow).

## Rationale

- Vite's proxy satisfies ADR 004's same-site requirement without CORS or any backend change.
- TypeScript types mirroring API spec v2.1 catch contract drift early, such as money as strings and error codes.
- TanStack Query gives caching and consistent loading, empty, and error states with little code. Hand-written hooks would repeat that logic on every page.
- **State management (FD13):** almost all state is server data (TanStack Query). The only global client state is the session: small and rarely changing, which suits React Context. Redux Toolkit would add a store, slices, and boilerplate without shared client-side state to justify them, and RTK Query would duplicate TanStack Query. The full trade-off is in FRONTEND_PLAN.md (F1 findings, A2).
- react-bootstrap gives accessible Bootstrap components (modals, dropdowns, forms) without jQuery.
- MSW mocks at the network level, so component tests exercise the real API layer.

## Consequences

- Node 22 is selected through nvm (v22.12.0 is already installed). nvm's default on this machine is still v18.20.4, which is past end of life and too old for Vite 7, so every frontend command runs after `nvm use` in `frontend/`.
- E2E tests run against the real backend: the running Rails server with the development database and demo data. The HR credentials are passed as environment variables at run time. Playwright signs in once per run to respect the sign-in rate limit. Tests that write create `EMP-E2E-*` records, and `bin/rails demo:reset` restores the demo data.
- **Production serving is deferred** to the Docker/deployment phase. The built SPA must be served from the API's origin (for example Rails `public/` or a same-domain reverse proxy), with a fallback to `index.html` for client routes. That fallback would be a backend or proxy change, recorded as FRONTEND_PLAN.md gap G7. A cross-origin deployment (frontend and API on different URLs or IPs) would instead need CORS (`rack-cors` with an allowlist), an allow-listed CSRF origin check, cookie `SameSite`/`Secure` settings for the hosting, and HTTPS: an ADR 004/005 amendment decided at deployment. In development the Vite proxy keeps `changeOrigin: false`, so Rails' CSRF origin check matches and no CORS is needed (FRONTEND_PLAN.md F2 Q1).
- New frontend dependencies need an amendment to this ADR, as ADR 005 requires for gems.

## Alternatives considered

- **JavaScript instead of TypeScript:** less setup, but no compile-time check against the API contract.
- **Create React App or Next.js:** CRA is unmaintained. Next.js adds server rendering and a Node server that this same-site, API-driven SPA does not need.
- **Redux Toolkit (with RTK Query) for all state:** a predictable single store with DevTools, but heavier than this app needs (see FD13). Revisit if substantial shared client-only state appears.
- **Context API for server data as well:** no caching or request deduplication, and every consumer re-renders on change. Rejected in favour of TanStack Query.
- **Plain hooks instead of TanStack Query; Recharts instead of Chart.js; react-hook-form:** viable. They were not chosen because of more repeated code (plain hooks), a larger bundle (Recharts), or too few forms to justify a library (react-hook-form).
- **Chart.js with react-chartjs-2** (chosen at first, dropped in the F7 review, V8): the only chart is a 10-band distribution per currency. A canvas chart would still need a table as its text alternative, and it cannot render in jsdom, so component tests would have to mock it. A table with Bootstrap bars shows the same counts, is accessible as it stands, and adds no dependency.
- **Cross-origin frontend with CORS:** it would require amending ADR 004 (`SameSite=None; Secure` cookies and rack-cors), so it was rejected.
