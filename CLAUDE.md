# Salary Management System

## Business Objective

Build a web application to manage salary information for approximately 10,000 employees across multiple countries and provide salary analytics for HR.

## Technology Stack

- Backend: Ruby on Rails REST API
- Frontend: React with Bootstrap (Vite, TypeScript; see docs/decisions/006-frontend-architecture.md)
- Database: MySQL
- Backend tests: Minitest (Rails default; `bin/rails test`)
- Frontend tests: React Testing Library
- E2E tests: Playwright
- Redis and Sidekiq: Only if justified by requirements

## Scope

- Employee management
- Salary records and salary history
- Bulk salary correction from CSV/XLSX uploads (scope change SC-01, docs/requirements.md FR-08; BACKEND_PLAN.md Phase 8)
- Search, filters and pagination
- Salary analytics and reports
- Single HR Manager user

## Explicitly Out of Scope

- Payroll processing and salary disbursement
- Tax and statutory calculations
- Banking, accounting and HRMS integrations
- Advanced RBAC and approval workflows
- LLM, chatbot, embeddings and RAG
- Microservices and complex distributed architecture
- Multi-region deployment and advanced DR

Do not implement excluded features unless requirements are explicitly changed and approved.

## Business Rules

- Store salary amount and currency separately.
- Never sum different currencies as if they were equal.
- Preserve salary history when salary changes.
- Use effective dates for salary records.
- Use synthetic data for development and demos.
- Do not expose sensitive salary information unnecessarily.

## Engineering Rules

@.claude/rules/backend.md
@.claude/rules/security.md

Path-scoped rules load automatically from `.claude/rules/` when matching files are in use, so they are not imported here:
- `testing.md` (backend and frontend tests);
- `frontend/react.md`, `frontend/components.md`, `frontend/api-integration.md`, `frontend/data-display.md`, `frontend/security.md` (files under `frontend/src/`).

## Current Plan

The frontend is complete (FRONTEND_PLAN.md F1–F9: phases, decisions, requirement → test matrix, status, and completion log); new frontend work adds to that plan. The backend is complete; BACKEND_PLAN.md records its phases, decisions, and known limitations, and supersedes the backend phases of PROJECT_DEV_PLAN.md. Do not modify the Rails backend during frontend work unless a change is approved in FRONTEND_PLAN.md.

## Commands

Backend: run from `backend/` with RVM Ruby 3.2.0 (gemset `ruby-3.2.0@salary-mgn-3.2.0`):

- Tests: `bin/rails test` (single file: `bin/rails test path/to/file_test.rb`)
- Style: `bin/rubocop`
- Security scan: `bin/brakeman --no-pager`
- Server: `bin/rails server` (health check: `GET /api/v1/health`)
- Database: `bin/rails db:migrate` then `bin/rails db:test:prepare` after pulling new migrations
- Reference data: `bin/rails db:seed`; demo data (development only): `bin/rails demo:seed`, `demo:reset`; read-only integrity report: `bin/rails demo:verify`
- HR login: `bin/rails hr:create_user` (reads `HR_USER_EMAIL`/`HR_USER_PASSWORD` from `backend/.env`)

Frontend: run from `frontend/` after `nvm use` (Node 22.23 via `.nvmrc`; nvm's default is still 18). In non-interactive shells, run `source ~/.nvm/nvm.sh && nvm use` first. These are available from FRONTEND_PLAN.md F2.1 (E2E from F3.1). Each module is built, tested, and validated before it is Done (module workflow in FRONTEND_PLAN.md):

- Dev server: `npm run dev` (proxies `/api` to the Rails server on `:3000`)
- Unit and component tests: `npm test` (Vitest + React Testing Library + MSW)
- Lint, types, and format: `npm run lint` (zero warnings), `npm run typecheck`, `npm run format` (Prettier)
- E2E: `npm run e2e` (Playwright against the running Rails server and development database; set `E2E_HR_EMAIL`/`E2E_HR_PASSWORD`; see FRONTEND_PLAN.md FD7)
- Build: `npm run build`

## Workflow

1. Read docs/requirements.md before implementation.
2. Propose an implementation plan before major changes.
3. Implement in small, reviewable steps.
4. Run relevant tests after changes.
5. Update documentation when design decisions change.
6. Do not silently change scope or assumptions.
