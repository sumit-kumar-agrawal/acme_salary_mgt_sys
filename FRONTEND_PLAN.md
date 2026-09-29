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
1. **Build:** the API functions the module needs (in `src/api/`), its query hooks, and its components or page.
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

```
frontend/
  package.json, vite.config.ts (dev proxy /api → :3000), tsconfig.json, eslint.config.js, .nvmrc, index.html
  src/
    main.tsx, App.tsx       # providers (query client, auth), router
    api/                    # the only code that calls fetch: client.ts, session, employees, salaryRecords, reference, analytics, reports, types.ts
    auth/                   # AuthProvider (user + CSRF token in memory), useAuth, RequireAuth
    components/             # shared, non-fetching UI: layout/, feedback/, table/, forms/, filters/, format/
    features/               # pages and their hooks and area-specific components: auth/, employees/, salaries/, analytics/, reports/
    lib/                    # money/date display helpers, URL filter helpers
    test/                   # Vitest setup, MSW handlers and synthetic fixtures
  e2e/                      # Playwright specs and setup
```

**Shared components** (`src/components/`, used more than once):
- **Layout and auth:** `AppLayout`/`NavBar`, `PageHeader`, `RequireAuth`.
- **Feedback:** `LoadingState`, `EmptyState`, `ErrorAlert`.
- **Tables:** `Pagination`, `SortableHeader`.
- **Filters and forms:** `SearchInput`, `CountrySelect`/`DepartmentSelect`/`EmploymentStatusSelect`/`CurrencySelect`, `FormField`.
- **Display and dialogs:** `MoneyAmount`, `DateText`, `EmploymentStatusBadge`, `SalaryStatusBadge`, `ConfirmDialog`.

**Area-specific components** (in `features/`): the currency summary cards, distribution chart, and breakdown table (analytics); the CSV download button (reports).

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

### F3.1 Session, sign-in, and sign-out
**Prompt:** `Session API functions, AuthProvider (React Context: user + CSRF token in memory; token replaced after sign-in), sign-in page (generic failure, 429 message), sign-out, and 401 → return to sign-in with a message. Set up Playwright (config, npm run e2e, global sign-in with storageState, credentials from E2E_HR_EMAIL/E2E_HR_PASSWORD) against the real Rails API (FD7) with this module's journey: sign in → see the app → sign out, plus wrong password.`
**Tests and validation:**
- component tests: sign-in form, generic error, `429`, token replacement, `401` handling;
- E2E: the sign-in journey;
- manual check against the dev API.
**Status:** Not Started

### F3.2 Layout, navigation, and routing
**Prompt:** `AppLayout/NavBar, React Router routes from F1.1, RequireAuth, not-found page, and an error boundary with a generic message.`
**Tests and validation:**
- component tests: redirect when signed out, navigation links, not-found page, error boundary;
- E2E: a protected URL redirects to sign-in and returns after sign-in;
- manual check.
**Status:** Not Started

**Phase gate:** Only signed-in users reach app pages; expiry and sign-out work end to end.

---

## Phase F4 — Shared components
**Goal:** Reusable, accessible building blocks, each tested as it is built.

### F4.1 States, tables, and filters
**Prompt:** `LoadingState, EmptyState, ErrorAlert, Pagination (API meta), SortableHeader, SearchInput, and reference-data selects (countries, departments, statuses, currencies; reference API functions) with URL-synced filter helpers (FD6b, q excluded).`
**Tests and validation:**
- component tests for each component: states, keyboard use and labels, pagination edges, `q` not written to the URL;
- lint, typecheck, and test.
**Status:** Not Started

### F4.2 Display components and form helpers
**Prompt:** `MoneyAmount, DateText, EmploymentStatusBadge, SalaryStatusBadge, ConfirmDialog, and FormField with mapping of 422 details to fields.`
**Tests and validation:**
- component tests with JPY, KWD, and 2-decimal amounts (strings shown as given, currency always present, labelled monthly), and field-error mapping;
- lint, typecheck, and test.
**Status:** Not Started

**Phase gate:** Shared components are tested and follow the display and accessibility rules.

---

## Phase F5 — Employees
**Goal:** Search, view, create, and update employees (FR-01, FR-04).

### F5.1 Employee list
**Prompt:** `Employees API functions and page: q search, country/department/status filters, allowlisted sort, pagination (URL state except q), links to detail and to the salary report (G1); loading, empty, and error states.`
**Tests and validation:**
- component tests (MSW): filters, sort, pagination, empty result, `400` handling, no salary or email shown;
- E2E: search and filter, then open an employee;
- manual check on the 10k demo data.
**Status:** Not Started

### F5.2 Employee detail
**Prompt:** `Employee detail: profile, current salary (or none), and a salary history summary; generic 404 page for unknown employees.`
**Tests and validation:**
- component tests: with and without a current salary; `404`;
- E2E step: open detail from the list;
- manual check.
**Status:** Not Started

### F5.3 Create and edit employee
**Prompt:** `New employee form with optional initial salary (currency chosen by the user, G3) and edit form (including termination via employment_status), showing 422 details per field; cache invalidation after save.`
**Tests and validation:**
- component tests: required fields, the API's `422` mapped to fields (including `initial_salary.*`), success redirect;
- E2E: create an employee with an initial salary, then edit it;
- manual check.
**Status:** Not Started

**Phase gate:** The employee journeys work against the API with correct validation feedback; all module tests pass.

---

## Phase F6 — Salary history
**Goal:** View history and record changes without losing it (FR-02, FR-03).

### F6.1 History view
**Prompt:** `Salary records API functions and history table (newest first) using the API's status and editable flags and money per currency.`
**Tests and validation:**
- component tests: current, scheduled, and historical rows; mixed currencies; empty history;
- manual check.
**Status:** Not Started

### F6.2 Salary change and correction
**Prompt:** `Salary change dialog (POST; closes the previous period) and correction dialog (PATCH amount and currency, only for editable records; salary_record_not_editable handled); refresh detail and history after success.`
**Tests and validation:**
- component tests: `422` field errors, the not-editable case, and correction offered only for editable records;
- E2E: record a salary change and see the previous period closed in the history;
- manual check.
**Status:** Not Started

**Phase gate:** History is preserved and shown correctly; the correction rules follow the API; all module tests pass.

---

## Phase F7 — Analytics and reports
**Goal:** Currency-safe compensation insight and exportable reports (FR-04 to FR-06).

### F7.1 Analytics dashboard
**Prompt:** `Analytics API functions and page: filters (as_of, country, department, status), per-currency summary cards, a distribution chart per currency (10 bands), and a breakdown table by country or department. No cross-currency totals.`
**Tests and validation:**
- component tests: one card per currency with no grand total, filter changes, empty result, chart given only the band counts;
- E2E: filter analytics by country;
- manual check against the API's figures for the same filters.
**Status:** Not Started

### F7.2 Salary report and CSV export
**Prompt:** `Report API functions and page: shared filters plus q, sort, and pagination; CSV export via fetch that saves the file or shows 422 export_too_large (G6).`
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

## Current progress
- **F1** — Frontend design and decisions — **Done (gate passed 2026-09-29)**
- **F2** — Foundation — **Done (gate passed 2026-09-29)**. F2.1, F2.2 Done.
- **Next:** F3 review (authentication and app shell), then F3.1
