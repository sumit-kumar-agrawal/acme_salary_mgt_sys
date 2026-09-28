# Salary Management System — Requirements

**Document type:** Product and scope requirements  
**Status:** Proposed baseline for interview assessment  
**Version:** 1.0

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

## 7. Assumptions and open points

- Country and legal-entity counts are unspecified; seed data should demonstrate multiple countries.
- Currency is a structured salary attribute. Different currencies must not be summed into one monetary total unless a conversion policy is explicitly agreed.
- No concurrency, latency, uptime, RPO/RTO, or data-residency targets have been provided.
- Salary history and effective-date behavior are proposed design choices and should be confirmed if the assessment defines different semantics.
- Use synthetic employee data for development and demonstrations.

## 8. Acceptance summary

The solution is acceptable when an authenticated HR Manager can manage and search employee records, maintain salary records with history, view currency-safe compensation analytics, and export filtered reports; core flows are tested and demonstrated against approximately 10,000 synthetic employee records.

## 9. Scope change control

Any feature outside this document should be treated as a scope change: record the business reason, impact, and revised acceptance criteria before implementation.
