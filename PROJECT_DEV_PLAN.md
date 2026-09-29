# Salary Management System — Project Development Plan

Purpose: Develop a web-based application to replace Excel-based salary
management for 10,000 employees across multiple countries. HR should be able
to manage salary information and analyze compensation through reports and
dashboards. Each subphase includes a goal, Claude Code prompt, deliverables,
acceptance criteria, and status.

Stack: Rails REST API, React + Bootstrap, MySql. Target data: approximately
10,000 employees across multiple countries.

Scope boundary: Salary-data management and analytics only. Payroll
processing, tax/statutory calculations, salary disbursement, banking/HRMS
integrations, advanced RBAC/approvals, chatbot/LLM/RAG, microservices, and
advanced multi-region DR are excluded unless requirements are formally
changed.

> **Superseded for backend work (2026-09-28):** `BACKEND_PLAN.md` governs all
> backend requirements, design, Rails, database, API, and backend-test work.
> Phase 1, subphases 2.1–2.2, and Phase 3 below are superseded and kept for
> reference only. Subphases 2.3–2.4 (React foundation and local integration)
> are superseded by `FRONTEND_PLAN.md` (2026-09-29), which governs all
> frontend work; this file is kept for history only.

## How to use this plan

1. Read CLAUDE.md, docs/requirements.md, and this file before work.
2. Work on one subphase at a time.
3. Do not start the next subphase until acceptance criteria are checked.
4. After each subphase, update status and append changed files, tests
   actually run, and decisions.
5. Stop and document ambiguities; do not silently expand scope.

Status: Not Started / In Progress / Blocked / Done

---

## Phase 1 — Requirements and design _(superseded by BACKEND_PLAN.md Phase 1)_

Goal: Produce an implementation-ready design before coding

### 1.1 Requirements review

- **Prompt:** Read CLAUDE.md, docs/requirements.md, and
  PROJECT_DEV_PLAN.md. Extract in-scope features, exclusions, assumptions,
  and acceptance criteria. Identify ambiguities that could affect
  implementation. Do not write application code.
- **Deliverables:** Requirements checklist and open questions.
- **Acceptance:** Every feature maps to an agreed requirement; exclusions
  are explicit.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 1.2 Architecture

- **Prompt:** Propose a simple modular-monolith architecture using Rails,
  React, and MySql. Describe component responsibilities, request/data flow,
  authentication boundary, error handling, and local setup. Explain
  trade-offs and avoid unjustified infrastructure. Update
  docs/architecture.md; do not implement code.
- **Deliverables:** Architecture document and component/data-flow diagram.
- **Acceptance:** Covers all in-scope use cases without microservices or
  RAG.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 1.3 Database design

- **Prompt:** Design the MySql schema for employees and effective-dated
  salary history. Address countries, currencies, data integrity, salary
  changes, indexes, and currency-safe analytics. Document entities,
  columns, constraints, and trade-offs in docs/database-design.md. Do not
  create migrations yet.
- **Deliverables:** ERD and database design.
- **Acceptance:** Supports employee search, salary history, and required
  reporting; amount and currency remain associated.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 1.4 API contract

- **Prompt:** Define REST endpoints, methods, request/response examples,
  pagination, filters, validation errors, and authorization expectations
  for employee, salary-history, and analytics features. Save
  docs/api-specification.md. Do not add payroll or integration endpoints.
- **Deliverables:** API specification.
- **Acceptance:** Every UI workflow has a documented API and clear
  currency/effective-date semantics.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

Phase gate: Review and approve requirements, architecture, schema, and API
contract.

---

## Phase 2 — Repository and application foundation

Goal: Create reproducible, bootable applications.

### 2.1 Repository setup _(superseded by BACKEND_PLAN.md 2.1)_

- **Prompt:** Set up the repository structure from CLAUDE.md and this
  plan. Add README, .gitignore, and .env.example. Do not implement
  business features or commit secrets.
- **Deliverables:** Project structure and setup documentation.
- **Acceptance:** Clean setup instructions; secrets excluded.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 2.2 Rails API foundation _(superseded by BACKEND_PLAN.md 2.2–2.3)_

- **Prompt:** Initialize the Rails API in backend/ with MySql, environment
  configuration, a health endpoint, and RSpec. Add a baseline request test
  and verify the app boots and connects to the database. Do not add domain
  models yet.
- **Deliverables:** Bootable API and baseline test.
- **Acceptance:** App boots; health endpoint and test pass.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 2.3 React foundation

- **Prompt:** Initialize React in frontend/ with Bootstrap, routing
  foundation, environment-based API URL, a minimal app shell, and a
  baseline component test. Do not build feature screens yet.
- **Deliverables:** Bootable frontend and baseline test.
- **Acceptance:** App renders and baseline test passes.
- **Status:** Not Started

### 2.4 Local integration

- **Prompt:** Configure the minimum required local integration between
  React and Rails, including CORS and environment settings. Add
  docker-compose only if it materially simplifies setup. Verify the
  frontend can call the Rails health endpoint.
- **Deliverables:** Working local integration and instructions.
- **Acceptance:** Both apps run locally and communicate.
- **Status:** Not Started

Phase gate: Both applications boot and baseline checks pass.

---

## Phase 3 — Backend domain and APIs _(superseded by BACKEND_PLAN.md Phases 3–4)_

Goal: Implement tested employee and salary management.

### 3.1 Models and migrations

- **Prompt:** Implement the approved employee and effective-dated salary
  schema in Rails. Add validations, database constraints, indexes,
  factories/seeds, and model specs. Preserve salary history. Use synthetic
  data only. Do not add payroll or unrelated entities.
- **Deliverables:** Migrations, models, factories/seeds, model specs.
- **Acceptance:** Migrations run and salary-history behavior is tested.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 3.2 Employee APIs

- **Prompt:** Implement employee endpoints from docs/api-specification.md,
  including permitted fields, search, filters, pagination, consistent
  JSON, and request specs. Keep controllers thin, avoid N+1 queries, and
  do not expose unnecessary sensitive fields.
- **Deliverables:** Employee endpoints and request specs.
- **Acceptance:** API contract, filtering, pagination, validation, and
  access behavior are tested.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 3.3 Salary and history APIs

- **Prompt:** Implement salary endpoints per the API contract. A salary
  change must preserve prior history, validate effective dates and
  currency, and use transactions where needed. Add request/model tests. Do
  not calculate payroll, tax, or net pay.
- **Deliverables:** Salary endpoints and tests.
- **Acceptance:** Current and historical records behave correctly; invalid
  changes are rejected.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

### 3.4 Authentication and authorization

- **Prompt:** Implement proportionate secure authentication for one HR
  Manager and server-side protection for employee and salary endpoints.
  Keep secrets in environment configuration. Add tests for unauthenticated
  and unauthorized access. Do not build advanced RBAC or approvals.
- **Deliverables:** Authentication and access-control tests.
- **Acceptance:** Protected endpoints reject unauthorized requests.
- **Status:** Superseded by BACKEND_PLAN.md (2026-09-28)

Phase gate: Employee and salary APIs work and relevant backend tests pass.
