---
name: testing
description: Plan, implement, and review automated tests for the Salary Management System across Rails, React, API integration, and end-to-end workflows.
---

# Testing Skill

## Purpose
Create a reliable, maintainable test strategy. Verify observable behavior and business rules, especially salary history, authorization, and currency-safe analytics.

## Project context
- Frontend: React + Bootstrap; backend: Rails REST API; database: PostgreSQL.
- Target dataset: approximately 10,000 employees.
- Initial user: HR Manager.
- In scope: employee and salary record management, salary history, filters, and structured compensation analytics.
- Out of scope: payroll processing, tax/statutory calculations, salary disbursement, external HRMS/banking integrations, and conversational AI.

## Workflow
1. Read `CLAUDE.md`, relevant `.claude/rules/`, `PROJECT_DEV_PLAN.md`, and applicable `docs/`.
2. Identify acceptance criteria before writing tests.
3. Choose the lowest test level that verifies the behavior; add higher-level tests for critical journeys.
4. Add tests alongside implementation.
5. Use readable factories or fixtures with minimal setup.
6. Run focused tests first, then the relevant full suite.
7. Report exact commands and results. Never claim tests passed unless they were executed.
8. Update regression coverage when behavior or requirements change.

## Test layers

### Rails model and domain tests (RSpec)
Cover validations, associations, database constraints, salary precision and currency, effective-date boundaries, salary history preservation, and analytics aggregation rules.

### Rails request/API tests (RSpec)
Cover:
- Successful responses and expected schemas.
- Authentication and authorization for protected endpoints.
- Validation errors and not-found behavior.
- Pagination, filtering, and sorting.
- Protection against mass assignment of sensitive fields.
- Salary creation/update and preservation of history.
- Analytics filters and currency-safe totals.

### React component tests (React Testing Library)
Cover:
- Loading, success, empty, and error states.
- Employee and salary forms and validation feedback.
- Accessible labels and user interactions.
- Filter changes and displayed results.
- API failures without exposing technical details.
- Currency labels and formatting without combining unlike currencies.

### End-to-end tests (Playwright or equivalent)
Prioritize these journeys:
1. HR Manager signs in.
2. Searches for and opens an employee.
3. Adds a salary record.
4. Views salary history.
5. Filters compensation analytics and exports a report, if export is implemented.

Use deterministic synthetic data and isolate test state. Do not depend on production data or external services.

## Essential business scenarios
- Every salary record retains its currency.
- Analytics do not combine amounts from different currencies into a misleading total.
- Salary changes preserve prior history.
- Invalid dates and amounts are rejected.
- Unauthorized callers cannot retrieve sensitive salary data.
- Lists are paginated.
- Empty datasets and missing optional values render safely.
- CSV export, if implemented, correctly handles commas, quotes, and newlines and enforces authorization.

## Test data and isolation
- Use synthetic employee and salary data only.
- Keep tests independent and repeatable.
- Prefer transactional cleanup where supported.
- Avoid testing private implementation details when observable behavior is available.
- Freeze time or use explicit time zones for date-sensitive tests.

## Performance checks
The 10,000-employee target is a data-volume requirement, not a concurrency or latency SLA.
- Use realistic seed data to exercise key list and analytics endpoints.
- Inspect query counts and query plans where useful; check for N+1 queries.
- Verify pagination and indexes against realistic data.
- Do not invent hard performance thresholds. Label proposed thresholds as assessment targets and document their rationale.

## Security and privacy
- Test authorization at the API boundary, not only in the UI.
- Ensure sensitive salary data is not returned to unauthorized callers.
- Do not log salary payloads or credentials.
- Use test secrets and synthetic data.
- Ensure errors do not expose stack traces or internal details.

## Definition of done
- Acceptance criteria have corresponding tests at appropriate levels.
- Relevant tests pass, or failures are clearly reported.
- Regression coverage exists for changed behavior.
- Tests are deterministic and do not require external network access.
- Test commands and results are reported accurately.
- Known gaps are listed explicitly.

## Output format for test tasks
Summarize tests added/changed, scenarios covered, exact commands executed, pass/fail result, and known gaps or environment limitations.
