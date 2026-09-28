---
name: system-architecture
description: Design and review the Salary Management System architecture before implementation. Use when planning components, boundaries, data flow, deployment, or architecture trade-offs.
---

# System Architecture Skill

## Purpose
Design a pragmatic, explainable architecture for the Salary Management System. Favor clarity and incremental delivery over unnecessary infrastructure.

## Project context
- Web application for an HR Manager to manage employee salary records and view compensation analytics.
- Target dataset: approximately 10,000 employees.
- Proposed stack: React + Bootstrap, Ruby on Rails REST API, MySql.
- Prefer a modular monolith unless requirements establish a need for separate services.
- Salary management is in scope; payroll processing, tax/statutory calculations, and salary disbursement are out of scope.
- Analytics use structured data. Do not introduce an LLM, RAG, vector database, or Python service unless requirements change.
- Currency is explicit. Never aggregate amounts across currencies without a defined conversion policy.
- Authentication and server-side authorization are expected; one HR Manager role is sufficient initially.

## Workflow
1. Read `CLAUDE.md`, `BACKEND_PLAN.md`, and relevant `docs/` files.
2. Separate confirmed requirements from assumptions and proposals.
3. Identify users, use cases, system boundaries, and quality attributes.
4. Define frontend, backend, persistence, and external-system boundaries.
5. Describe request/data flows for employee management, salary updates/history, and analytics.
6. Define domain modules and responsibilities; keep business rules out of controllers and UI components.
7. Review security, data integrity, performance, operability, and testability.
8. Compare alternatives only when a meaningful decision is needed; record rationale and trade-offs.
9. Update architecture documentation and add an ADR under `docs/decisions/` for material decisions.
10. Keep the design consistent with scope and the phased development plan.

## Suggested starting architecture
- **React UI:** employee list/detail, salary record management, filters, and compensation dashboard.
- **Rails API:** authentication, authorization, validation, domain operations, and reporting endpoints.
- **Domain modules:** Employees, Salary Records/History, Organization Reference Data, and Compensation Analytics.
- **MySQL:** relational source of truth with foreign keys, indexes, and constraints.
- **Background jobs:** omit initially; add only for a demonstrated asynchronous or long-running task.
- **External integrations:** none in the initial scope.

## Design principles
- Prefer a modular monolith and clear internal boundaries.
- Use predictable REST endpoints, status codes, and validation errors.
- Keep controllers thin; use focused service objects for genuinely multi-step domain operations.
- Enforce authorization and critical validation on the server.
- Preserve salary history rather than overwriting prior compensation records.
- Store money using decimal precision, with currency stored separately; do not use floating-point money.
- Define effective-date semantics and prevent ambiguous overlapping periods where applicable.
- Use database constraints for invariants that must hold under concurrent requests.
- Paginate employee and salary lists; do not load all 10,000 employees into the browser.
- Keep analytics queries bounded and indexed; justify caching or denormalization.
- Do not add microservices, Kubernetes, event streaming, Redis, or complex RBAC without a requirement and documented reason.

## Required deliverables
When designing or reviewing architecture, provide:
1. A concise component diagram (Mermaid is acceptable).
2. Responsibilities of each component.
3. Main request/data flows.
4. Domain boundaries and data ownership.
5. Security and data-integrity considerations.
6. Trade-offs, assumptions, and exclusions.
7. Risks and open questions requiring confirmation.

## Review checklist
- Does each component support an in-scope requirement?
- Is there one clear source of truth for salary data?
- Are currency and effective-date semantics explicit?
- Are access checks server-side?
- Can the target dataset be handled with pagination and suitable indexes?
- Are analytics consistent with the currency policy?
- Can the architecture be implemented incrementally and tested?
- Are technologies justified rather than added by habit?
- Are decisions and unresolved assumptions documented?

## Output style
Be specific and concise. Separate facts from proposals. Explain significant decisions. Do not claim production-grade compliance, availability, or scalability without requirements and evidence.
