# Salary Management System — Frontend Development Plan

**Purpose:** Phased implementation plan for the React frontend that consumes the completed Rails API (`BACKEND_PLAN.md`, Phases 1–7).

**Stack (ADR 006):** Node 22 LTS, Vite 7, React 19, TypeScript (strict), React Router 7, TanStack Query 5, Bootstrap 5.3 with react-bootstrap, Chart.js; Vitest, React Testing Library, and MSW; Playwright.

**Scope:** The UI for FR-01 to FR-07 (`docs/requirements.md`): sign-in, employee management, salary records and history, search/filters/pagination, compensation analytics, and reports with CSV export, for one HR Manager. It excludes the features in requirements §6 and **any Rails backend change** unless it is approved and recorded here (see the gaps).

## How to use this plan
1. Read `CLAUDE.md`, `.claude/rules/frontend/*`, ADR 006, and `docs/api-specification.md` (especially §13) before starting a subphase.
2. Complete one subphase at a time and verify its acceptance criteria before moving on.
3. Before a phase starts, review it: record findings, decisions, and tasks, as `BACKEND_PLAN.md` does.
4. Update each status and the completion log with changed files, tests actually run, and decisions.
5. Record API gaps and ambiguities here instead of silently expanding scope or changing the backend.

### Module workflow (every subphase from F2.2 on)
There is no separate testing phase: each module is built, tested, and validated before it is marked Done.
1. **Build:** the feature's API service (`src/services/<feature>Service.ts`), its query hooks, and its pages and components (`src/components/<feature>/`; reusable pieces in `src/components/common/`).
2. **Test the module:**
   - **component and unit tests** (Vitest, React Testing Library, and MSW with synthetic data) covering the loading, empty, error, and success states, validation feedback, and the display rules;
   - **its Playwright journey** when the module completes a user journey, run against the real Rails API and development database (FD7).
3. **Validate:** run `npm run lint`, `npm run typecheck`, `npm test`, and (if a journey changed) `npm run e2e`. Then check the module manually in the browser against the running Rails API with demo data.
4. **Record:** mark the tasks and status, and add a completion-log row with the exact commands and results.

A module is **Done** only when its own tests pass, the earlier modules' tests still pass, and the manual check matches the API.

**Status:** Not Started / In Progress / Blocked / Done

---

## Phase F1 — Frontend design and decisions
**Goal:** Agree on the frontend architecture, page map, API gaps, and Claude Code rules before any code.

### F1 review findings (2026-09-29)

Inputs:
- `CLAUDE.md`, `BACKEND_PLAN.md` (Phases 1–7 and "Future work");
- `docs/requirements.md` v1.2, architecture v2.3, database design v2.2, API spec v2.1, ADRs 001–005;
- the Rails routes and controllers;
- `.claude/` (rules, skills, commands); the owner's new rules in `.claude/rules/frontend/`; and the repository layout.

Observed:
- There is no `frontend/` directory yet, and no `.agents/` directory, so all Claude configuration is in `.claude/`.
- Node is v18.20.4 (past end of life) with npm 10.7.0; pnpm and yarn are not installed.

#### A. Decisions (approved by the owner 2026-09-29)

| ID | Decision |
|---|---|
| FD1 | **Node 22 via nvm.** The owner installed v22.23.3 through nvm on 2026-09-29 (after F2.1 found jsdom 30 needs ≥22.22.2); nvm's default is still v18.20.4. `frontend/.nvmrc` contains `22`, so `nvm use` in `frontend/` selects it; `engines` requires `>=22.22.2` (jsdom 30's minimum). Non-interactive shells run `source ~/.nvm/nvm.sh && nvm use` before npm commands |
| FD2 | **Strict TypeScript** |
| FD3 | **Stack:** Vite 7, React 19, React Router 7, TanStack Query 5, react-bootstrap with Bootstrap 5.3, Chart.js 4 with react-chartjs-2, Vitest, React Testing Library, user-event, MSW 2, Playwright, ESLint 9, and Prettier, all via npm (ADR 006) |
| FD4 | No form library and English only. State management: see FD13 |
| FD5 | **Display rules:** money as the API's strings with `currency_code`, labelled monthly; no cross-currency totals; no floating-point money (only for chart sizing); dates as the API gives them; the API's `status`/`editable` flags (`.claude/rules/frontend/data-display.md`) |
| FD6 | **(a)** Session and CSRF token in memory only. **(b)** List filters, sort, and page in the URL, **except `q`** |
| FD7 | **E2E tests run against the real backend:** the running Rails server (`bin/rails server`, `:3000`) with the development database and its demo data, with no separate database (owner decision 2026-09-29, replacing the earlier E2E database). <br>- **Credentials:** the owner's HR login, passed at run time as `E2E_HR_EMAIL`/`E2E_HR_PASSWORD` environment variables and never committed. <br>- **Rate limit:** Playwright signs in **once per run** (global setup) and reuses the session (`storageState`), to stay under the 5-per-minute sign-in limit. <br>- **Test data:** journeys that write create their own records with recognisable synthetic identifiers (e.g. `EMP-E2E-<timestamp>`) and never edit demo employees; reads use the demo data. The owner can restore the demo data with `bin/rails demo:reset` at any time |
| FD8 | API gaps G1–G7 accepted as below; no backend changes in this plan |
| FD9 | Production serving deferred to the Docker/deployment phase (G7) |
| FD10 | **Claude Code configuration:** <br>- the revised `.claude/rules/frontend/*` plus a new `data-display.md`; <br>- old `rules/frontend.md` deleted; <br>- path-scoped rules no longer `@`-imported in `CLAUDE.md`; <br>- new `skills/react-frontend`; testing skill extended; <br>- ADR 006; <br>- `CLAUDE.md` "Current Plan" set to this file |
| FD11 | **Accessibility and CI:** a practical WCAG 2.1 AA baseline (labels, keyboard use, contrast), checked with jsx-a11y and axe in Playwright. No CI (the workflow file is still inert, BACKEND_PLAN.md R5) |
| FD12 | The owner makes all commits. Dependencies are installed only in F2 |
| FD13 | **State management:** TanStack Query for server data, React Context for the session, local component state and the URL for UI state; no Redux (trade-off in A2 below). *Approved by the owner 2026-09-29* |

#### A2. State management trade-off (FD13)

The app has three kinds of state:
- **Server data:** employees, salary records, analytics, reports, and reference lists. This is almost all of the state, and it is owned by the API.
- **Session:** the signed-in user and the CSRF token. It is global but small, and changes only at sign-in, sign-out, or expiry.
- **UI state:** filters, sort, page, open dialogs, and form inputs. It is local to a page or kept in the URL.

| Option | Strengths | Weaknesses for this app |
|---|---|---|
| **React Context API** (built into React) | No dependency. Good for small, rarely changing global values: session user, CSRF token, sign-out action | Every consumer re-renders when the value changes, so it's a poor fit for frequently changing or large data. No caching, request deduplication, or loading/error tracking for API data |
| **Redux Toolkit** (store + slices; RTK Query for API data) | Predictable single store, DevTools and time-travel, middleware; RTK Query adds caching. It scales to large apps with many interdependent client-side states | Extra concepts (store, slices, reducers, actions) and boilerplate for an app whose state is mostly server data. Duplicates what TanStack Query already provides. Session data in a global store can show up in DevTools and logs |
| **TanStack Query** (server state) | Caching, deduplication, background refetch, and loading/error states per query; invalidates after a salary change or edit; small API | Only for server data, not client-only state (Context covers that) |
| **Local state + URL** (`useState`, React Router search params) | Simplest. Filters in the URL are shareable and work with the back button | Only for page-local state |

**Recommendation (FD13):**
- **TanStack Query** for all API data.
- **React Context** for the session only (`AuthProvider`: user, CSRF token, sign-in and sign-out; in memory, FD6a).
- **Local state and the URL** for UI state (filters in the URL except `q`, FD6b).
- **No Redux:** there is no complex client-side state shared across pages to justify it, and RTK Query would duplicate TanStack Query.

**When to revisit:** if a later scope adds substantial client-only shared state (e.g. multi-step bulk editing or offline drafts), Redux Toolkit or a light store (e.g. Zustand) becomes worth its cost; that would amend ADR 006.

#### B. API gaps (requirements vs API v2.1)

None block FR-01 to FR-07.

| # | Gap | Resolution (FD8) |
|---|---|---|
| G1 | The employee list has no salary column (D18, by design) | Pay listings use the **salary report** page; the list and the report link to each other |
| G2 | You can't list employees without a current salary (analytics gives only a count) | Accepted for v1. An optional backend filter later would be a scope change |
| G3 | Countries don't expose a home currency (it exists only in `backend/lib/reference_data.rb`) | The user picks the currency; the mapping is not hard-coded in React. Exposing it would be an optional later backend addition |
| G4 | `employment_status` accepts one value | Single-select filter |
| G5 | No salary-trend endpoint | Out of scope; `as_of` gives point-in-time views |
| G6 | The CSV cap is reported as JSON `422 export_too_large` | Download with `fetch`, check the status, then save the file (no plain link) |
| G8 | On create, if both the employee and the initial salary are invalid, the API reports only the employee's errors (its service saves the employee first and rolls back); salary errors appear on the next attempt (found in F5.3) | Accepted: nothing is created wrongly; the form shows each round's errors. Reporting both together would be an optional backend change |
| G7 | Production SPA serving and the client-route fallback are not defined | Deferred (FD9); ADR 006 consequences. **Decide at deployment, once the real URLs and IPs are known:** <br>- **(a) same origin** (Rails `public/` or a reverse proxy on one domain): no CORS, no backend auth change; <br>- **(b) cross-origin:** a separately approved backend change: `rack-cors` with an env allowlist, an allow-listed CSRF origin check, cookie `SameSite`/`Secure` per same-site or cross-site hosting, HTTPS (the production cookie is `Secure`), tests, and ADR 004/005 amendments. <br>The frontend works with either through `VITE_API_BASE_URL` (see F2 Q1) |

#### C. Assumptions
- Development uses the Vite proxy to `http://localhost:3000`, so the app is same-site with the API (ADR 004).
- The API contract is v2.1 as implemented and tested (245+ backend tests). Frontend work never edits `backend/`.
- The demo data (10,000 synthetic employees) drives manual testing; component tests use small synthetic MSW fixtures.
- Desktop-first responsive layout; Bootstrap breakpoints for tablets and phones.

#### D. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| Node 22.23.3 available in nvm (FD1) | F2 | In place (owner installed 2026-09-29) |
| Rails server running on `:3000` with demo data, and the HR login available as `E2E_HR_EMAIL`/`E2E_HR_PASSWORD` when E2E tests run (FD7) | F3.1 (first Playwright journey: sign-in) | Project owner |
| Backend running with demo data and an HR login | Manual checks from F3 on | Project owner (already in place) |

#### E. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Money shown or totalled wrongly across currencies | Medium / High | FD5 rules; component tests with JPY, KWD, and 2-decimal data |
| CSRF/session handling bugs (a stale token after sign-in; expiry) | Medium / High | One API client; tests for the token refresh and `401` handling; E2E sign-in journey |
| Contract drift between the frontend types and the API | Medium / Medium | Types mirror API spec v2.1; E2E runs against the real API |
| A shell on nvm's default Node 18 runs the npm scripts | Medium / Medium | `.nvmrc` plus `engines >=22.12` (npm warns on the wrong version); always `nvm use` in `frontend/` |
| Frontend scope creep (features the API lacks) | Medium / Medium | Gaps recorded here (G1–G7); no silent backend changes |
| Sensitive data leaking into URLs, storage, or logs | Low / High | FD6 and `frontend/security.md`; F8.2 security review |
| E2E tests leave records in the development database, or depend on demo data that has changed | Certain / Low | Writes use `EMP-E2E-*` records only; assertions on demo data avoid exact counts; `bin/rails demo:reset` restores the baseline |
| E2E runs hit the sign-in rate limit (`429`) | Medium / Low | One sign-in per run (`storageState`); the wrong-password test runs once |

### F1.1 Requirement → page map and API gap review
**Deliverables:** the page map below and gaps G1–G7.
**Status:** Done (2026-09-29)

| Page (route) | Requirements | API |
|---|---|---|
| Sign in (`/sign-in`) | FR-07 | `GET/POST /session` |
| Employees list (`/employees`) | FR-01, FR-04 | `GET /employees`, reference lists |
| New employee (`/employees/new`) | FR-01, FR-02 | `POST /employees` (optional `initial_salary`) |
| Employee detail (`/employees/:id`) | FR-01–FR-03 | `GET /employees/:id`, `GET …/salary_records`; salary change `POST`, correction `PATCH` (dialogs) |
| Edit employee (`/employees/:id/edit`) | FR-01 | `PATCH /employees/:id` (including termination) |
| Analytics (`/analytics`) | FR-05 | `GET /analytics/summary`, `/distribution`, `/breakdown` |
| Salary report (`/reports/salaries`) | FR-04, FR-06 | `GET /reports/salaries`, `.csv` |
| Not found (`*`) | — | — |

Sign-out is in the navigation bar (`DELETE /session`).

### F1.2 Architecture, stack, and folder structure
**Deliverables:** ADR 006 and the folder structure below.
**Status:** Done (2026-09-29)

**Structure (owner decision 2026-09-29, revised the same day; replaces the earlier `api/`/`auth/`/`features/`/`lib/` and `modules/` layouts):**

```
frontend/
  package.json, vite.config.ts (dev proxy /api → Rails), tsconfig*.json, eslint.config.js, playwright.config.ts, .nvmrc, index.html
  e2e/                      # Playwright journeys (+ support.ts, auth.setup.ts)
  src/
    components/
      common/               # reusable UI: ErrorAlert, LoadingState (later Pagination, DataTable, MoneyAmount, …)
      auth/                 # sign-in page, AuthProvider, auth context
      employees/            # employee list, detail, forms (F5)
      salaries/             # salary history, change and correction dialogs (F6)
      dashboard/            # compensation analytics dashboard (F7.1; Home placeholder in F3.2)
      reports/              # salary report and CSV export (F7.2)
    layouts/                # main layout, header, navbar, sidebar (F3.2)
    routes/                 # app routes (F3.2)
    hooks/                  # custom hooks: useAuth (now), useDocumentTitle (F3.2), …
    services/
      api.ts                # HTTP core: apiRequest(path, options), ApiError, in-memory CSRF token, envelope types
      queryClient.ts        # TanStack Query defaults
      authService.ts        # authService object (session endpoints) + auth.types.ts
                            # later: employeeService.ts + employee.types.ts, salaryService, analyticsService, reportService, referenceService
    test/                   # test-only support: MSW server and setup, render helper, fixtures (not app code; owner-approved 2026-09-29)
    App.tsx, main.tsx, env.d.ts
```

- Tests are co-located with the code they test (`*.test.ts(x)`).
- **Folders are created only when a feature needs them.** `layouts/` and `routes/` arrive in F3.2; `employees/`, `salaries/`, `dashboard/`, and `reports/` arrive in their own phases.

**Restructure (2026-09-29, owner decisions, two steps):** the F2 and F3.1 code was moved without changing behaviour. Current locations:
- HTTP core (`client`, `csrf`, `errors`, `types`) → one file, `src/services/api.ts`; `queryClient` → `src/services/queryClient.ts`;
- `session.ts` → the `authService` object in `src/services/authService.ts`, with types in `src/services/auth.types.ts`;
- sign-in page, `AuthProvider`, and auth context → `src/components/auth/`;
- `useAuth` → `src/hooks/`;
- `LoadingState` and `ErrorAlert` → `src/components/common/`.

Completed-task records below keep the paths as written at the time.

**Reusable components** (`src/components/common/`, used by more than one feature):
- **Layout and routing** (not in `common/`): `MainLayout`, `Header`, `Sidebar` in `src/layouts/` (R9a); `AppRoutes`, `RequireAuth` in `src/routes/`. A `PageHeader` is added to `common/` only once more than one page needs it.
- **Feedback:** `LoadingState`, `EmptyState`, `ErrorAlert`.
- **Tables:** `Pagination`, `SortableHeader`.
- **Filters and forms:** `SearchInput`, `CountrySelect`/`DepartmentSelect`/`EmploymentStatusSelect`/`CurrencySelect`, `FormField`.
- **Display and dialogs:** `MoneyAmount`, `DateText`, `EmploymentStatusBadge`, `SalaryStatusBadge`, `ConfirmDialog`.

**Feature components** (in `src/components/<feature>/`): the currency summary cards, distribution chart, and breakdown table (`dashboard/`); the CSV download button (`reports/`). The layout, header, and navigation live in `src/layouts/`.

### F1.3 Claude Code rules, skills, and project instructions
**Deliverables:** the configuration in FD10.
**Status:** Done (2026-09-29)

- **Rules** (`.claude/rules/frontend/`, all scoped to `frontend/src/**`): `react.md`, `components.md`, `api-integration.md`, `data-display.md` (new), `security.md` (frontend-specific; the root `security.md` still applies). The old `rules/frontend.md` is deleted; its unique lines were merged in.
- **Skills:** new `.claude/skills/react-frontend/SKILL.md`. `.claude/skills/testing/SKILL.md` now names Vitest, MSW, and Playwright and their commands. The `system-architecture` skill and the `/plan`, `/implement`, `/review`, and `/test` commands are reused unchanged.
- **`CLAUDE.md`:**
  - path-scoped rules (`testing.md`, `frontend/*`) are no longer `@`-imported, since they load by path;
  - "Current Plan" points here;
  - frontend commands added; "MySql" corrected to MySQL.

**F1 gate:** the owner reviews the F1 deliverables (ADR 006, this plan, and the `.claude/` changes) before F2 starts. **Passed 2026-09-29** (owner approval of the F2 decisions).

---

## Phase F2 — Foundation
**Goal:** A runnable frontend skeleton with the API client, tested as its own module.

### F2 review findings (2026-09-29)

Inputs: ADR 006, FD1–FD13, API spec v2.1 (§1–§2, §4, §10, §13), the backend session and CSRF configuration, the nvm and npm environment, and the current npm registry versions. No code written. Observed:
- There is no `frontend/` directory. nvm has Node **v22.12.0** (npm 10.9.0); its default is v18.20.4.
- **CSRF origin check (critical):** Rails has `forgery_protection_origin_check = true`, so a write is accepted only if the browser's `Origin` matches the scheme, host, and port Rails sees in `Host`. A spike against a spare Rails server (:3114, stopped afterwards) simulated a proxied sign-in with `Origin: http://localhost:5173` and a valid token:
  - `Host: localhost:5173` (what the Vite proxy sends with `changeOrigin: false`, its default) → `401 invalid_credentials` (CSRF passed; the credentials were deliberately wrong);
  - `Host: localhost:3114` (with `changeOrigin: true`) → **`422 invalid_csrf_token`**.
  So **every write through the proxy fails if `changeOrigin` is turned on**. Development `config.hosts` includes `.localhost`, so `Host: localhost:5173` is accepted. The session cookie is `SameSite=Lax` and not `Secure` in development, so it works through the proxy.
- **The registry has moved past ADR 006:**
  - Vite 8.3 (plugin-react 6.1), Vitest 5.0, MSW 3.0, TypeScript 7.0, ESLint 10.11, and React Router 8.4 are current.
  - React 19.3, TanStack Query 5.104, Bootstrap 5.3.8, react-bootstrap 2.10, Chart.js 4.5 (react-chartjs-2 5.3), Testing Library (react 16.3, user-event 14.6, jest-dom 7.0), jsdom 30, and Playwright 1.63 are also current.
- **Compatibility limits on Node 22.12.0:**
  - **React Router 8 needs Node ≥22.22.0** → use React Router 7.18 (Node ≥20).
  - **typescript-eslint supports TypeScript <6.1** → use TypeScript 6.0.3, not 7.
  - **eslint-plugin-jsx-a11y supports ESLint ≤9** → use ESLint 9.39, not 10.
  - Vite 8 (Node ^20.19 or ≥22.12), Vitest 5 (^22.12), and MSW 3 (≥22.12, TypeScript ≥5.9) are fine.
- Vite 8, Vitest 5, MSW 3, and TypeScript 6 are newer than parts of Claude's training data. Their configuration must be checked against the installed packages' own docs and types, not assumed.

#### A. Missing decisions

**Owner decisions (2026-09-29):** Q1 confirmed (dev proxy with `changeOrigin: false`, no CORS); Q2–Q12 approved as recommended.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| Q1 | **Proxy and CSRF.** | `server.proxy['/api'] = { target, changeOrigin: false }`: keep the browser's `Host`, so Rails' origin check matches (spike above). The target comes from `VITE_PROXY_TARGET` (default `http://localhost:3000`, used by the dev server only, never bundled), so Claude can validate against its own Rails on a spare port. F2.1 proves it with a proxied `GET /session` → `POST /session` returning `401 invalid_credentials`, not `422 invalid_csrf_token`. <br>**Why not CORS (owner decision 2026-09-29, recommendation followed):** <br>- through the proxy the browser talks to one origin, so CORS never applies; <br>- the failure seen with `changeOrigin: true` comes from Rails' CSRF **origin check**, which CORS settings don't affect; <br>- calling Rails directly cross-origin would need `rack-cors`, an allow-listed origin check in `BaseController`, `SameSite=None; Secure` cookies for cross-site hosts, and HTTPS in production: an ADR 004/005 amendment. <br>That is deferred to the deployment decision (G7) and would be a separately approved backend change | F2.1 |
| Q2 | **Version set (ADR 006 amendment).** | **Runtime:** React 19.3, react-dom 19.3, bootstrap 5.3.8, react-bootstrap 2.10, @tanstack/react-query 5.104. <br>**Tooling:** Vite 8.3 with @vitejs/plugin-react 6.1, TypeScript **6.0**, ESLint **9.39** with typescript-eslint 8.71, eslint-plugin-react-hooks 7, eslint-plugin-jsx-a11y 6.10, eslint-config-prettier 10, Prettier 3.9. <br>**Tests:** Vitest 5.0, jsdom 30, @testing-library/react 16.3, user-event 14.6, jest-dom 7.0, MSW 3.0. <br>**Later modules:** React Router **7.18** (F3.2), Chart.js 4.5 with react-chartjs-2 5.3 (F7.1), @playwright/test 1.63 (F3.1). <br>Caret ranges with the committed `package-lock.json`. If the owner later runs `nvm install 22` (≥22.22), React Router 8 becomes possible | F2.1 |
| Q3 | **When to install dependencies.** | Install per module, when first used, in keeping with the module workflow: <br>- **F2.1:** scaffold, tooling, the test runner, Bootstrap/react-bootstrap; <br>- **F2.2:** TanStack Query; <br>- **F3.1:** Playwright; <br>- **F3.2:** React Router; <br>- **F7.1:** Chart.js. <br>No unused packages sit in the tree | F2.1 |
| Q4 | **Scaffold method.** | `npm create vite@latest frontend -- --template react-ts`, then review every generated file: pin the Q2 versions, replace the template's ESLint config with ours, and delete the demo content (counter, logos, demo CSS). The alternative, hand-written files, is more error-prone with new majors | F2.1 |
| Q5 | **TypeScript strictness.** | `strict: true` plus `noUncheckedIndexedAccess`, `noUnusedLocals`/`Parameters`, and `noFallthroughCasesInSwitch`. Not `exactOptionalPropertyTypes` (friction with react-bootstrap props). `npm run typecheck` = `tsc -b --noEmit` (or the template's equivalent) | F2.1 |
| Q6 | **Import alias.** | `@/` → `src/` (tsconfig `paths` plus the Vite alias), to avoid long `../../..` paths across `features/` and `components/` | F2.1 |
| Q7 | **Lint and format.** | ESLint flat config: `@eslint/js` recommended, typescript-eslint `recommendedTypeChecked`, react-hooks, jsx-a11y `recommended`, and `eslint-config-prettier` last. Prettier defaults. Scripts: `lint` (ESLint, zero warnings allowed) and `format` (Prettier write) | F2.1 |
| Q8 | **Test runner setup** (the minimum for module tests). | Vitest in `vite.config.ts` (`environment: 'jsdom'`, `setupFiles: src/test/setup.ts`). The setup file registers jest-dom matchers, starts the MSW node server with `onUnhandledRequest: 'error'`, and resets handlers after each test. `src/test/server.ts` has an empty handler list; modules add their own handlers and fixtures. No coverage tool for now (as with the backend's N2; F8.1 uses a requirement → test matrix) | F2.1 |
| Q9 | **Environment files.** | `frontend/.env.example` documents `VITE_API_BASE_URL=/api/v1` and `VITE_PROXY_TARGET=http://localhost:3000`. `.env*.local` is git-ignored. `VITE_` variables are public, so never put secrets in them | F2.1 |
| Q10 | **API client contract (F2.2).** | **`src/api/client.ts`:** <br>- `apiRequest<T>(method, path, { query, body })`: base path from `VITE_API_BASE_URL` (default `/api/v1`), `credentials: 'same-origin'`, `Accept: application/json`, JSON bodies; <br>- `X-CSRF-Token` on `POST`/`PATCH`/`PUT`/`DELETE`, from an in-memory token store (`setCsrfToken`/`getCsrfToken`, FD6a); <br>- query strings drop `null`, `undefined`, and empty values; `204` → `undefined`. <br>**Errors:** a typed `ApiError { status, code, message, details? }` built from the envelope. A network failure becomes `status 0`, code `network_error`; a non-JSON or HTML response (e.g. a proxy `502`) becomes code `unexpected_response`. Messages never include payloads. <br>**`401`:** calls a registered `onUnauthorized` listener, which F3.1's `AuthProvider` sets. <br>**Not in F2.2:** endpoint modules (they arrive with their feature modules) and the CSV download helper (F7.2) | F2.2 |
| Q11 | **Query client defaults (F2.2).** | `retry`: at most 1 retry, and none for `4xx`. `refetchOnWindowFocus: false`, because each refetch is a signed-in request that refreshes the session idle timer (API §13), which the user should control. `staleTime` 30 s. Mutations never retry | F2.2 |
| Q12 | **Validation environment.** | Claude runs its own Rails server on a spare port (e.g. :3115) and Vite with `VITE_PROXY_TARGET` pointing at it, and stops both afterwards (pattern from the backend phases). `npm install` needs network access (already approved in FD12). `npm audit` output from the install is recorded, and `npm audit fix --force` is never run without owner approval | F2.1 |

#### B. Assumptions
- No backend changes. The proxy works with the current Rails configuration (spike above).
- Development only: the dev server on `localhost:5173`, Rails on `localhost:3000`. Production serving is deferred (FD9, G7).
- The module workflow applies from F2.2 on. F2.1 is the scaffold and has a smoke test only.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of Q1–Q12~~ Approved 2026-09-29 | F2.1 | Project owner |
| Node 22.12.0 via nvm | F2.1 | In place |
| Network access for `npm install` | F2.1, F2.2 | Approved (FD12) |
| Owner commits the scaffold, including `package-lock.json` | F2.2 | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Writes fail with `422 invalid_csrf_token` through the proxy | High if `changeOrigin` is on / High | Q1; the F2.1 proxied CSRF check; a comment in `vite.config.ts` |
| New majors (Vite 8/Rolldown, Vitest 5, MSW 3, TypeScript 6) differ from assumed configuration | Medium / Medium | Q4 scaffold from the official template; read the installed packages' docs and types; keep the config minimal; prove it by running lint, typecheck, test, and build |
| Peer-dependency conflicts (TypeScript 7, ESLint 10, React Router 8) | High if unpinned / Medium | Q2 version set; no `--force` or `--legacy-peer-deps` |
| A shell runs npm on Node 18 | Medium / Medium | `.nvmrc` = `22`, `engines >=22.12`, `nvm use` in every command |
| `npm audit` reports vulnerabilities in dev tooling | Medium / Low | Q12: record them; fix only with approval |
| Port 3000 or 5173 is taken by the owner's servers | Medium / Low | Q1 `VITE_PROXY_TARGET`; `--port` for Vite; spare ports for validation |

### F2.1 Scaffold and tooling
**Prompt:** `Per Q1–Q9 and Q12: scaffold frontend/ from the create-vite react-ts template, pin the Q2 versions, strict TypeScript (Q5) with the @/ alias (Q6), the ESLint + Prettier config (Q7), Bootstrap + react-bootstrap, the /api proxy with changeOrigin false and VITE_PROXY_TARGET (Q1), .nvmrc and engines, the Vitest + RTL + MSW setup with a smoke test (Q8), .env.example (Q9), and npm scripts. Amend ADR 006 with the actual versions. No features.`
**Tasks:**
1. ~~Owner: approve Q1–Q12.~~ Approved 2026-09-29.
2. ~~Scaffold with create-vite (Q4); review and trim; `.gitignore`.~~ Done 2026-09-29: `create-vite@9.2.1 --template react-ts --eslint` (the default is now Oxlint). Demo files removed (`App.css`, `index.css`, `assets/`, `public/icons.svg`); `.gitignore` adds coverage, playwright-report, and test-results.
3. ~~`package.json`, `engines`, scripts, `.nvmrc`.~~ Done 2026-09-29. The template's ESLint 10 and `@types/node` 24 were replaced with the Q2 set; `engines` `>=22.22.2`; scripts `dev`, `build`, `preview`, `test`, `test:watch`, `lint` (`--max-warnings=0`), `format`, `typecheck`.
4. ~~tsconfig (Q5, Q6); `vite.config.ts` (Q1, Q8); ESLint and Prettier (Q7).~~ Done 2026-09-29. `strict` was **not** set in the template's `tsconfig.app.json`; it is added explicitly with `noUncheckedIndexedAccess`.
5. ~~`main.tsx` (Bootstrap CSS), minimal `App.tsx`, `src/test/setup.ts`, `src/test/server.ts`, smoke test.~~ Done 2026-09-29.
6. ~~Validation.~~ Done 2026-09-29; see the status.
7. ~~Docs: ADR 006 amendment; `CLAUDE.md` commands.~~ Done 2026-09-29.

**Deliverables:** Scaffold, tooling, scripts, the test runner, and the ADR 006 amendment.
**Acceptance:**
- `npm run dev` serves the app, and `/api/v1/health` through the proxy returns `200`.
- A proxied write passes the CSRF origin check (`401 invalid_credentials`, not `422`).
- lint (zero warnings), typecheck, build, and `npm test` pass under Node 22.
**Status:** Done (2026-09-29).
- **Checks under Node v22.23.3 (npm 10.9.9):**
  - `npm install`: 455 packages, **0 vulnerabilities**, no engine warnings. The one deprecation notice is ESLint 9 (accepted, Q2).
  - `npm run format`, `typecheck`, `lint`, `test` (1 file, 1 test), and `build` all exit 0. Build: JS 221.5 kB (69.4 kB gzip), CSS 230.1 kB (30.7 kB gzip), mostly Bootstrap.
  - **Lint rules proven:** a throwaway file with a floating promise and an `<img>` without `alt` produced 2 errors (typescript-eslint type-checked and jsx-a11y); the file was deleted.
- **Proxy (Q1):** Claude's Rails on :3115 and Vite on :5180 with `VITE_PROXY_TARGET=http://localhost:3115`:
  - app page `200`; `GET /api/v1/health` via the proxy `200` `{"status":"ok","database":"ok"}`;
  - proxied `GET /session` → `POST /session` (Origin `http://localhost:5180`, valid token, wrong password) → **`401 invalid_credentials`** (CSRF origin check passed);
  - both servers stopped; ports free.

Notes:
- **Node:** the review checked Vite, Vitest, and MSW against 22.12.0 but missed **jsdom 30** (Node ≥22.22.2) and its dependencies (undici 8 ≥22.19, whatwg-url ≥22.14). The owner installed **v22.23.3** through nvm, which cleared every engine warning. React Router 8 (Node ≥22.22) is now possible and will be decided in F3.2.
- **MSW 3 API change:** `server.listen({ onUnhandledRequest })` is now **`onUnhandledFrame`** (it covers requests and WebSocket frames). This was found by typecheck and checked against the installed type definitions.
- **Prettier:** defaults, as approved in Q7 (double quotes, semicolons), applied to the scaffold.
- The template's `eslint-plugin-react-refresh` is kept (it catches Fast Refresh issues in Vite).

### F2.2 API client module
**Prompt:** `Per Q10–Q11: implement src/api/client.ts, the in-memory CSRF token store, ApiError, the onUnauthorized hook, src/api/types.ts (error envelope, pagination meta), and the TanStack Query client with the Q11 defaults. Module workflow: unit tests with MSW, then lint, typecheck, and test.`
**Tasks:**
1. ~~Install `@tanstack/react-query` (Q3).~~ Done 2026-09-29 (5.104.0; 0 vulnerabilities).
2. ~~`src/api/client.ts`, `src/api/csrf.ts`, `src/api/errors.ts`, `src/api/types.ts`.~~ Done 2026-09-29, plus `src/env.d.ts` (typed `VITE_API_BASE_URL`).
3. ~~`src/lib/queryClient.ts` (Q11), with `QueryClientProvider`.~~ Done 2026-09-29. The provider is in `src/main.tsx`, wrapping `App`.
4. ~~Tests (MSW).~~ Done 2026-09-29: `src/api/client.test.ts` (15 tests) and `src/lib/queryClient.test.tsx` (5 tests).
5. ~~Validation: lint, typecheck, test; smoke test still passes.~~ Done 2026-09-29.

**Deliverables:** The API client and query client, with tests.
**Acceptance:** All client tests pass, together with lint, typecheck, and the full `npm test`.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**3 files, 21 tests**, including the F2.1 smoke test), and `build` all exit 0. JS bundle 246.6 kB (76.8 kB gzip) with TanStack Query.
- **Mutation checks** (file restored each time):
  - with the CSRF header removed, "sends X-CSRF-Token and a JSON body on writes" fails;
  - with any `401` treated as signed out, "does not treat a failed sign-in (401 invalid_credentials) as an expired session" fails.
- **Manual check:** not applicable yet, since no UI calls the client. The proxy path to the real API was verified in F2.1, and the client first runs against the real API in F3.1 (sign-in journey).

**Tests cover:**
- a GET with query building (empty values dropped), `Accept`, and `credentials: same-origin`;
- the `X-CSRF-Token` header and JSON body on writes; no token on reads;
- `204` → `undefined`; the `VITE_API_BASE_URL` override;
- `401 unauthenticated` calls the handler; `401 invalid_credentials` does not;
- `422` `details` kept; `invalid_csrf_token`; `429`; `400`;
- network failure → `network_error` (status 0); an HTML `502` or a non-JSON `200` → `unexpected_response`;
- no password, salary, or email in the thrown error (message, string, JSON, stack);
- an aborted request re-throws the `AbortError` (no `network_error`);
- `shouldRetryQuery` (4xx never, 5xx and network once); a real `useQuery` with a `404` makes 1 request and with a `500` makes 2; no refetch on focus; mutations never retry.

Notes:
- **URL resolution:** the client resolves the base path against `window.location.origin`. In the browser this is the same origin; in tests it gives Node's `fetch` the absolute URL it requires.
- **Only `401 unauthenticated` triggers the signed-out handler.** A wrong password (`401 invalid_credentials`) must not show "session expired" on the sign-in page.
- **An aborted request is re-thrown unchanged, not reported as `network_error`,** so TanStack Query can cancel queries silently. The first version checked `instanceof DOMException`, which fails across realms (jsdom's class vs Node's `fetch` error), so an abort was misreported. The test added for it caught this; the client now checks `signal.aborted` and the error name.
- **`VITE_PROXY_TARGET`** is read only in `vite.config.ts` (dev server), so it isn't declared in `src/env.d.ts`.

**F2 gate: passed on 2026-09-29.** The skeleton runs against the real API through the proxy, including a CSRF-checked write (F2.1), and the API client and query client are tested (F2.2).

**Phase gate:** The skeleton runs against the real API through the proxy (including a CSRF-checked write); the client is tested.

---

## Phase F3 — Authentication and app shell
**Goal:** Secure sign-in and sign-out, protected navigation, and consistent handling of session expiry.

### F3 review findings (2026-09-29)

Inputs:
- API spec v2.1 §4 (session), §10 (codes), §13 (client notes);
- ADR 004 and the backend `SessionsController` / `Api::Authentication`;
- ADR 006, FD6–FD13, and the F2 client (`apiRequest`, `setUnauthorizedHandler`, the CSRF store);
- the React Router 7 and 8 releases and Playwright 1.63.

No code written. Observed:
- **Session contract:**
  - `GET /session` → `{data: {authenticated, user: {email} | null, csrf_token}}`;
  - `POST /session` takes an **unwrapped** `{email, password}` (the backend reads `params[:email]`; `wrap_parameters false`) and needs `X-CSRF-Token`; success `200` returns a **new** token, because the session is reset at sign-in;
  - failures: `401 invalid_credentials` (same for an unknown email or a wrong password) and `429 rate_limited` (5 per minute per IP);
  - `DELETE /session` → `204` and resets the session, so the old token is dead and a fresh `GET /session` is needed before the next sign-in.
- **Expiry:** after 30 minutes idle or 8 hours total, the next request returns `401 unauthenticated`. Every signed-in request, `GET /session` included, refreshes the idle timer (7.1 F4).
- **React Router:** 7.18.4 (dist-tag `version-7`) and 8.4.0 (`latest`, first released 2026-06-17) were both published on 2026-09-15. React Router 8 needs Node ≥22.22 (now met: 22.23.3) and React ≥19.2.7 (19.3 installed).
  - The 8.0 changelog (read from the package tarball) removes only data/framework-mode flags and APIs (future flags, middleware, `meta` `data`, `hasErrorBoundary`) and the `react-router-dom` package.
  - **Declarative mode is unaffected:** `BrowserRouter`, `MemoryRouter`, `Routes`, `Route`, `Navigate`, `Outlet`, `Link`, `NavLink`, `useNavigate`, `useLocation`, and `useSearchParams` are all exported by 8.4.0 (checked in the tarball).
- **Components:** F3 needs a loading state and an error alert (session bootstrap, sign-in errors) before F4.1, which plans them.
- **E2E credentials:** Playwright needs an HR login. Claude does not have the owner's password (FD7 passes it at run time), so Claude's own E2E runs need another way in.
- **Error boundaries:** React still requires a class component for them (there is no hook). This is the one exception to "functional components".

#### A. Missing decisions

**Owner decisions (2026-09-29):** R1–R15 approved as recommended (React Router 8.4, the R5 client retry, the R12 Chromium download, the R13 temporary dev user for Claude's E2E runs).

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| R1 | **React Router version.** | **8.4** in declarative mode, imported from `react-router` (the only package in v8). It is current, supports our Node and React, and none of its breaking changes touch declarative APIs. Amend ADR 006 (it said 7.x). The alternative is 7.18: equally maintained today, but it will age out first | F3.2 |
| R2 | **Session API and state.** *(Current files after the 2026-09-29 restructure: `src/services/authService.ts` (an `authService` object; `signIn({ email, password })`) with `src/services/auth.types.ts`; the provider and context in `src/components/auth/`; `useAuth` in `src/hooks/`.)* | **`src/api/session.ts`:** `getSession()`, `signIn(email, password)` (unwrapped body), `signOut()`, and a `Session` type. **`src/auth/AuthProvider.tsx`** (React Context, FD13): <br>- reads the session through a TanStack Query (`["session"]`, `staleTime: Infinity`); the query function stores `csrf_token` in the in-memory store; <br>- exposes `status` (`loading` / `signedIn` / `signedOut`), `user` (email only), `signIn`, `signOut`, and a one-off `notice` (`expired` / `signedOut`). <br>Passwords never enter context, the cache, or storage | F3.1 |
| R3 | **Startup.** | Until the first `GET /session` resolves, show a full-page loading state. If it fails (network error or `5xx`), show an error with **Retry**, not the sign-in page, so that "API down" is not confused with "signed out" | F3.1 |
| R4 | **Token lifecycle.** | `GET /session` sets the token. A successful sign-in **replaces** it with the returned token. After sign-out or expiry, the token is cleared and `GET /session` is fetched again for a fresh anonymous token, so signing in again works without a page reload | F3.1 |
| R5 | **Automatic recovery from `invalid_csrf_token`** (API §13: fetch a new token). | Add a hook to the F2 client (`setCsrfRefresher`). On `422 invalid_csrf_token` for a write, the client fetches `GET /session` once, stores the new token, and **retries the request once**; a second failure is surfaced. This is safe because Rails rejects the request before the action runs. The retry is bounded to one, so it can't loop. This is a small F2 client change with its own tests | F3.1 |
| R6 | **What signing out clears.** | On `401 unauthenticated` (the F2 handler) or sign-out: `queryClient.clear()` removes **all cached employee and salary data** from memory, the token is cleared, the session is fetched again, and the user goes to `/sign-in` with a notice: "Your session has expired. Please sign in again." or "You have signed out." | F3.1 |
| R7 | **Return to the requested page after sign-in.** | `RequireAuth` redirects to `/sign-in` with `state.from` = the requested path and search (which never contains `q`, FD6b). After sign-in, go there **only if it is an internal path** (starts with `/`, not `//`), which prevents open redirects; otherwise go to `/`. An already signed-in user who opens `/sign-in` is redirected to `/` | F3.1 / F3.2 |
| R8 | **Sign-in form.** | <br>- **Fields:** email (`type="email"`, `autocomplete="username"`) and password (`autocomplete="current-password"`), labelled, with required checks only. <br>- **While submitting:** the button is disabled and shows "Signing in…". <br>- **Errors:** `invalid_credentials` → the API's generic message; `rate_limited` → "Too many sign-in attempts. Wait a minute and try again."; network → a generic message. <br>- **Privacy:** the password is cleared after a failure and never logged | F3.1 |
| R9 | **Routes in F3.2.** | <br>- `/sign-in` (public); <br>- a protected layout route with `/` (a **Home placeholder** linking to the areas built so far; F5.1 turns it into a redirect to `/employees`) and `*` (not found). <br>The navigation bar shows only areas that exist (no dead links) and the signed-in email with a **Sign out** button | F3.2 |
| R9a | **Layout (owner decision 2026-09-29, amends R9's top navigation bar).** | **Option (b):** <br>- `src/layouts/MainLayout.tsx`: page frame with the skip link and `<main id="main">`; <br>- `src/layouts/Header.tsx`: app name, the signed-in email, **Sign out**, and on small screens a button that opens the sidebar; <br>- `src/layouts/Sidebar.tsx`: feature navigation (`NavLink`, `aria-current`), showing only built areas. It is a fixed column on large screens and a react-bootstrap `Offcanvas` (keyboard- and screen-reader-accessible) on small screens. <br>No separate `Navbar.tsx`: the header and sidebar cover it ("only files that are needed") | F3.2 |
| R10 | **Error boundary.** | A small class component (React requires one; the documented exception to the functional-components rule), with no new dependency. It shows a generic message and a **Reload** button. It never logs payloads, only the error name, and only in development | F3.2 |
| R11 | **Accessibility baseline in the shell.** | A "Skip to main content" link; one `<main id="main">`; a document title per page (a small `useDocumentTitle` hook); `NavLink` active state with `aria-current` | F3.2 |
| R12 | **Playwright setup (F3.1).** | <br>- **Install:** `@playwright/test` 1.63, **Chromium only** (`npx playwright install chromium` downloads the browser to the user cache, outside the repo). <br>- **Config:** `baseURL` `http://localhost:5173` (`E2E_BASE_URL` overrides it). The `webServer` starts Vite (`npm run dev`, reusing a running one). Playwright does **not** start Rails: it tests the real backend that is already running (FD7; `VITE_PROXY_TARGET` for another port). <br>- **One sign-in per run:** a setup project signs in once through the UI and saves `storageState` to `playwright/.auth/`, which is **git-ignored** because it holds a live session cookie. <br>- Specs live in `e2e/`; the command is `npm run e2e` | F3.1 |
| R13 | **Credentials for Claude's E2E runs.** | Same pattern as backend 6.2 N9 b: Claude creates a **temporary user** (`e2e-runner@example.test`, random password in environment variables only) in the dev DB before its run and deletes it afterwards, checking `User.count` before and after. The owner runs with their own credentials. Each run uses at most **3 sign-ins** (setup, the sign-in journey, wrong password), under the 5-per-minute limit; back-to-back runs within a minute may get `429`, so Claude waits between runs | F3.1 |
| R14 | **Tests for F3** (module workflow). | **Component tests** (MSW, `MemoryRouter`): <br>- AuthProvider: loading, signed in and out, token replacement, the R5 refresh-and-retry, the R6 cache clear and notice; <br>- sign-in page messages (`401`, `429`, network) and the R7 return path, including rejecting an external `from`; <br>- `RequireAuth` redirect; nav links and sign-out; not found; the error boundary. <br>**E2E:** <br>- sign in → see the app → sign out; <br>- wrong password → generic error; <br>- opening a protected URL while signed out → sign-in → back to that URL. <br>Queries by role and label, not test IDs | F3.1 / F3.2 |
| R15 | **Bring two F4.1 components forward.** | Add minimal `LoadingState` and `ErrorAlert` (maps an `ApiError` to a safe message) to `src/components/feedback/` in F3.1. F4.1 extends them instead of recreating them | F3.1 |

#### B. Assumptions
- **No backend change.** The dev DB already has the owner's HR user; Rails runs on `:3000` for the owner (Claude uses spare ports).
- The Vite proxy keeps `changeOrigin: false` (Q1); F2.1 verified a CSRF-checked write through it.
- F3 builds only the shell and authentication. The pages for employees, analytics, and reports come in F5–F7 and appear in the navigation when they exist.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of R1–R15~~ Approved 2026-09-29 | F3.1 | Project owner |
| Network access for `npm install` and the Chromium download | F3.1, F3.2 | Approved (FD12) |
| The owner's HR credentials as `E2E_HR_EMAIL`/`E2E_HR_PASSWORD` when **the owner** runs `npm run e2e` | Owner's runs | Project owner |
| Commit of the F2 work | F3.1 (clean starting point) | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Cached salary data stays in memory after sign-out or expiry | Medium / High | R6 `queryClient.clear()`, with a test |
| Open redirect through the sign-in return path | Low / Medium | R7 internal-path check, with a test for an external `from` |
| A token-refresh loop on repeated `invalid_csrf_token` | Low / Medium | R5 bounded to one refresh and one retry, with a test |
| E2E runs hit the `429` sign-in limit | Medium / Low | R12 one sign-in per run; R13 at most 3 attempts and waits between runs |
| The saved session file (`storageState`) is committed | Low / High | R12 `playwright/.auth/` in `.gitignore`, checked with `git check-ignore` |
| React Router 8 behaves differently from what Claude expects | Low / Medium | Declarative mode only; the API was checked in the tarball; typecheck, component tests, and E2E prove it |
| "API down" is shown as "signed out" | Medium / Medium | R3 separate startup error with Retry |
| Flaky E2E timing | Medium / Low | Playwright's auto-waiting assertions; no fixed sleeps |

### F3.1 Session, sign-in, and sign-out
**Prompt:** `Per R2–R8 and R12–R15: session API module; AuthProvider (React Context + TanStack Query, in-memory token, R4 lifecycle, R6 cache clear and notices); the R5 CSRF refresh-and-retry in the F2 client; sign-in page (R8) with the R7 return path; startup loading and error states (R3); LoadingState and ErrorAlert (R15); Playwright (R12) with this module's journeys. Module workflow: component tests (MSW), E2E, validate, record.`
**Tasks:**
1. ~~Owner: approve R1–R15.~~ Approved 2026-09-29.
2. ~~`src/api/session.ts` and the R5 `setCsrfRefresher` hook in `src/api/client.ts`, with tests.~~ Done 2026-09-29.
3. ~~`LoadingState` and `ErrorAlert` (R15), with tests.~~ Done 2026-09-29, plus a `userMessage()` helper in `src/api/errors.ts` (API message for 4xx; generic text for 5xx and unknown errors).
4. ~~`src/auth/AuthProvider.tsx`, `useAuth.ts` (R2–R4, R6), with tests.~~ Done 2026-09-29 (context and key in `authContext.ts`).
5. ~~`src/features/auth/SignInPage.tsx` (R8), with tests; a minimal route setup.~~ Done 2026-09-29. Without a router yet, `App.tsx` chooses the screen from the session status (loading, startup error with Retry, sign-in, signed-in view). **The R7 return-path check moves to F3.2**, where the router and `RequireAuth` arrive.
6. ~~Playwright (R12).~~ Done 2026-09-29: `@playwright/test` 1.63.0 plus Chromium; `playwright.config.ts` (the port comes from `E2E_BASE_URL`; Vite only, never Rails); `e2e/support.ts`, `e2e/auth.setup.ts`, `e2e/auth.spec.ts`; `playwright/.auth/` git-ignored; `npm run e2e`.
7. ~~Validation.~~ Done 2026-09-29; see the status.
8. ~~Record.~~ Done 2026-09-29 (this entry; ADR 006 end-to-end row).

**Acceptance:**
- Sign-in, sign-out, and expiry work against the real API.
- The token is replaced after sign-in and recovered after `invalid_csrf_token`.
- Cached data is cleared on sign-out and expiry.
- All component tests and the E2E journeys pass; lint, typecheck, and build are clean.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**6 files, 44 tests**), and `build` all exit 0. JS bundle 285.5 kB (89.2 kB gzip).
- **E2E against the real API** (Claude's Rails on :3116 with the dev database, Vite on :5182, R13 temporary user `e2e-runner@example.test`): `npm run e2e` → **4 passed** in 7.5 s:
  - setup (sign in once and save the session);
  - the saved session opens the app;
  - sign in → app → sign out;
  - a wrong password → the generic error, with the password cleared.
  - **3 sign-ins** in total.
- **Visual check** (Playwright screenshots, reviewed):
  - the startup loading state (centred spinner);
  - the sign-in page (centred card, labelled fields, full-width button);
  - the signed-in view (heading, email, Sign out).
- **Mutation check:** with cache clearing disabled in `AuthProvider`, both the sign-out and expiry tests fail; restored.
- **Temporary user:** `User.count` was 1 before and 2 during. The script's cleanup trap **hung** (its exit trap never finished the Rails step), so Claude stopped the stuck processes and deleted the user by hand: **deleted=1, `User.count` = 1**, the user is gone, the saved-session file is removed, and ports 3116, 5182, and 5183 are free.

Notes:
- **Accessibility fix found by a test:** react-bootstrap's `isInvalid` only adds a CSS class, so the sign-in fields now set `aria-invalid` explicitly. Screen readers are told a field is invalid.
- **Test fake for the session endpoints** (`src/test/fixtures/sessionBackend.ts`): stateful, and, like Rails, it issues a new token on every session response and rejects writes with a stale token. This lets token replacement, R5 recovery, sign-out, and expiry be tested realistically.
- **Sign-out clears local state even if `DELETE /session` fails** (e.g. network). Nothing stays on screen or in memory, and the server session expires on its own.
- **Lint scope:** React-specific rules (hooks, react-refresh, jsx-a11y) now apply to `src/` only; `e2e/` and config files keep the TypeScript rules.
- **For the owner's runs:** start Rails, then run `E2E_HR_EMAIL=<email> E2E_HR_PASSWORD=<password> npm run e2e` in `frontend/`. Wait a minute between back-to-back runs (3 sign-ins per run, limit 5 per minute).

### F3.2 Layout, navigation, and routing
**Prompt:** `Per R1, R7, R9–R11, R14: install React Router 8.4; BrowserRouter with the F1.1 routes that exist now (sign-in, Home placeholder, not found) in src/routes; RequireAuth; MainLayout + Header + Sidebar in src/layouts (R9a: sidebar navigation with built areas only, offcanvas on small screens; header with user email and sign out); error boundary (class component); skip link, main landmark, document titles. Module workflow: component tests, E2E (protected URL → sign-in → return), validate, record.`
**Tasks:**
1. ~~Install `react-router` 8.4 (R1); amend ADR 006.~~ Done 2026-09-29 (8.4.0, 0 vulnerabilities).
2. ~~Routes, layout, pages, error boundary, title hook.~~ Done 2026-09-29:
   - `src/routes/AppRoutes.tsx`, `RequireAuth.tsx`, and `returnPath.ts` (the R7 internal-path check);
   - `src/layouts/MainLayout.tsx`, `Header.tsx`, `Sidebar.tsx` (R9a; a responsive `Offcanvas` at the `lg` breakpoint);
   - `src/components/dashboard/HomePage.tsx`;
   - `src/components/common/NotFoundPage.tsx`, `ErrorBoundary.tsx`, `reportRenderError.ts`;
   - `src/hooks/useDocumentTitle.ts`;
   - `BrowserRouter` in `main.tsx`. `App.tsx` gates routing on the startup session state (R3); `SignInPage` redirects signed-in users to the safe return path.
3. ~~Tests.~~ Done 2026-09-29: `routes/returnPath.test.ts`, `routes/routing.test.tsx`, `layouts/MainLayout.test.tsx`, plus the NotFound, ErrorBoundary, and reporter tests in `components/common/common.test.tsx`. `src/test/render.tsx` gained a `MemoryRouter` (`route` option) and `currentLocation()`; `src/test/screenSize.ts` stubs `matchMedia`.
4. ~~E2E.~~ Done 2026-09-29: `e2e/navigation.spec.ts` (unknown URL → not found → sidebar Home; protected URL signed out → sign-in → back to the same URL).
5. ~~Validation.~~ Done 2026-09-29; see the status.
6. ~~Record.~~ Done 2026-09-29.

**Acceptance:** Only signed-in users reach app pages; navigation, not-found, and error boundary behave as specified; all tests and E2E pass.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**9 files, 60 tests**), and `build` all exit 0. JS bundle 344.9 kB (108.9 kB gzip), adding React Router and the react-bootstrap `Offcanvas`.
- **E2E against the real API** (Claude's Rails on :3119, Vite on :5185, R13 temporary user): **6 passed** in 4.5 s, with 4 sign-ins in the run:
  - setup; saved session;
  - sign in → sign out; wrong password;
  - unknown URL → not found → sidebar Home;
  - protected URL → sign-in → the same URL.
- **Cleanup in explicit steps, verified:** deleted=1, `User.count` = 1, no saved-session file, ports free.
- **Mutation check:** with the open-redirect guard disabled, the unit test and "ignores an external return path" fail; restored.
- **Visual check** (throwaway Playwright script, screenshots reviewed):
  - desktop 1280×720: dark header with brand, email, and Sign out; static sidebar; Home;
  - phone 390×780: Menu button, email hidden; Menu opens the "Navigation" offcanvas with a close button.
  - The active link had no visual highlight, so the sidebar now uses the `pills` variant. That change was re-validated by tests but not re-screenshotted.

Notes:
- **Security finding (fixed):** React 19's default `onCaughtError` calls `console.error(error)`, even in production (checked in `react-dom-client.production.js`), which would print error messages to the console. `main.tsx` now sets `onCaughtError`/`onUncaughtError`/`onRecoverableError` to `reportRenderError` (name only), and `ErrorBoundary` no longer logs itself.
- **Accessibility finding (fixed):** react-bootstrap's `Navbar` adds `role="navigation"` when it isn't rendered as `<nav>`, so the header would have been a second, unlabelled navigation landmark. `Header` is now a plain `<header>` (banner) with Bootstrap navbar classes.
- **jsdom has no `matchMedia`,** which the responsive `Offcanvas` needs. `src/test/screenSize.ts` stubs it: "large" by default, "small" for the menu test.
- **Lint:** the fast-refresh rule is off for `src/test/**` and `*.test.tsx` only (test support mixes helpers and components).
- **After explicit sign-out,** `RequireAuth` records the current page, so signing in again returns there (the same as after expiry).

**F3 gate: passed on 2026-09-29.**
- Only signed-in users reach app pages (the route walk in the component tests; E2E protected URL → sign-in).
- Sign-in, sign-out, expiry, and CSRF recovery work end to end against the real API (F3.1).
- Routing, layout, not-found, and the error boundary behave as specified (F3.2).

**Phase gate:** Only signed-in users reach app pages; expiry and sign-out work end to end.

---

## Phase F4 — Shared components
**Goal:** Reusable, accessible building blocks, each tested as it is built.

### F4 review findings (2026-09-29)

Inputs: API spec v2.1 (§2.3 pagination, §2.4 sorting, §5 reference data, §6.1 employee list, §8.1 analytics filters, §9 report, §13 client notes); `.claude/rules/frontend/*` (especially "no abstraction used once" and "create files only when a real feature needs them"); the F5–F7 subphases; and the code after F3. No code written. Observed:
- **Reference data (§5):** `GET /countries` → `{id, code, name}` by name; `/departments` → `{id, name}`; `/currencies` → `{code, name, minor_units}` by code. Unpaginated, read-only, and seeded. **Employment statuses have no endpoint:** they are a fixed enum in the contract (`active`, `on_leave`, `terminated`; §6.1).
- **Lists (§2.3–2.4):**
  - `page` is 1–1,000,000 and `per_page` 1–100 (default 25); a page past the end returns empty `data` with correct `meta`;
  - `sort=field` / `-field` against a **per-endpoint allowlist**: employees `employee_number` (default), `last_name`, `hired_on`, `created_at`; report `employee_number`, `last_name`, `amount`;
  - **invalid values return `400`** (never silently corrected).
- **Shared filters:**
  - employees: `q`, `country_id`, `department_id`, `employment_status` (default: all statuses);
  - analytics: `as_of`, `country_id`, `department_id`, `employment_status` (default `active` + `on_leave`);
  - report: the analytics filters plus `q`.
- **Money:** a decimal string already rounded to the currency's minor units (JPY `"250000"`, KWD `"1500.125"`), always with `currency_code`, monthly.
- **Already built:** `LoadingState` and `ErrorAlert` (F3.1, R15). The sign-in form has its own inline field and error markup (the first form in the app).
- **Tension with the "only when needed" rule:** F4 builds components before any page uses them. The components below are justified by **confirmed consumers** in F5–F7:

| Component | Consumers | Keep in F4? |
|---|---|---|
| `Pagination` | employee list (F5.1), salary report (F7.2) | Yes |
| `DataTable` with sortable headers | employee list, salary report (and possibly the history table, F6.1) | Yes (S2) |
| `SearchInput` | employee list, salary report | Yes |
| Country / department / status selects | employee filters and form (F5), dashboard (F7.1), report (F7.2) | Yes |
| `CurrencySelect` | new-employee initial salary (F5.3), salary change and correction (F6.2) | Yes |
| `MoneyAmount` | employee detail (F5.2), history (F6.1), dashboard (F7.1), report (F7.2) | Yes |
| `EmploymentStatusBadge` | employee list and detail (F5), report (F7.2) | Yes |
| `EmptyState` | lists, dashboard, report | Yes |
| `FormField` + 422 mapping | sign-in (existing), employee forms (F5.3), salary dialogs (F6.2) | Yes |
| `SalaryStatusBadge` | salary history only (F6.1) | **No:** move to `components/salaries/` in F6.1 |
| `DateText` | none needed: dates are shown as the API's `YYYY-MM-DD` strings | **Drop** |
| `ConfirmDialog` | no confirmed use (no deletes; salary change and correction are already form dialogs) | **Defer** until a feature needs it |
| `PageHeader` | not needed yet (a heading per page) | **Defer** (as in F1.2) |

#### A. Missing decisions

**Owner decisions (2026-09-29):** S1–S13 approved as recommended (scope per the consumer map, generic `DataTable`, URL list state rules, string-only money formatting).

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| S1 | **Scope of F4.** | Build only the components marked "Yes" above. Drop `DateText`; move `SalaryStatusBadge` to F6.1; defer `ConfirmDialog` and `PageHeader`. Keep props minimal (what F5–F7 need), and revisit them when the first consumer (F5.1) uses them. The alternative, folding F4 into F5 (building each piece with its first page), was rejected: the pieces serve 2–4 features and are easier to test in isolation | F4.1 |
| S2 | **`DataTable`** (the owner's "datatable"). | A generic `DataTable<Row>` in `components/common/`. <br>- **Configured by** a column list (`header`, `cell(row)`, optional `sortField`), plus `rows`, a `caption`, and `sort`/`onSortChange`. <br>- **States:** renders loading (`LoadingState`), error (`ErrorAlert` with Retry), and empty (`EmptyState`). <br>- **Sorting is server-side only:** a header click emits `field` / `-field`, and the column shows `aria-sort`. <br>- **Not included:** client sorting, row selection, or column hiding. <br>Sortable headers live inside `DataTable`, with no separate `SortableHeader` file (one consumer) | F4.2 |
| S3 | **`Pagination`.** | Reads the API `meta`. <br>- **Navigation:** First, Previous, Next, and Last buttons, plus "Page 2 of 378" (no numbered page list, which would add little at 10k rows). <br>- **Range text:** "Showing 26–50 of 9,429". <br>- **Page size:** a selector (25, 50, 100). <br>- **Accessibility:** `<nav aria-label="Pagination">`; buttons disabled at the ends. <br>- **A page past the end** (possible after filtering): an empty state with "Go to first page" | F4.1 |
| S4 | **List state in the URL: `hooks/useListParams`.** | Keeps `page`, `per_page`, `sort`, and the filters (`country_id`, `department_id`, `employment_status`, `as_of`) in the URL query string (FD6b); `q` stays in component state only. <br>- **Invalid or tampered values** are replaced by defaults before the request (page not a positive integer or over 1,000,000; `per_page` not 25/50/100; a sort not in the caller's allowlist; a non-numeric ID; an unknown status; a malformed date), so a hand-edited URL never causes a `400` loop. <br>- **Resets:** changing a filter, `q`, or `per_page` resets `page` to 1. <br>- **History:** page moves add history entries; filter changes replace the current one | F4.1 |
| S5 | **`SearchInput`.** | A labelled text input with `maxLength={100}` (the API limit), a Clear button, and a **300 ms debounce**; Enter searches immediately. It emits a trimmed value; an empty value means "no search" | F4.1 |
| S6 | **Reference data service and hooks.** | **Service:** `services/referenceService.ts` (object: `getCountries`, `getDepartments`, `getCurrencies`) with `services/reference.types.ts` (`Country`, `Department`, `Currency`, and the `EmploymentStatus` enum with its labels). **Hooks:** `hooks/useReferenceData.ts` (`useCountries`, `useDepartments`, `useCurrencies`) with `staleTime: Infinity`: loaded once per session and cleared on sign-out (R6). **Statuses:** the fixed enum is used (no endpoint exists; the values come from API §6.1, not a business rule) | F4.1 |
| S7 | **Selects.** | `components/common/ReferenceSelects.tsx` exports `CountrySelect`, `DepartmentSelect`, `EmploymentStatusSelect`, and `CurrencySelect`: one file, four small components over a shared inner select. <br>- **Common props:** a label, and a value that is the ID or code as a string. <br>- **Filter mode** (an "All …" option) or **form mode** (required, with a "Choose …" placeholder and an `error`). <br>- **While loading:** disabled, "Loading…". **On error:** disabled, with a short message. <br>- **Currency options** show `code — name` | F4.1 |
| S8 | **`MoneyAmount`.** | Shows the API string with thousands separators added by **string manipulation** (no float), followed by the currency code: `85,000.00 INR`, `250,000 JPY`, `1,500.125 KWD`. <br>- **Currency code, not symbols:** `$` is ambiguous between USD and SGD. <br>- **"/ month" suffix:** optional (`monthly` prop), used where no column header already says "Monthly". <br>- An unexpected string is shown as-is | F4.2 |
| S9 | **`EmploymentStatusBadge`.** | Labels: Active (`success`), On leave (`warning`), Terminated (`secondary`). The text is always shown, so meaning doesn't depend on colour | F4.2 |
| S10 | **Forms: `FormField` and `fieldErrors`.** | **`FormField`:** a label, the control, and invalid feedback, with `aria-invalid` and `aria-describedby` wired (the F3.1 lesson). **`fieldErrors(error)`:** maps a `422 validation_failed` `ApiError.details` to `{ field: "message" }`, keeping nested keys such as `initial_salary.amount`. Refactor `SignInPage` to use `FormField` (its second consumer) | F4.2 |
| S11 | **`EmptyState`.** | A message plus an optional action (e.g. "Clear filters"), announced politely (`role="status"`) | F4.1 |
| S12 | **Count formatting.** | Record counts (not money) use `Intl.NumberFormat("en-US")`, e.g. "9,429", through a small `formatCount` in `components/common/format.ts`. It is shared by `Pagination` and later the dashboard counts | F4.1 |
| S13 | **Testing and validation.** | Each component is tested in isolation (React Testing Library), and the hooks with `renderHook` plus `MemoryRouter`. `referenceService` is tested with MSW. `MoneyAmount` has JPY, KWD, 2-decimal, and large-value cases, and a test that it never uses `Number`. **No E2E or screenshots in F4:** no page uses these components yet. Their first real-API and visual check is F5.1 (employee list), recorded there | F4.1 / F4.2 |

#### B. Assumptions
- **No backend change.** Reference data and list parameters work exactly as API v2.1 specifies.
- The component list is final for F5–F7 as planned. A new shared need found later is added in the subphase that needs it (the module workflow), not in advance.
- English labels only (FD4). Numbers use en-US grouping (e.g. `9,429`, `85,000.00`).

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of S1–S13~~ Approved 2026-09-29 | F4.1 | Project owner |
| F3 committed (clean starting point) | F4.1 | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Components designed ahead of use don't fit F5–F7 | Medium / Medium | S1 consumer map; minimal props; revisit in F5.1 |
| `DataTable` grows into an over-engineered grid | Medium / Medium | S2 scope: server sorting, states, and caption only |
| A tampered or stale URL causes repeated `400`s | Medium / Low | S4 sanitises URL values against the caller's allowlist |
| Money shown wrongly (float rounding, lost decimals, wrong grouping) | Low / High | S8 string-only formatting; tests with JPY, KWD, and large values |
| Search sends too many requests (each one refreshes the idle timer) | Low / Low | S5 300 ms debounce; `maxLength` 100 |
| Accessibility regressions in tables and forms | Medium / Medium | Caption, `th scope`, `aria-sort`, a labelled pagination nav, and `FormField` ARIA wiring, each with a test |

### F4.1 Data, lists, and filters
**Prompt:** `Per S1, S3–S7, S11–S13: referenceService + reference.types.ts and useReferenceData hooks; ReferenceSelects (country, department, employment status, currency) in components/common; useListParams (URL state, sanitised, q excluded) in hooks; SearchInput; Pagination; EmptyState; formatCount. Tests for each; lint, typecheck, test, build.`
**Tasks:**
1. ~~Owner: approve S1–S13.~~ Approved 2026-09-29.
2. ~~`src/services/referenceService.ts`, `src/services/reference.types.ts`, with MSW tests.~~ Done 2026-09-29. `reference.types.ts` holds `Country`, `Department`, `Currency`, and the `EMPLOYMENT_STATUSES` enum with its labels and `isEmploymentStatus`.
3. ~~`src/hooks/useReferenceData.ts` and `src/hooks/useListParams.ts`, with tests.~~ Done 2026-09-29.
4. ~~`src/components/common/ReferenceSelects.tsx`, `SearchInput.tsx`, `Pagination.tsx`, `EmptyState.tsx`, `format.ts`, with tests.~~ Done 2026-09-29.
5. ~~Validation.~~ Done 2026-09-29; see the status.
6. ~~Record.~~ Done 2026-09-29.

**Acceptance:** Every S3–S7, S11, S12 behaviour has a test; invalid URL values never reach the API; lint, typecheck, and build are clean.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**15 files, 90 tests**; 30 new), and `build` all exit 0. The bundle is unchanged (344.9 kB), because no page uses the new components yet.
- **Mutation checks** (file restored each time):
  - `q` written to the URL → "keeps the search text out of the URL" fails;
  - sort not checked against the allowlist → "replaces tampered or invalid values" fails.
- **No E2E or screenshots, by design (S13):** no page uses these components yet. Their first real-API and visual check is F5.1.

**Tests cover:**
- `referenceService`: lists, and error pass-through.
- `useReferenceData`: one request shared by consumers.
- `useListParams`:
  - defaults, valid URL values, and tampered values (page, per_page, sort, IDs, status, date; unknown keys ignored);
  - the page cap and impossible dates;
  - a filter change resets the page (history replace); page moves push history; defaults are left out of the URL;
  - `q` never reaches the URL.
- `ReferenceSelects`: filter options and the chosen ID; loading; load error; form mode (required, placeholder, `aria-invalid`, accessible description); statuses without a request.
- `SearchInput`: the exact 300 ms debounce (fake timers), Enter at once without a second call, Clear, `maxLength` 100, the visible label.
- `Pagination`: range text with grouping, button states at both ends, a partial last page, no results, past the end → first page, page size.
- `EmptyState` and `formatCount`.

Notes:
- **`useListParams` API:** `useListParams({ sortFields, defaultSort, filters })` returns `page`, `perPage`, `sort`, `filters`, `q`, a ready-to-send `query`, and setters. Filters not listed for a page are ignored even if present in the URL.
- **Test support:** `src/test/fixtures/referenceData.ts` (synthetic lists with request counters) and a `renderWithQueryClient` helper in `src/test/render.tsx`.
- **Selects:** one file, four small components over a shared inner `SelectField`. Form mode wires `aria-invalid` and `aria-describedby` itself; F4.2's `FormField` covers text inputs.
- **Lint lesson:** in tests, `act(() => vi.advanceTimersByTime(n))` returns a value and picks React's async `act`, a floating promise. Use a block body.

### F4.2 Tables, display, and forms
**Prompt:** `Per S2, S8–S10, S13: DataTable (columns, server-side sort with aria-sort, loading/error/empty states, caption), MoneyAmount (string-only grouping, currency code, optional monthly), EmploymentStatusBadge, FormField + fieldErrors (422 details), and refactor SignInPage onto FormField. Tests for each; lint, typecheck, test, build; the sign-in E2E still passes.`
**Tasks:**
1. ~~`DataTable.tsx`, `MoneyAmount.tsx`, `EmploymentStatusBadge.tsx`, `FormField.tsx`, and `fieldErrors`, with tests.~~ Done 2026-09-29. `formatMoney` lives in `components/common/format.ts` next to `formatCount`, so component files export only components.
2. ~~Refactor `SignInPage` onto `FormField`; existing tests unchanged.~~ Done 2026-09-29. The sign-in tests (26 across auth, routing, and layout) passed without edits.
3. ~~Validation, including `npm run e2e` with the R13 temporary user and explicit cleanup.~~ Done 2026-09-29; see the status.
4. ~~Record.~~ Done 2026-09-29.

**Acceptance:** Every S2 and S8–S10 behaviour has a test; money is never converted to a number; the sign-in page behaves exactly as before (unit and E2E); lint, typecheck, and build are clean.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**18 files, 107 tests**; 17 new), and `build` all exit 0. JS bundle 344.8 kB (109.0 kB gzip).
- **E2E against the real API** (Claude's Rails on :3120, Vite on :5186, temporary user): **6 passed** in 4.3 s, including the sign-in journeys on the refactored form.
- **Cleanup in explicit steps, verified:** deleted=1, `User.count` = 1, no saved-session file, ports free.
- **Mutation check:** with float-based formatting (`Number(...).toLocaleString`), "values beyond floating-point precision stay exact" fails; restored.

**Tests cover:**
- `DataTable`: caption name, `th scope`, rows; `aria-sort` on the sorted column only; the sort cycle; no button on non-sortable columns; loading, error + Retry, and empty + action states; `aria-busy` while refreshing.
- `formatMoney` / `MoneyAmount`: grouping with exact decimals (JPY, KWD, 2-decimal); a value beyond float precision; unexpected strings unchanged; the currency code; the optional "/ month".
- `EmploymentStatusBadge`: labels and variants.
- `FormField`: label, pass-through props, `aria-invalid`, and the error + hint description.
- `fieldErrors`: 422 details including nested keys and joined messages; `{}` for other errors.

Notes:
- **`FormField` typing:** `ComponentProps<typeof Form.Control>` loses the `onChange` event type through react-bootstrap's polymorphic typing (implicit `any`). `FormField` is typed as `FormControlProps` plus the standard input attributes.
- **Sort indicators** (▲ ▼ ↕) are `aria-hidden`; screen readers get the sort state from `aria-sort` on the header.
- **`fieldErrors` joins several messages** for one field with "; " (e.g. "must be greater than 0; must have at most 2 decimal places for this currency").

**F4 gate: passed on 2026-09-29.** The shared components (S1 consumer map) are built and tested in isolation (F4.1, F4.2), follow the data-display rules (string-only money, currency codes, labelled statuses) and the accessibility rules (labels, `aria-invalid`/`aria-describedby`, `aria-sort`, captions, a labelled pagination nav), and the refactored sign-in page still passes its unit and E2E tests. The first page-level use and visual check is F5.1.

**Phase gate:** Shared components are tested and follow the display and accessibility rules.

---

## Phase F5 — Employees
**Goal:** Search, view, create, and update employees (FR-01, FR-04).

### F5 review findings (2026-09-29)

Inputs: API spec v2.1 §6.1–§6.4 (list, detail, create, update), §2 (pagination and sort), §10, §13; requirements FR-01, FR-02 (initial salary), FR-04, D14, D18, I13; the F1.1 page map; gaps G1 and G3; the F3/F4 code (routes, layout, `useListParams`, `DataTable`, `Pagination`, `SearchInput`, selects, `FormField`, `fieldErrors`, `MoneyAmount`, `EmploymentStatusBadge`). No code written. Observed:
- **List (§6.1):**
  - items: `{id, employee_number, first_name, last_name, country{id,code,name}, department{id,name}, employment_status, hired_on}`, with **no email or salary** (D18);
  - filters `q`, `country_id`, `department_id`, `employment_status` (default: all statuses); sort `employee_number` (default), `last_name`, `hired_on`, `created_at`.
- **Detail (§6.2):** adds `email`, `current_salary` (`{id, amount, currency_code, period, effective_from, effective_to}`, or `null` when nothing is in effect today), and timestamps.
- **Create (§6.3):**
  - body wrapped in `employee`, with an optional `initial_salary` created in the same transaction (D14);
  - `422` field errors use the request field names (`country_id`, `department_id`, `initial_salary.amount`, `initial_salary.currency_code`); the API upper-cases `employee_number` and lower-cases `email`; `employment_status` defaults to `active`.
- **Update (§6.4):** any subset of the same fields except `initial_salary`; salary never changes here. Moving `hired_on` after the first salary start → `422` (I13). Returns `404` or `422`.
- **There is no delete:** termination is `employment_status = terminated`.
- **Not in F5:**
  - the salary report page (G1) does not exist until F7.2, so the "link to the salary report" from the list is **added in F7.2** (no dead links, R9);
  - salary history belongs to F6 (salaries).
- **Home page:** F3.2's Home placeholder was meant to become a redirect to `/employees` in F5.1 (R9 note).

#### A. Missing decisions

**Owner decisions (2026-09-29):** T1–T11 approved as recommended.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| T1 | **Routes and Home.** | Routes: `/employees` (list), `/employees/new`, `/employees/:id`, `/employees/:id/edit`. `/` redirects to `/employees`. **Remove the Home placeholder** (`components/dashboard/HomePage.tsx`): the dashboard arrives in F7.1 at `/dashboard`, and whether `/` points there instead is decided in F7.1. The sidebar lists **Employees** (replacing Home) | F5.1 |
| T2 | **Service and types.** | `services/employeeService.ts` (object: `list(query)`, `get(id)`, `create(input)`, `update(id, changes)`) and `services/employee.types.ts` (`EmployeeSummary`, `EmployeeDetail`, `CurrentSalary`, `EmployeeInput`, `InitialSalaryInput`, and the list query type), mirroring §6 | F5.1 |
| T3 | **Query keys and cache.** | `["employees", "list", query]` with `placeholderData: keepPreviousData` (the previous page stays visible, and `DataTable` shows busy while the next loads); `["employees", "detail", id]`. After a create or update, the detail cache is set from the response and `["employees", "list"]` is invalidated | F5.1 |
| T4 | **List page.** | **Columns:** Employee number (a link to the detail page), Name shown as "Last, First" (matching the `last_name` sort), Country, Department, Status (badge), Hired on. **Sortable:** number, name, hired on. **Controls:** search (`q`), country, department, and status filters, Clear filters, a **New employee** button, pagination. **Empty:** "No employees match these filters." with Clear filters. **Never shows email or salary** (D18, tested). `created_at` sort is supported by the API but not shown as a column (no use case) | F5.1 |
| T5 | **Back to the list keeps the filters.** | Links from the list carry the current list URL in `location.state.from` (path and search; no `q`, FD6b). The detail page's "Back to employees" uses it when it is an internal `/employees` path, otherwise plain `/employees` | F5.2 |
| T6 | **Detail page.** | **Heading:** "Last, First (EMP-…)". **Profile:** number, name, email (or "—"), country, department, status badge, hired on. **Current salary:** `MoneyAmount` with "/ month" and "Effective from …", or **"No salary in effect today"**. **Actions:** Edit, Back. A **404** (or a non-numeric ID, which is never requested) shows "Employee not found" (generic, no ID echoed). **Salary history and the change and correction actions are added to this page by F6** (in `components/salaries/`), so F5 doesn't build a history summary | F5.2 |
| T7 | **Create and edit form.** | One `components/employees/EmployeeForm.tsx` for both, with fields: <br>- employee number (max 20, with a hint "Letters, digits, and '-'"); first and last name (max 100); email (optional, `type="email"`); <br>- country and department (required selects); status (form select, default Active on create); hired on (`type="date"`, optional). <br>**Client checks are basic only** (required fields; the browser's email and date inputs); formats and uniqueness are left to the API's `422` (not duplicated). **Errors:** `422` details → fields via `fieldErrors`; anything else → `ErrorAlert` | F5.3 |
| T8 | **Initial salary on create (D14).** | An "Add initial salary" switch reveals: amount (a **text** input with `inputMode="decimal"`, never `type="number"`, so no float or locale conversion), currency (`CurrencySelect`; the user chooses, G3), and effective from (date, defaulting to the hired-on date if set). The API validates the decimal places per currency; `initial_salary.*` errors map to these fields. Everything is sent in one request; if anything fails, nothing is created | F5.3 |
| T9 | **Edit sends only changed fields.** | The update sends only the fields that changed (the API accepts any subset), and Save stays disabled until something changes. Clearing email sends `""` (the API stores `null`). **Termination** = changing status to Terminated in this form (no delete). The I13 error shows under Hired on | F5.3 |
| T10 | **After saving.** | Create → go to the new employee's detail page with "Employee created."; edit → back to the detail page with "Changes saved." These notices are passed in navigation state (shown once, `role="status"`). Cancel returns to the detail page (edit) or the list (create). No "unsaved changes" prompt (not required) | F5.3 |
| T11 | **E2E and test data** (FD7). | **F5.1 (read-only on demo data):** list loads; country filter + search; sort by name; next page; open a detail page. **F5.3:** create `EMP-E2E-<base36 timestamp>` (at most 20 characters) with an initial salary → detail shows it → edit its department → "Changes saved.". Demo employees are never edited. Tests reuse the saved session (no extra sign-ins) | F5.1 / F5.3 |

#### B. Assumptions
- **No backend change.** API v2.1 §6 covers all of FR-01 and FR-04.
- The employee list defaults to **all** statuses (§6.1); analytics and reports keep their own defaults (§13).
- Created E2E employees stay in the dev database (FD7); `bin/rails demo:reset` restores the demo data.
- The screens are validated against the 10k demo data (one page at a time; no list loads all employees).

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of T1–T11~~ Approved 2026-09-29 | F5.1 | Project owner |
| F4 components and hooks | F5.1–F5.3 | Done |
| Commit of F4 + F5 (the owner commits them together) | — | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Email or salary leak into the list | Low / High | D18; the list type has no such fields; a test asserts none are rendered |
| Money typed or sent as a float | Low / High | T8 text input; the string is sent as typed; the API validates scale |
| Filters lost when going back from detail | Medium / Low | T5 `state.from` |
| Editing overwrites fields that weren't touched | Low / Medium | T9 changed fields only |
| E2E test data mixes with demo data | Certain / Low | T11 `EMP-E2E-*` prefix; demo rows never edited; `demo:reset` |
| Slow list at 10k rows | Low / Low | Server pagination (25 by default); `keepPreviousData`; measured at 9–72 ms (backend 6.2) |

### F5.1 Employee list
**Prompt:** `Per T1–T4 and T11: employeeService + employee.types.ts; routes /employees (and / → /employees; remove the Home placeholder; sidebar "Employees"); EmployeeListPage in components/employees with DataTable, SearchInput, the filter selects, Clear filters, New employee (link to /employees/new, which arrives in F5.3), and Pagination via useListParams. Module workflow: component tests (MSW), E2E on demo data, screenshot, record.`
**Tasks:**
1. ~~Owner: approve T1–T11.~~ Approved 2026-09-29.
2. ~~`employeeService.ts` + `employee.types.ts`, with MSW tests.~~ Done 2026-09-29.
3. ~~`EmployeeListPage`; routes and sidebar; remove the Home placeholder.~~ Done 2026-09-29. Also added `components/employees/useEmployees.ts` (query keys and hooks, T3). `/` redirects to `/employees`, the sidebar lists Employees, and NotFound links to the employee list. The "New employee" button arrives with its page in F5.3 (no dead links).
4. ~~Tests.~~ Done 2026-09-29: `services/employeeService.test.ts` and `components/employees/EmployeeListPage.test.tsx`; the auth, routing, layout, and common tests were updated for the Home removal.
5. ~~E2E, screenshot, validation, record.~~ Done 2026-09-29, run together with F5.2 (the list → detail journey spans both); see F5.2.

**Acceptance:** The list works on the real 10k demo data with search, filters, sort, and pagination; no email or salary is shown; all tests and E2E pass.
**Status:** Done (2026-09-29).

Notes:
- **Bug found by a test (fixed):** "Clear filters" called `clearFilters()` and `setQ("")` in the same tick. React Router's `setSearchParams(fn)` works from the params captured at render, not a queued value, so the second update overwrote the first and the filters stayed. `useListParams.clearFilters()` now clears the filters **and** the search text in one update (also covered in `useListParams.test.tsx`).
- **Flaky test found and fixed at the root:** a request started at the end of one test (the fresh-token fetch after expiry) could land on the next test's mock handlers, occasionally breaking a token-counting assertion (seen once in about 10 runs). `src/test/setup.ts` now waits for every test query client to be idle, then clears it, before unmounting and resetting MSW (`settleQueryClients` in `src/test/render.tsx`). Verified with 6 consecutive full runs, 3 of them shuffled.
- **Test support:** default MSW handlers (`src/test/fixtures/defaultHandlers.ts`) serve the reference lists and an empty employee list to every test. Tests override them with `server.use`, and unmocked requests still fail. Also `employees.ts` and `employeeDetail.ts` fixtures.
- **Accessibility fix found by E2E:** the search box's "Clear" button and "Clear filters" shared the name "Clear". The search button's accessible name is now "Clear search" (visible text still "Clear"). Playwright label and role matching is substring-based, so E2E locators use `exact: true` where names overlap.

### F5.2 Employee detail
**Prompt:** `Per T5–T6: EmployeeDetailPage in components/employees: heading, profile, current salary (MoneyAmount, monthly, effective from) or "No salary in effect today", Edit and Back (keeps list filters via state.from), and a generic "Employee not found" for 404 or non-numeric IDs. Tests, E2E step, screenshot, record.`
**Tasks:**
1. ~~`EmployeeDetailPage.tsx` and its route.~~ Done 2026-09-29, plus `useEmployee`, `parseEmployeeId`, and `employeeListReturnPath` in `useEmployees.ts`. Edit arrives with its page in F5.3.
2. ~~Tests.~~ Done 2026-09-29: `components/employees/EmployeeDetailPage.test.tsx` (11 tests).
3. ~~E2E, screenshot, validation, record.~~ Done 2026-09-29.

**Acceptance:** Detail matches API §6.2; missing employees are handled generically; Back keeps the list's filters; all tests pass.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**21 files, 130 tests**), and `build` all exit 0. JS bundle 361.4 kB (114.2 kB gzip).
- **E2E against the real API and the 10k demo data** (Claude's Rails on :3123, Vite on :5189, temporary user): **8 passed** in 6.9 s. New in F5:
  - the list searches ("EMP-0001"), keeps the search text out of the URL, filters by India, sorts by name, and pages to "Showing 26–50";
  - filter On leave → open the first employee → detail shows their profile and current salary → Back returns to the same filtered URL.
  - Two earlier runs failed on the ambiguous "Clear" and "Search" names (fixed above). Each run's temporary user was deleted and verified (`User.count` = 1, no saved-session file, ports free), and there was a 65 s wait before the final run for the sign-in rate limit.
- **Visual check** (screenshots reviewed): the list on real data (filters row, sort indicators, "Last, First", badges, no email or salary); the detail page (Back link, "Baumbach, Summer (EMP-00001)", Profile card, "6,495.91 SGD / month, Effective from 2012-05-10").

### F5.3 Create and edit employee
**Prompt:** `Per T7–T10: EmployeeForm (shared), EmployeeCreatePage (optional initial salary, T8) and EmployeeEditPage (changed fields only, T9); 422 details mapped to fields incl. initial_salary.*; notices after saving; cache update and list invalidation (T3). Tests, E2E (create EMP-E2E-* with initial salary, then edit), screenshots, record.`
**Tasks:**
1. ~~`EmployeeForm.tsx`, `EmployeeCreatePage.tsx`, `EmployeeEditPage.tsx`, and routes.~~ Done 2026-09-29, plus `employeeFormValues.ts` (form values, required checks, create body, changed fields). The "New employee" button (list) and "Edit" button (detail) arrive with their pages.
2. ~~Tests.~~ Done 2026-09-29:
   - `employeeFormValues.test.ts` (4 tests);
   - `EmployeeCreatePage.test.tsx` (6 tests): required checks with no request; create without and with an initial salary (effective from pre-filled from the hire date; amount a decimal text input sent as typed); `422` on `employee_number` and `initial_salary.amount`; Cancel; the New employee button;
   - `EmployeeEditPage.test.tsx` (7 tests): current values and Save disabled; changed fields only; clear email plus terminate; I13 error under Hired on; Cancel; not found; the Edit button.
3. ~~E2E, screenshots, validation, record.~~ Done 2026-09-29.

**Acceptance:** Employees can be created (with or without an initial salary) and updated against the real API, with field-level validation feedback; nothing is created on failure; all tests and E2E pass.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**24 files, 147 tests**), and `build` all exit 0. JS bundle 369.6 kB (116.2 kB gzip).
- **E2E against the real API** (Claude's Rails on :3124, Vite on :5190, temporary user): **10 passed** in 8.6 s. New:
  - create `EMP-E2E-*` with an INR initial salary → "Employee created." and "85,000.00 INR / month" → edit department → "Changes saved." and Finance shown;
  - a duplicate `EMP-00001` → the real API's "has already been taken" under Employee number, nothing created, still on `/employees/new`.
- **Cleanup verified:** temporary user deleted (`User.count` = 1), no saved-session file, ports free. **Data added by this run: exactly one employee, `EMP-E2E-MUMY73UI`** (FD7). The dev database also holds `SUMIT`, which is not from Claude's runs.
- **Mutation check:** with the edit sending every field, 3 edit tests fail; restored.
- **Visual check** (screenshot reviewed): the create form with the real API error (alert, the field error with its icon, hint) and the initial-salary section (switch, amount, currency, effective from).

Notes:
- **API behaviour observed (G8, no change made):** when both the employee and the initial salary are invalid, the API reports only the employee's errors. Its create service saves the employee first and rolls back as soon as that fails, so salary errors (e.g. JPY decimals) appear on the next attempt. Nothing is ever created wrongly; it only means two rounds of errors. A backend change would be needed to report both together.
- **Native date inputs** show the browser's locale format (e.g. dd/mm/yyyy), but the value sent is always `YYYY-MM-DD`.
- **Lint:** `mutationFn: employeeService.create` was flagged as an unbound method; it now uses an arrow function.

**F5 gate: passed on 2026-09-29.** Search, filter, sort, page, view, create (with an optional initial salary), and edit (including termination) work against the real API and the 10k demo data, with field-level validation feedback from the API; the list never shows email or salary; all 147 component tests and 10 E2E journeys pass.

**Phase gate:** The employee journeys work against the API with correct validation feedback; all module tests pass.

---

## Phase F6 — Salary history
**Goal:** View history and record changes without losing it (FR-02, FR-03).

### F6 review findings (2026-09-29)

Inputs: API spec v2.1 §7 (salary records), §10, §13; requirements FR-02, FR-03, D4, D6, D8, O1, I13; ADR 003; `.claude/rules/frontend/data-display.md`; the F5 detail page and F4 components. No code written. Observed:
- **Endpoints (§7):** `GET /employees/:id/salary_records` (full history, newest first, unpaginated); `POST` (salary change); `PATCH …/:record_id` (correction). There is **no delete**, and a record of another employee → `404`.
- **Record:** `{id, employee_id, amount, currency_code, period, effective_from, effective_to, status, editable, created_at, updated_at}`. **`status`** is `current`, `scheduled`, or `historical`, and **`editable`** (true for current and scheduled; O1) are computed by the API. The frontend uses them as given (data-display rules; no date maths).
- **Salary change (POST):**
  - `amount`, `currency_code`, and `effective_from` are all required;
  - `effective_from` must be **after the latest record's start** (D8) and not before `hired_on` (I13);
  - the API closes the previous period at `effective_from − 1 day` in the same transaction; future dates give `scheduled` records (D6); a changed currency is allowed.
- **Correction (PATCH):** only `amount` and/or `currency_code`. Sending a date → `422 "cannot be changed"`; a historical record → **`422 salary_record_not_editable`**, which can also happen if a record's period ends between loading and saving.
- **A salary change affects more than the history:** it also affects the detail page's `current_salary` and the analytics and reports (F7).
- **`GET …/salary_records/:id`** (a single record) has no UI need, so it is not used.

#### A. Missing decisions

**Owner decisions (2026-09-29):** U1–U9 approved as recommended.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| U1 | **Service and types.** | `services/salaryService.ts` (object: `list(employeeId)`, `change(employeeId, input)`, `correct(employeeId, recordId, changes)`) and `services/salary.types.ts` (`SalaryRecord`, `SalaryStatus`, `SalaryChangeInput`, `SalaryCorrectionInput`). No single-record `get` (not needed) | F6.1 |
| U2 | **Where history lives.** | A **"Salary history" section on the employee detail page**, below Profile and Current salary (`components/salaries/SalaryHistory.tsx`), reusing `DataTable` (no sorting; API order newest first). Columns: Effective from, Effective to ("—" for open-ended), Monthly amount (`MoneyAmount` with its own currency per row), Status, Actions (Correct, only when `editable`). Caption "Salary history". Each row shows its own currency, so a currency change over time is visible and never totalled | F6.1 |
| U3 | **`SalaryStatusBadge`** (moved here by S1). | `components/salaries/SalaryStatusBadge.tsx`: Current (`success`), Scheduled (`info`, dark text), Historical (`secondary`). Text always shown; the label comes from the API's `status` | F6.1 |
| U4 | **Query keys and refreshing after a write.** | History: `["employees", id, "salary-records"]`. After a change or correction: update the history, **invalidate the employee detail** (its `current_salary` may change), and invalidate the `["analytics"]` and `["reports"]` prefixes (for F7; harmless before then). The employee list shows no salary, so it isn't touched | F6.1 / F6.2 |
| U5 | **Salary change dialog.** | A **"Record salary change"** button in the history section opens a react-bootstrap `Modal`: <br>- **Fields:** monthly amount (text, `inputMode="decimal"`, sent as typed); currency (form select, **defaulting to the current salary's currency**); effective from (date, required). <br>- **Help text:** "The previous period ends the day before. History is kept." plus "Must be after {latest start date}" when there is a history (informational; the API decides). <br>- **Result:** success closes the dialog with "Salary change recorded."; `422` details go under the fields | F6.2 |
| U6 | **Correction dialog.** | A **"Correct"** button on each `editable` row opens a `Modal` with the amount and currency pre-filled and the dates shown **read-only** (never sent). <br>- **Help text:** "Corrections fix a data-entry mistake in the current or a scheduled record. To record a raise, use Record salary change." <br>- **Changes:** only changed fields are sent, and Save stays disabled until something changes. <br>- **`salary_record_not_editable`:** "This record can no longer be corrected because its period has ended." with the history refreshed. <br>- **Success:** "Salary record corrected." | F6.2 |
| U7 | **Dialog accessibility.** | react-bootstrap `Modal`: focus moves into the dialog, `aria-labelledby` points to its title, Esc and Cancel close it, and focus returns to the button that opened it. Buttons are disabled while saving (no double submit) | F6.2 |
| U8 | **No history yet.** | Empty state "No salary records yet.", with **Record salary change** still available (the first record needs no previous one). No extra rule for terminated employees (the API allows it; none is invented) | F6.1 / F6.2 |
| U9 | **E2E data (FD7).** | On a **new `EMP-E2E-*` employee**, created by the test with a salary from 2025-01-01: <br>- record a change from 2026-01-01, so the first record becomes historical with "Effective to 2025-12-31"; <br>- record a change from a future date (scheduled); <br>- correct the scheduled amount; <br>- check the historical row has no Correct button. <br>Demo employees are never changed; one extra E2E employee per run | F6.2 |

#### B. Assumptions
- **No backend change.** API §7 covers FR-02 and FR-03.
- "Today" (and therefore `status` and `editable`) is the server's UTC date; the frontend never recomputes it.
- One employee's history is small (the demo data has at most 5 records each), so there is no pagination.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of U1–U9~~ Approved 2026-09-29 | F6.1 | Project owner |
| ~~F5 committed (the owner commits F4 + F5)~~ Committed (`d2d7f39`) | F6.1 (clean starting point) | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| A correction is used for a raise, rewriting a period instead of preserving history | Medium / Medium | U6 wording; Correct only on `editable` rows; the change flow is the prominent action |
| The detail's current salary is stale after a change | Medium / Medium | U4 invalidates the detail query |
| A record becomes non-editable between loading and saving | Low / Low | U6 handles `salary_record_not_editable` and refreshes |
| Amounts entered or compared across currencies wrongly | Low / High | Each row shows its own currency; nothing is summed; the amount is sent as typed |
| Focus lost or trapped with dialogs | Low / Medium | U7 react-bootstrap `Modal` defaults, with tests |

### F6.1 History view
**Prompt:** `Per U1–U4 and U8: salaryService + salary.types.ts; SalaryStatusBadge and SalaryHistory (DataTable, API order, MoneyAmount per row, status badge, Correct column placeholder only for editable rows arriving in F6.2) in components/salaries; add the section to EmployeeDetailPage. Tests, E2E step, screenshot, record.`
**Tasks:**
1. ~~Owner: approve U1–U9.~~ Approved 2026-09-29.
2. ~~`src/services/salaryService.ts` + `salary.types.ts`, with MSW tests.~~ Done 2026-09-29 (`list` only; `change` and `correct` are added with their dialogs in F6.2).
3. ~~`src/components/salaries/SalaryStatusBadge.tsx`, `SalaryHistory.tsx`, `useSalaryRecords.ts` (query keys, U4); the section on `EmployeeDetailPage`.~~ Done 2026-09-29. No Actions column yet: it arrives with the Correct button in F6.2 (an empty column would add nothing).
4. ~~Tests.~~ Done 2026-09-29:
   - `salaryService.test.ts` (1 test): the history path and the unwrapped `data`;
   - `SalaryHistory.test.tsx` (5 tests): rows in API order with each row's own currency and minor units (INR/KWD/JPY), "—" for open-ended; status labels and badges; no cross-currency total; empty state; error with Retry;
   - default MSW handler for the history (empty), so existing detail-page tests are unaffected.
5. ~~E2E, screenshot, validation, record.~~ Done 2026-09-29.

**Acceptance:** History matches API §7.2 and the display rules; all tests pass.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run format`, `typecheck`, `lint` (zero warnings), `test` (**26 files, 153 tests**), and `build` all exit 0. JS bundle 370.9 kB (116.5 kB gzip).
- **E2E against the real API** (Claude's Rails on :3125, Vite on :5191, temporary user): **11 passed** in 9.7 s. New `salaries.spec.ts` (read-only): EMP-00238's page shows a history with several rows, every status is a known label, and the Current row's amount equals the Current salary card.
- **Cleanup verified:** temporary user deleted (`User.count` = 1), ports free, auth file removed. The existing `employee-forms.spec.ts` created one more `EMP-E2E-*` employee (10,003 employees now).
- **Mutation check:** showing one fixed currency on every row is caught by the "own currency and decimal places" test.
- **Screenshot reviewed** (EMP-00238, desktop): Scheduled / Current / Historical ×2 in API order, "—" for the open-ended scheduled record, EUR on every row, no total; the Current row matches the Current salary card.

### F6.2 Salary change and correction
**Prompt:** `Per U4–U7 and U9: SalaryChangeDialog and SalaryCorrectionDialog (react-bootstrap Modal) in components/salaries; Record salary change and Correct (editable rows only) buttons; 422 details on fields; salary_record_not_editable handling; refresh history, detail, analytics/report caches. Tests, E2E (U9), screenshots, record.`
**Tasks:**
1. ~~`SalaryChangeDialog.tsx` and `SalaryCorrectionDialog.tsx`; buttons in `SalaryHistory`.~~ Done 2026-09-29. Also `SalarySaveError.tsx` (API messages with no field) and `useSalaryChange`/`useSalaryCorrection` in `useSalaryRecords.ts` (U4 refresh); `salaryService` gained `change` and `correct`. Two details beyond U5:
   - **Default currency:** the current salary's; with no current salary (only scheduled or historical records), the latest record's; with no history, none is chosen.
   - **"Record salary change" is disabled while the history is loading or has failed to load**, so the default currency and the "Must be after …" hint are never based on a missing history.
2. ~~Tests.~~ Done 2026-09-29:
   - `salaryService.test.ts` (+2, 3 in total): `change` posts the input; `correct` patches only the given fields;
   - `SalaryDialogs.test.tsx` (12 tests). Change: focus inside, the current salary's currency, and the date rule as help; required fields with no request; the amount sent as typed, then a notice with history and current salary refreshed; the API's date error on the field; Esc and Cancel close and return focus, and it reopens empty; available with no history (U8). Correction: offered only on editable records; pre-filled with read-only dates, sending only the changed amount; only the currency when only it changes; amount required and the API's amount error; `salary_record_not_editable` message and history refresh; API messages with no field listed.
3. ~~E2E (U9); screenshots of both dialogs; validation; record.~~ Done 2026-09-29; see the status.

**Acceptance:** Changes preserve history (the previous period closed by the API) and corrections follow D4 + O1 against the real API; all tests and E2E pass.
**Status:** Done (2026-09-29).
- **Checks under Node 22.23.3:** `npm run typecheck`, `lint` (zero warnings), `test` (**27 files, 167 tests**), and `build` all exit 0; `prettier --check` clean. JS bundle 381.8 kB (119.2 kB gzip).
- **E2E against the real API** (Claude's Rails on :3126, Vite on :5192, temporary user): **12 passed** in 14.5 s. New U9 journey in `salaries.spec.ts` on a new employee (`EMP-E2E-MUMZHBBN`, hired and paid from 2025-01-01, INR): a change from 2026-01-01 makes the first record Historical, ending 2025-12-31, and updates the Current salary card; a change from next January is Scheduled and closes the current period on 31 December; correcting the scheduled amount (95,000.00 → 96,000.00) updates it in place (still 3 records); the Historical row has no Correct button.
- **Cleanup verified:** temporary user deleted (deleted=1, `User.count` = 1), auth file removed, ports free. **Data added by this run:** two `EMP-E2E-*` employees (the U9 one and the one from `employee-forms.spec.ts`).
- **Mutation check:** sending the amount even when unchanged is caught by the two "only the changed fields" correction tests (2 of 12 fail); the code was restored and the suite re-run green.
- **Screenshots reviewed** (desktop, the U9 employee): the change dialog has an empty amount, INR pre-selected, and the help "The previous period ends the day before. History is kept. Must be after 2027-01-01."; the correction dialog has the wording steering raises to Record salary change, read-only dates (2027-01-01 / —), the amount and currency pre-filled, and Save correction disabled until something changes. Behind both, the history shows Scheduled / Current / Historical with Correct only on the first two. **Note:** the native date input shows the browser's locale format (dd/mm/yyyy here), while hints and tables use ISO dates. This is cosmetic and left as is.

**Phase gate:** History is preserved and shown correctly; the correction rules follow the API; all module tests pass. **Passed 2026-09-29:** the U9 journey on the real API shows the previous period closed by the API and a correction that changes only the amount, with no Correct on historical rows; all unit, component, and E2E tests pass.

---

## Phase F7 — Analytics and reports
**Goal:** Currency-safe compensation insight and exportable reports (FR-04 to FR-06).

### F7.1 Analytics dashboard
**Prompt:** `analyticsService + analytics.types.ts (src/services/) and the dashboard page (src/components/dashboard/): filters (as_of, country, department, status), per-currency summary cards, a distribution chart per currency (10 bands), and a breakdown table by country or department. No cross-currency totals.`
**Tests and validation:**
- component tests: one card per currency with no grand total, filter changes, empty result, chart given only the band counts;
- E2E: filter analytics by country;
- manual check against the API's figures for the same filters.
**Status:** Not Started

### F7.2 Salary report and CSV export
**Prompt:** `reportService + report.types.ts (src/services/) and the salary report page (src/components/reports/): shared filters plus q, sort, and pagination; CSV export via fetch that saves the file or shows 422 export_too_large (G6).`
**Tests and validation:**
- component tests: sort by amount grouped by currency, pagination, export success, and the export-too-large message;
- E2E: filter the report and download the CSV;
- manual check.
**Status:** Not Started

**Phase gate:** Analytics and reports match the API for the same filters; export works and handles the cap; all module tests pass.

---

## Phase F8 — Quality review
**Goal:** Confirm coverage and non-functional quality across the modules. There is no new test phase: tests were written with each module.

### F8.1 Coverage and regression review
**Prompt:** `Build a requirement → test matrix (FR-01–FR-07, API §13 behaviours, frontend rules) from the module tests, fill any gaps, and run the full suite plus all Playwright journeys against the real Rails API. Report actual results.`
**Status:** Not Started

### F8.2 Accessibility, responsiveness, performance, and security review
**Prompt:** `Add axe checks to the existing Playwright journeys (WCAG 2.1 AA baseline); check keyboard use, Bootstrap breakpoints, and bundle size; confirm no salary or personal data reaches storage, URLs, or the console. Fix verified issues with tests.`
**Status:** Not Started

**Phase gate:** The critical journeys pass end to end; accessibility and security checks are recorded.

---

## Phase F9 — Final review and handoff
**Goal:** A reviewed, documented frontend that runs with the backend.

### F9.1 Code and scope review
**Prompt:** `Review frontend/ against CLAUDE.md, the frontend rules, ADR 006, and API spec v2.1. Report findings by severity with file references before nontrivial changes.`
**Status:** Not Started

### F9.2 Documentation and final regression
**Prompt:** `Update README (Node setup, running backend and frontend together, tests, running E2E against the real API), this plan, and any affected docs. Run the full frontend and backend test suites, lint, typecheck, build, and E2E. Report exact results.`
**Status:** Not Started

**Phase gate:** The frontend and backend run together from the README; all suites pass; limitations are documented.

---

## Cross-phase rules
- Do not modify the Rails backend; record needed API changes as gaps for approval.
- Follow `.claude/rules/frontend/*`, `.claude/rules/security.md`, and `.claude/rules/testing.md`.
- Keep money per currency and never total across currencies.
- Use synthetic data only.
- Never mark a subphase Done unless its acceptance criteria are checked and the reported tests actually ran.

## Completion log

| Date | Phase/subphase | Summary | Tests/verification | Decisions/follow-up |
|---|---|---|---|---|
| 2026-09-29 | F1 (review) | Reviewed CLAUDE.md, BACKEND_PLAN.md, all docs and ADRs, the Rails routes and controllers, and `.claude/`. Proposed stack, folder structure, phases F1–F9, and gaps G1–G7. Reviewed the owner's new frontend rules and proposed changes | Read-only; no code | Owner approved FD1–FD12 |
| 2026-09-29 | F1.1–F1.3 | Page map; ADR 006; this plan. `.claude/rules/frontend/*` revised with new `data-display.md`; `rules/frontend.md` deleted; new `skills/react-frontend`; testing skill extended; `CLAUDE.md` updated (path-scoped rules not imported; Current Plan; frontend commands; MySQL) | Documentation and configuration only; no code, no dependencies installed | Owner: F1 gate review; install Node 22 (FD1); create the `salary_management_e2e` database before F2.2 (FD7) |
| 2026-09-29 | F1 (owner feedback) | Removed the separate test-tooling subphase (old F2.2): each module now writes and runs its own component tests and Playwright journey and is validated before it is Done (module workflow). The Vitest/MSW setup moved into F2.1, Playwright and the E2E database into F3.1, and the API client became F2.2. F8 is now a coverage and quality review. Added the state-management trade-off (Context API, Redux Toolkit, TanStack Query) as FD13 | Documentation only | Owner: confirm FD13 (TanStack Query + Context, no Redux) |
| 2026-09-29 | F1 (FD13) | Owner approved FD13: TanStack Query for server data, React Context for the session, local state and the URL for UI state; no Redux | Plan update only | — |
| 2026-09-29 | F1 (FD7 revised) | Owner decision: no separate E2E database. Playwright runs against the real Rails server and development database. HR credentials come from environment variables at run time; one sign-in per run (`storageState`) for the rate limit; E2E writes use `EMP-E2E-*` records; `demo:reset` restores the demo data. ADR 006, CLAUDE.md, and the testing skill updated | Documentation only | — |
| 2026-09-29 | F1 (FD1 revised) | Owner decision: no Node install. nvm already has v22.12.0 (default still v18.20.4); `.nvmrc` = `22`, `engines >=22.12`, `nvm use` before npm commands. ADR 006, CLAUDE.md, and the react-frontend skill updated | `nvm ls`: v18.20.4, v20.0.0, v22.12.0 installed | — |
| 2026-09-29 | F2 (review) | Reviewed F2 against ADR 006, FD1–FD13, API spec §1–§2/§4/§10/§13, the backend CSRF and session configuration, nvm, and the npm registry. Recorded Q1–Q12, assumptions, dependencies, and risks; expanded F2.1 and F2.2 into tasks. Key findings: Rails' CSRF origin check means the Vite proxy must keep `changeOrigin: false` (spike: `401` vs `422 invalid_csrf_token`); React Router 8 needs Node ≥22.22 → React Router 7.18; typescript-eslint caps TypeScript <6.1 → TypeScript 6.0; jsx-a11y caps ESLint ≤9 → ESLint 9.39; Vite 8, Vitest 5, and MSW 3 work on 22.12.0 | Read-only: Rails runner (origin check, hosts, session options); CSRF spike on a spare Rails server :3114 (stopped); `npm view` versions, engines, and peer dependencies under Node 22.12.0. No code written | Owner: approve Q1–Q12 |
| 2026-09-29 | F2 (Q1 discussion) | Owner asked about allowing localhost via CORS instead of `changeOrigin: false`. Explained that CORS doesn't apply through the proxy, and that the failure is Rails' CSRF origin check, not CORS. Owner followed the recommendation: keep the dev proxy with `changeOrigin: false`; cross-origin with CORS is decided at deployment (G7 option b) as a separately approved backend change. Q1 and G7 updated | Documentation only | Q2–Q12 still awaiting approval |
| 2026-09-29 | F2 (Q decisions) | Owner approved Q2–Q12 (Q1 already confirmed); F1 gate passed | Plan update only | — |
| 2026-09-29 | F2.1 | Scaffolded `frontend/` (create-vite react-ts with ESLint), pinned the Q2 set, strict TypeScript and the `@/` alias, ESLint (type-checked, react-hooks, react-refresh, jsx-a11y) and Prettier defaults, Bootstrap, the `/api` proxy with `changeOrigin: false` and `VITE_PROXY_TARGET`, Vitest + jsdom + RTL + MSW setup with a smoke test, `.env.example`, `.nvmrc`. ADR 006 version table amended. Owner installed Node 22.23.3 through nvm (jsdom 30 needs ≥22.22.2) | Node 22.23.3: install 0 vulnerabilities; format, typecheck, lint, test (1/1), and build exit 0; lint probe proves the rules fire; proxy health `200` and proxied CSRF write `401` (not `422`) with Rails :3115 and Vite :5180, both stopped | Review missed jsdom's Node requirement (recorded). MSW 3 `onUnhandledFrame`. React Router 7 vs 8 to decide in F3.2 |
| 2026-09-29 | F2.2 | API client module: `src/api/client.ts` (`apiRequest`, `buildUrl`, unauthorized handler), `csrf.ts` (in-memory token), `errors.ts` (`ApiError`), `types.ts` (envelope, pagination), `src/env.d.ts`; `src/lib/queryClient.ts` (Q11) with the provider in `main.tsx`; `@tanstack/react-query` 5.104.0 installed. 20 new tests (MSW). F2 gate passed | `npm run format`, `typecheck`, `lint`, `test` (3 files, 21 tests), and `build` exit 0; 2 mutation checks caught by the intended tests; the abort test found and fixed a cross-realm `instanceof DOMException` bug | Manual check deferred to F3.1 (no UI calls the client yet) |
| 2026-09-29 | F3 (review) | Reviewed F3 against API §4/§10/§13, ADR 004 and the backend session code, ADR 006, FD6–FD13, the F2 client, React Router 7.18/8.4 (8.0 changelog and exports read from the tarball), and Playwright 1.63. Recorded R1–R15, assumptions, dependencies, and risks; expanded F3.1 and F3.2 into tasks. Key points: React Router 8.4 in declarative mode (none of its breaking changes apply); `POST /session` is unwrapped and returns a new token; `DELETE /session` kills the token; bounded CSRF refresh and retry; clear the query cache on sign-out and expiry; internal-only return path; temporary dev user for Claude's E2E runs; LoadingState and ErrorAlert brought forward from F4.1 | Read-only: npm registry (dist-tags, release dates, peers), React Router 8.4.0 tarball changelog and exports (scratch copy deleted). No code written | Owner: approve R1–R15 |
| 2026-09-29 | F3 (R decisions) | Owner approved R1–R15 as recommended | Plan update only | — |
| 2026-09-29 | F3.1 | Session module (`api/session.ts`), R5 CSRF refresh-and-retry in the client, `userMessage()`, `LoadingState`/`ErrorAlert`, `AuthProvider`/`useAuth`/`authContext` (R2–R4, R6), `SignInPage` (R8), interim `App` screen switch (R3), test helpers (`render.tsx`, stateful `sessionBackend` fake), Playwright 1.63 plus Chromium with the setup project and 3 journeys. R7 return path moved to F3.2 (needs the router) | format, typecheck, lint, test (6 files, 44 tests), and build exit 0; E2E 4/4 against the real API (temporary user); screenshots reviewed; R6 mutation caught | The E2E script's cleanup trap hung, and the temporary user was deleted manually (verified `User.count` = 1). Future runs clean up in explicit steps |
| 2026-09-29 | Structure | Owner decision: feature-based `src/` (components, layouts, modules/{auth,dashboard,employees,salaries,reports}, services, hooks, routes). Moved the F2 and F3.1 code (`api/`, `lib/` → `services/`; `auth/`, `features/auth/` → `modules/auth/`; `components/feedback/` → `components/`), rewrote imports, and updated F1.2, the module workflow, F3.2 tasks, ADR 006, `.claude/rules/frontend/{components,api-integration}.md`, and the react-frontend skill. `layouts/`, `hooks/`, `routes/`, and the other modules are created when a real feature needs them. `src/test/` kept for test-only support | format, typecheck, lint, test (6 files, 44 tests, unchanged), and build exit 0. E2E not re-run (move-only change; no behaviour change) | Owner: confirm `src/test/` as the test-support location |
| 2026-09-29 | Structure (revised) | Owner decision: no `modules/` folder. Feature folders under `src/components/` (`login` now; `employees`, `salaries`, `dashboard`, `reports` later) next to `components/common/` (reusable UI); `services/api/` HTTP core plus `services/authService.ts` (was `session.ts`); `hooks/useAuth.ts`; `layouts/` and `routes/` in F3.2. Moved files, rewrote imports (`sessionApi` → `authService`), and updated F1.2, the module workflow, F3.2 tasks, ADR 006, frontend rules, and the skill | format, typecheck, lint, test (6 files, 44 tests, unchanged), and build exit 0 | F3.2 layout set (header/navbar/sidebar) to confirm with the owner at F3.2 start |
| 2026-09-29 | F3 (R9a) | Owner chose layout option (b): `MainLayout` + `Header` (email, sign out, small-screen menu button) + `Sidebar` (feature navigation, offcanvas on small screens); no separate `Navbar`. R9a recorded; F3.2 prompt, tasks, and tests updated | Plan update only | — |
| 2026-09-29 | Structure (auth folder) | Owner decision: feature folders stay under `src/components/` (`common`, `auth`, `employees`, `salaries`, `dashboard`, `reports`), each holding its own files. Renamed `components/login/` → `components/auth/`; imports, rules, skill, ADR 006, and plan updated | format, typecheck, lint, test (6 files, 44 tests), and build exit 0 | — |
| 2026-09-29 | Structure (src/test) | Owner confirmed `src/test/` as the location for test-only support | Plan update only | — |
| 2026-09-29 | Services refactor | Owner samples: simpler services. Merged `services/api/{client,csrf,errors,types}` into `services/api.ts` (`apiRequest(path, options)` with `RequestInit` + `query`; `ApiError(message, status, code, details)` in the sample's order); `queryClient.ts` moved up; `authService` became an object (`getSession`, `signIn(credentials)`, `signOut`) with `auth.types.ts` (`User`, `SignInCredentials`, `Session`). **Kept from our contract** (the samples would break against this API): the `X-CSRF-Token` header, envelope parsing with `code`/`details` (`body.error` is an object), `{data: …}` responses, short paths under the base path (no `/api/v1` doubling), `credentials: same-origin`, the `401` handler, the R5 CSRF refresh/retry, abort and network handling, and `204`. Base path read at call time (testable override). Rules, skill, ADR 006, and plan updated | format, typecheck, lint, test (6 files, 44 tests), and build exit 0; **E2E 4/4 against the real API** (temporary user; cleanup in explicit steps, verified `User.count` = 1, ports free, auth file removed) | — |
| 2026-09-29 | Plan alignment | Updated the remaining current and future text to the new structure: the F1.2 reusable-components list (layout and routing in `layouts/` and `routes/`; `PageHeader` only when needed), and the F4.1, F5.1, F6.1, F7.1, and F7.2 prompts (service object + types file in `src/services/`, pages in `src/components/<feature>/`, the filter helper as a shared hook in `src/hooks/`). R2 gained a pointer to the current files. Decision records (Q6, Q10, F2.2 prompt) kept as history | Documentation only; no code changes | — |
| 2026-09-29 | F3.2 | React Router 8.4.0; `routes/` (AppRoutes, RequireAuth, returnPath with the R7 guard), `layouts/` (MainLayout, Header, responsive Sidebar per R9a), `components/dashboard/HomePage`, `components/common/` (NotFoundPage, ErrorBoundary, reportRenderError), `hooks/useDocumentTitle`; `BrowserRouter` and root error handlers in `main.tsx`; `SignInPage` return path. Test support: `MemoryRouter` in `render.tsx`, `screenSize.ts` (`matchMedia`). E2E `navigation.spec.ts`. F3 gate passed | format, typecheck, lint, test (9 files, 60 tests), and build exit 0; E2E 6/6 against the real API (temporary user, cleanup verified); open-redirect mutation caught; desktop and phone screenshots reviewed | Fixed along the way: React 19 logs full render errors by default (now name only); react-bootstrap `Navbar` role clash (plain `<header>`); unhighlighted active sidebar link (`pills`) |
| 2026-09-29 | F4 (review) | Reviewed F4 against API §2.3/§2.4/§5/§6.1/§8.1/§9/§13, the frontend rules, the F5–F7 subphases, and the code after F3. Recorded S1–S13, a consumer map, assumptions, dependencies, and risks; rewrote F4.1 (data, lists, filters) and F4.2 (tables, display, forms). Key points: build only components with at least two confirmed consumers (drop `DateText`; `SalaryStatusBadge` moves to F6.1; defer `ConfirmDialog` and `PageHeader`); generic `DataTable` with server sort; URL list state sanitised against allowlists (no `400` loops); money grouped by string manipulation only; `FormField` with ARIA wiring and 422 mapping, with `SignInPage` refactored onto it | Read-only: API spec sections and the current frontend code. No code written | Owner: approve S1–S13 |
| 2026-09-29 | F4 (S decisions) | Owner approved S1–S13 as recommended | Plan update only | — |
| 2026-09-29 | F4.1 | `referenceService` + `reference.types.ts` (with the status enum and labels); `hooks/useReferenceData` (once per session) and `hooks/useListParams` (URL state sanitised against allowlists; `q` in state only); `components/common/ReferenceSelects` (country, department, status, currency; filter and form modes), `SearchInput` (300 ms debounce, Enter, Clear, max 100), `Pagination` (range, First/Previous/Next/Last, past end, page size), `EmptyState`, `format.ts` (`formatCount`). Test support: `referenceData` fixture, `renderWithQueryClient` | format, typecheck, lint, test (15 files, 90 tests), and build exit 0; 2 mutation checks (q in URL, sort allowlist) caught | No E2E by design (S13); first real-API and visual check in F5.1 |
| 2026-09-29 | F4.2 | `components/common/DataTable` (column-driven, server sort with `aria-sort`, loading/error/empty, `aria-busy`), `MoneyAmount` + `formatMoney` (string-only grouping, currency code, optional "/ month"), `EmploymentStatusBadge`, `FormField` (ARIA-wired, typed with `FormControlProps`), `fieldErrors` in `services/api.ts`; `SignInPage` refactored onto `FormField` with its tests unchanged. F4 gate passed | format, typecheck, lint, test (18 files, 107 tests), and build exit 0; E2E 6/6 against the real API (temporary user, cleanup verified); float-formatting mutation caught | — |
| 2026-09-29 | F5 (review) | Reviewed F5 against API §6.1–§6.4, §2, §10, §13, FR-01/02/04, D14, D18, I13, gaps G1/G3, and the F3/F4 building blocks. Recorded T1–T11, assumptions, dependencies, and risks; rewrote F5.1–F5.3 with tasks. Key points: `/` → `/employees` and the Home placeholder removed (dashboard later at `/dashboard`); the report link from the list waits for F7.2 (no dead links); salary history on the detail page belongs to F6; a shared create/edit form; the initial-salary amount is a text input (no float); edit sends changed fields only; E2E creates only `EMP-E2E-*` employees | Read-only: API spec §6 and the current frontend code. No code written | Owner: approve T1–T11 |
| 2026-09-29 | F5 (T decisions) | Owner approved T1–T11 as recommended | Plan update only | — |
| 2026-09-29 | F5.1, F5.2 | `employeeService` + `employee.types.ts`; `components/employees/` (`useEmployees`, `EmployeeListPage`, `EmployeeDetailPage`); `/` → `/employees`, Home placeholder removed, sidebar Employees; default MSW handlers and employee fixtures; `settleQueryClients` after each test. E2E `employees.spec.ts` | format, typecheck, lint, test (21 files, 130 tests), and build exit 0; E2E 8/8 on the real API and 10k demo data (temporary user; cleanup verified each run); list and detail screenshots reviewed | Fixed: Clear filters double URL update (bug); cross-test request leak (flaky test); ambiguous "Clear" button name (accessibility) |
| 2026-09-29 | F5.3 | `components/employees/` `employeeFormValues.ts`, `EmployeeForm` (shared; 422 details to fields incl. `initial_salary.*`), `EmployeeCreatePage` (optional initial salary, T8), `EmployeeEditPage` (changed fields only, T9); New employee and Edit buttons; routes `/employees/new`, `/employees/:id/edit`. E2E `employee-forms.spec.ts`. F5 gate passed. Gap G8 recorded | format, typecheck, lint, test (24 files, 147 tests), and build exit 0; E2E 10/10 on the real API (temporary user; cleanup verified; one `EMP-E2E-*` employee created); edit-all-fields mutation caught; create-error screenshot reviewed | Owner: commit F4 + F5 together; `demo:reset` optional (would also remove `SUMIT`) |
| 2026-09-29 | F6 (review) | Reviewed F6 against API §7, §10, §13, FR-02/03, D4/D6/D8/O1/I13, ADR 003, the data-display rules, and the F5 detail page. Recorded U1–U9, assumptions, dependencies, and risks; rewrote F6.1 (history view) and F6.2 (change and correction dialogs). Key points: history is a section on the employee detail page (DataTable, API order, own currency per row); status and editable are used as given; a salary change refreshes the detail's current salary and the analytics and report caches; correction dialogs send only amount/currency (dates read-only), with wording that steers raises to Record salary change; E2E only on a new `EMP-E2E-*` employee | Read-only: API spec §7 and the current frontend code. No code written | Owner: approve U1–U9 |
| 2026-09-29 | F6 (U decisions) | Owner approved U1–U9 as recommended | Plan update only | — |
| 2026-09-29 | F6.1 | `salaryService` (`list`) + `salary.types.ts`; `components/salaries/` (`useSalaryRecords` with the U4 key, `SalaryStatusBadge`, `SalaryHistory`); the Salary history section on `EmployeeDetailPage`; default MSW handler and `salaryRecords` fixture. E2E `salaries.spec.ts` | format, typecheck, lint, test (26 files, 153 tests), and build exit 0; E2E 11/11 on the real API (temporary user; cleanup verified); per-row currency mutation caught; history screenshot reviewed | Next: F6.2 on the owner's go-ahead |
| 2026-09-29 | F6.2 | `SalaryChangeDialog`, `SalaryCorrectionDialog`, `SalarySaveError`; Record salary change and Correct (editable rows only) in `SalaryHistory`; `useSalaryChange`/`useSalaryCorrection` (U4 refresh); `salaryService.change`/`correct`. Default currency falls back to the latest record's when there is no current salary; Record salary change is disabled while the history is loading or failed. U9 journey in `salaries.spec.ts`. F6 gate passed | typecheck, lint, test (27 files, 167 tests), and build exit 0; prettier clean; E2E 12/12 on the real API (temporary user; cleanup verified, `User.count` = 1); changed-fields-only mutation caught; both dialog screenshots reviewed | Owner: commit F6 |

## Current progress
- **F1** — Frontend design and decisions — **Done (gate passed 2026-09-29)**
- **F2** — Foundation — **Done (gate passed 2026-09-29)**. F2.1, F2.2 Done.
- **F3** — Authentication and app shell — **Done (gate passed 2026-09-29)**. F3.1, F3.2 Done.
- **F4** — Shared components — **Done (gate passed 2026-09-29)**. F4.1, F4.2 Done.
- **F5** — Employees — **Done (gate passed 2026-09-29)**. F5.1, F5.2, F5.3 Done.
- **F6** — Salary history — **Done (gate passed 2026-09-29)**. F6.1, F6.2 Done.
- **Next:** F7 review (analytics and reports), after the owner commits F6
