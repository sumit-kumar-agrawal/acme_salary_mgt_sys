---
name: react-frontend
description: Build and maintain the React frontend for the salary management system. Use when implementing frontend pages, components, API client code, or frontend tests under frontend/.
---

# React Frontend Skill

The frontend rules in `.claude/rules/frontend/` (React, components, API integration, data display, security) and `.claude/rules/testing.md` apply. This skill describes the workflow; it does not repeat those rules.

Before making changes:

1. Read `FRONTEND_PLAN.md` (the current subphase, its decisions, and gaps) and `docs/decisions/006-frontend-architecture.md`.
2. Read the relevant sections of `docs/api-specification.md`, especially §13, the client integration notes. The Rails API is the contract; do not change the backend.
3. Identify the affected feature folder (`src/components/<feature>/`), reusable components (`src/components/common/`), layouts (`src/layouts/`), routes (`src/routes/`), hooks (`src/hooks/`), and API services (a `<feature>Service` object in `src/services/<feature>Service.ts`, types in `<feature>.types.ts`, calling `apiRequest` from `src/services/api.ts`).
4. Propose a plan for significant changes.

Implementation:

- Add API calls only in `src/services/` (a `<feature>Service` object using `apiRequest` from `api.ts`), with types that mirror the spec, and use them through TanStack Query hooks.
- Build pages from shared components; keep loading, empty, and error states explicit.
- Display money, currency, dates, and statuses per `frontend/data-display.md`.
- Map `422` `details` to form fields; handle `401` by returning to sign-in.
- Add or update Vitest + React Testing Library tests, with API responses mocked by MSW (synthetic data only).

Follow the module workflow in `FRONTEND_PLAN.md`: build, test, validate, record. There is no separate testing phase, so each module ships with its own tests. State: TanStack Query for server data, React Context only for the session, local state and the URL for UI state. No Redux (FD13).

After implementation (from `frontend/`, after `source ~/.nvm/nvm.sh && nvm use`, which selects Node 22 from `.nvmrc`):

- Run `npm run lint`, `npm run typecheck`, and `npm test` (or a focused `npx vitest run <path>`); run `npm run e2e` when a user journey changed.
- Report changed files and actual test results; never claim tests passed unless they were run.
- Record API gaps and assumptions in `FRONTEND_PLAN.md`.
