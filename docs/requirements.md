# Salary Management System — Requirements

**Document type:** Product and scope requirements  
**Status:** Approved baseline for backend implementation (2026-09-28)  
**Version:** 1.1  
**Source of truth:** This document together with `requirements.docx`. Decision IDs (D1–D27, C1–C7) refer to `BACKEND_PLAN.md` Phase 1 findings.

## 1. Business objective

Replace Excel-based salary tracking with a web application that enables HR to manage salary information for approximately 10,000 employees across multiple countries and understand compensation through structured search, dashboards, and reports.

## 2. Users and scope

- **Primary user:** One HR Manager.
- **In scope:** Employee records, salary records and history, search/filtering, salary analytics, and filtered report export.
- **Data scale:** Approximately 10,000 employees as the target dataset. This is not a stated concurrent-user requirement.

## 3. Functional requirements

### FR-01 — Employee management

The HR Manager can create, view, update, search, and filter employee records using relevant attributes such as employee identifier, name, country, department, and employment status.

### FR-02 — Salary records

The HR Manager can record and view an employee's salary amount, currency, and effective date. Validation must prevent invalid or incomplete salary records.

### FR-03 — Salary history

Salary changes must preserve prior salary records rather than silently overwriting history. The application must distinguish current and historical records and represent effective dates consistently.

### FR-04 — Search, filters, and pagination

Employee and salary listings must support practical search/filtering and pagination. Filters should be consistently applied to displayed and exported results.

### FR-05 — Compensation analytics

The HR Manager can view aggregate compensation information, including totals grouped by currency, average/median where meaningful, salary distribution, and comparisons by country or department.

### FR-06 — Reports and export

The HR Manager can produce filtered reports and export the resulting data in a practical format such as CSV. Exported data must respect access controls and selected filters.

### FR-07 — Authentication and access

The application provides authentication and server-side authorization appropriate for the single HR Manager role. Advanced role administration is not required for the assessment.

## 4. Non-functional requirements

- **Performance:** Handle the target dataset using pagination, appropriate indexes, and efficient queries/aggregations. No specific latency target has been supplied.
- **Security and privacy:** Protect salary and employee information; validate inputs; avoid unnecessary exposure in logs, API responses, and exports.
- **Reliability:** Use database transactions where needed and preserve salary history.
- **Usability:** Provide a responsive, understandable HR interface with loading, empty, and error states.
- **Maintainability:** Use modular code, automated tests, and clear setup/API documentation.
- **Extensibility:** Keep the design open to future requirements without implementing speculative infrastructure now.

## 5. Proposed technology

- Backend: Ruby on Rails REST API
- Frontend: React with Bootstrap
- Database: MySql
- Tests: RSpec, React Testing Library, and end-to-end tests
- Redis/Sidekiq: Optional; introduce only when a concrete caching or background-processing need is established.

## 6. Explicit exclusions and rationale

| Excluded feature | Rationale |
|---|---|
| Payroll processing, net-pay calculation, and salary disbursement | The assessment concerns salary-data management, not payroll execution. |
| Tax and statutory calculations | Country-specific payroll rules are not required. |
| Banking, accounting, HRMS, or other integrations | No external integration requirement is specified. |
| Advanced RBAC and approval workflows | A single HR Manager role is sufficient for the stated scope. |
| Conversational AI, LLM, embeddings, and RAG | Structured salary data can be served through filters, aggregations, and reports; document Q&A is not required. |
| Microservices and complex distributed infrastructure | The current scope does not justify the operational complexity. |
| Multi-region deployment and advanced disaster recovery | No availability, recovery, residency, or compliance targets have been specified. |

## 7. Assumptions (confirmed 2026-09-28)

- Country and legal-entity counts are unspecified; seed data should demonstrate multiple countries.
- Salary `amount` is a **monthly** figure (gross base pay; bonuses, allowances, and net pay are excluded). Analytics report monthly values and label them as monthly.
- Currency is a structured salary attribute. Different currencies must not be summed into one monetary total unless a conversion policy is explicitly agreed.
- No concurrency, latency, uptime, RPO/RTO, or data-residency targets have been provided.
- Salary history and effective-date behavior follow the approved decisions in §10.
- One organization and one HR Manager. 10,000 is the employee record count, not the concurrent-user count.
- Country and department history is not tracked; analytics use each employee's current country and department.
- The future frontend will be served same-site (or through a development proxy), which the session-based authentication relies on.
- Use synthetic employee data for development and demonstrations.

## 8. Acceptance summary

The solution is acceptable when an authenticated HR Manager can manage and search employee records, maintain salary records with history, view currency-safe compensation analytics, and export filtered reports; core flows are tested and demonstrated against approximately 10,000 synthetic employee records.

## 9. Scope change control

Any feature outside this document should be treated as a scope change: record the business reason, impact, and revised acceptance criteria before implementation.

## 10. Approved decisions affecting requirements

Full rationale for each decision is in `BACKEND_PLAN.md` (Phase 1 findings).

| Topic | Decision | Ref |
|---|---|---|
| Database | MySQL 8.x (`requirements.docx` corrected to match). | C1, D1 |
| Salary create and update | A salary **change** creates a new record and closes the previous period. An **update** corrects the amount or currency of the current record or a future-dated record. Historical records are immutable and nothing is deleted. A salary cannot start before the employee's hire date. | C2, D4, O1, I13 |
| Audit history | Satisfied by the preserved salary history plus record timestamps. A separate audit-log table is not required for a single user. | C3, D5 |
| Salary amount | Monthly gross base pay, in the record's currency. | D3 |
| "Total salary expenditure" | Reported as a monthly total **per currency**. There is no cross-currency total. | C4, D20 |
| Current salary | The record in effect on the as-of date (default: today, in the application time zone). Future-dated records are allowed. Periods may not overlap. | D6–D9 |
| Money precision | `DECIMAL(18,4)`, with the amount's scale validated against the currency's minor units. | D10 |
| Employees | Required fields and statuses (`active`, `on_leave`, `terminated`) as in D12. No hard delete; terminated employees are excluded from analytics by default. | D12, D13 |
| Reference data | Countries, departments, and currencies are seeded and exposed read-only. | D15 |
| Authentication | One seeded HR user with a cookie session, CSRF protection, and rate-limited login. Unauthenticated requests get `401`. | D16, D17 |
| Salary exposure | Employee lists omit salary and email. Salary appears only in employee detail, salary, analytics, and report endpoints. The CSV export excludes email. | D18 |
| Reports and export | CSV export is in scope. A paginated JSON report and its CSV export share the same filters. The CSV is capped at 10,000 rows: a larger result returns an error asking the user to narrow the filters, and nothing is silently truncated. CSV output is protected against formula injection. | C6, D19, D24 |
| Analytics | Per currency: total, average, median, and distribution bands. Also a country and department breakdown. Filters: country, department, status, and as-of date. | D20–D22 |
| Listings | Default page size 25, maximum 100. Sorting only on allowlisted fields. | D23 |

## 11. Backend traceability

The planned phase refers to `BACKEND_PLAN.md`. The endpoint paths below are relative to `/api/v1`.

| Requirement | Backend capability | Planned endpoints | Planned specs | Phase |
|---|---|---|---|---|
| FR-01 Employee management | Create, view, and update employees; read-only reference data | `GET/POST /employees`, `GET/PATCH /employees/:id`, `GET /countries`, `GET /departments`, `GET /currencies` | Employee model validations (required fields, unique `employee_number`, status values); request specs for create/update, `422` validation, `404` without data leakage, no salary in list payload | 3.1, 4.3 |
| FR-02 Salary records | Record a salary change; correct the current record; optional initial salary when creating an employee | `POST /employees/:id/salary_records`, `GET /employees/:id/salary_records/:rid`, `PATCH /employees/:id/salary_records/:rid` | SalaryRecord model specs (positive amount, valid currency, scale vs minor units, date order); request specs for create, correction, and invalid input | 3.2, 4.4 |
| FR-03 Salary history | Preserve history; close previous period; distinguish current from historical records | `GET /employees/:id/salary_records` | Salary-change service specs: closes prior period, transaction rollback on failure, overlap/backdate rejected, future-dated record not treated as current, one-open-record guard; PATCH on a historical record returns `422` | 3.2, 4.4 |
| FR-04 Search, filters, pagination | Search, filter, sort, and paginate employees and salary reports | `GET /employees?q=&country_id=&department_id=&employment_status=&sort=&page=&per_page=`, `GET /reports/salaries` | Request specs for filter combinations, `per_page` cap, rejected sort fields, pagination metadata; query-count check (no N+1) | 4.3, 5.2 |
| FR-05 Compensation analytics | Per-currency monthly total, average, median, distribution; country and department breakdown | `GET /analytics/summary`, `GET /analytics/distribution`, `GET /analytics/breakdown` | Query-object specs with known data: per-currency totals, median for odd and even counts, no cross-currency total, as-of date handling, terminated employees excluded; request specs for filters and `401` | 5.1, 5.2 |
| FR-06 Reports and export | Filtered salary report as JSON and CSV | `GET /reports/salaries`, `GET /reports/salaries.csv` | CSV rows match JSON report for the same filters; row cap; formula-injection escaping; column allowlist; `401` when unauthenticated | 5.3 |
| FR-07 Authentication and access | Single HR login; default-deny protection on all endpoints | `POST /session`, `DELETE /session`, `GET /session` | Login success/failure (generic message), logout, rate limiting, CSRF, `401` on every protected route | 4.1 |
| NFR Performance | Pagination, indexes, efficient aggregates at about 10k employees | — | Seeded 10k run; query plans and N+1 review (no latency SLA claimed) | 3.3, 6.2 |
| NFR Security and privacy | Strong parameters, filtered logs, safe error messages | — | Parameter-filter spec for salary fields; error envelope contains no record data; unpermitted parameters ignored | 4.1, 4.2, 6.3 |
| NFR Reliability | Transactions for salary changes; preserved history | — | Rollback and concurrency-guard specs | 3.2, 4.4 |
| NFR Maintainability | Modular code, automated tests, documented API | — | RSpec suite; setup and API docs | 6.1, 7.2 |
| NFR Usability | Responsive, accessible UI | — | Out of backend scope; deferred to the frontend plan | — |

Excluded from backend scope: frontend implementation and the features listed in §6.
