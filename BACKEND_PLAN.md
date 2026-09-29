# Salary Management System — Backend Development Plan

**Purpose:** Phased implementation plan for the Rails backend and REST API only. Frontend work will be planned separately later.

**Stack:** Ruby on Rails 8 (Ruby 3.2.0), MySql, Minitest. Target data volume: approximately 10,000 employees across multiple countries.

**Scope:** Employee and salary-data management, salary history, authentication/authorization, and structured compensation analytics APIs. Excludes payroll processing, tax/statutory calculations, salary disbursement, external HRMS/banking integrations, conversational AI/RAG, and frontend implementation.

## How to use this plan
1. Read `CLAUDE.md`, `docs/requirements.md`, and relevant architecture/API documents before starting.
2. Complete one subphase at a time and verify its acceptance criteria before proceeding.
3. Keep implementation aligned with documented requirements and decisions.
4. Update each status and the completion log with changed files, tests actually run, and decisions.
5. Stop and document ambiguities rather than silently expanding scope.

**Status:** Not Started / In Progress / Blocked / Done

---

## Phase 1 — Backend requirements and design
**Goal:** Finalize an implementation-ready design for the Rails API and its data model before coding.

### Phase 1 review findings (2026-09-28)

Documents reviewed: `CLAUDE.md`, `.claude/rules/*`, `requirements.docx`, `docs/requirements.md`, `docs/architecture.md`, `docs/database-design.md`, `docs/api-specification.md`, `docs/decisions/001–003`, `PROJECT_DEV_PLAN.md`, and this plan. No application code exists yet.

#### A. Conflicts between source documents

| # | Conflict | Where | Impact |
|---|---|---|---|
| C1 | `requirements.docx` (marked "Scope agreed") specifies **PostgreSQL**; `CLAUDE.md`, `docs/requirements.md`, and all design docs specify **MySql**. | docx §4 vs CLAUDE.md | **Resolved 2026-09-28:** MySql confirmed; docx corrected by the project owner. |
| C2 | docx requires **"create and update salary records"**; API spec only allows create/list/show on salary records. | docx §2 vs api-spec §4 | **Resolved 2026-09-28:** create and update approved; API spec §7 updated (POST = salary change, PATCH = correct the current or a future-dated record, per O1). |
| C3 | docx requires **"maintain audit history"** (reliability); md mentions only salary history. | docx §3 vs requirements.md §4 | **Resolved 2026-09-28:** salary history plus timestamps (D5). |
| C4 | docx lists **"total salary expenditure"** as an analytic; currency rules forbid cross-currency sums. | docx §2 vs ADR 002 | **Resolved 2026-09-28:** monthly total per currency (D20). |
| C5 | Two overlapping plans exist: `PROJECT_DEV_PLAN.md` (full-stack, auth in 3.4) and this plan (backend-only, auth in 4.4). Task 1.1 here still references `PROJECT_DEV_PLAN.md`. | Both plans | **Resolved 2026-09-28:** this plan governs backend work; PROJECT_DEV_PLAN.md backend phases marked superseded. |
| C6 | This plan's 5.3 treats CSV export as conditional ("if included in approved requirements"). Both requirements documents include export (FR-06, docx "Reporting"). | 5.3 vs FR-06 | **Resolved 2026-09-28:** export confirmed in scope; 5.3 made unconditional. |
| C7 | Auth (4.4) is scheduled **after** the employee/salary endpoints (4.2–4.3), so those endpoints would exist unprotected and their specs would need rework. | Phase 4 ordering | **Resolved 2026-09-28:** auth moved to 4.1; employee and salary endpoints renumbered 4.3/4.4. |

#### B. Missing decisions

Each decision has a proposed default so review can be quick. **Blocks** names the first Phase 1 task that needs the answer.

| ID | Decision | Proposed default | Blocks |
|---|---|---|---|
| D1 | Database engine (C1) | MySQL 8.x, matching CLAUDE.md and the installed toolchain; update the docx reference or record the change in an ADR. | **Approved** (docx corrected) |
| D2 | Authoritative plan (C5) | This plan governs backend work; `PROJECT_DEV_PLAN.md` is marked superseded for backend phases. | **Approved** (PROJECT_DEV_PLAN.md updated) |
| D3 | What `amount` means | **Monthly** salary amount (assumed gross base pay, excluding bonuses and allowances; net pay is payroll and out of scope). No pay-frequency field. Analytics report monthly figures, labelled as such. | **Approved: monthly gross base** |
| D4 | Salary correction/update (C2) | Historical records are immutable. Only the **current** record's `amount`/`currency_code` may be corrected (PATCH), inside a transaction. A salary *change* always creates a new record. No DELETE. **Extended by O1:** future-dated (scheduled) records may also be corrected. | **Approved** (API spec updated) |
| D5 | Audit history (C3) | Salary history plus `created_at`/`updated_at` is enough for a single user. A separate audit-log table is out of scope unless confirmed. | 1.3 |
| D6 | Future-dated salary records | Allowed. At most one open-ended record per employee. | 1.3 |
| D7 | Definition of "current salary" | The record where `effective_from <= as_of_date` and (`effective_to IS NULL` or `effective_to >= as_of_date`). `as_of_date` defaults to today. `effective_to IS NULL` alone is **not** sufficient once future-dated records exist. | 1.3 |
| D8 | Overlap and backdating rules | Periods may not overlap. A new record must start after the latest record's `effective_from`. The previous record is closed at `new.effective_from - 1 day`. Inserts into the middle of history are rejected in v1. | 1.3 |
| D9 | Effective-date type and time zone | Date only. "Today" is evaluated in one configured application time zone (proposed: UTC). | 1.3 |
| D10 | Money precision | `DECIMAL(15,2)` works for ~10k employees but cannot hold 3-decimal currencies (e.g. KWD). Proposed: `DECIMAL(18,4)`, with the scale validated against `currencies.minor_units`. Alternative: restrict to 0–2 decimal currencies. | 1.3 |
| D11 | Link between salary currency and employee country | Not enforced. An employee may be paid in any supported currency. | 1.3 |
| D12 | Required employee fields and employment statuses | Required: `employee_number`, `first_name`, `last_name`, `country`, `department`, `employment_status`. Optional: unique `email`, `hired_on`. Statuses: `active`, `on_leave`, `terminated`. | 1.3 |
| D13 | Employee deletion | No hard delete. Status becomes `terminated`. Terminated employees are excluded from analytics by default. | 1.3 |
| D14 | Employees with no salary record | Allowed. The initial salary can be supplied optionally in the create request (one transaction). | 1.4 |
| D15 | Reference-data management | Countries, departments, and currencies are seeded. The API exposes read-only lists for filters, with no CRUD in v1. | 1.4 |
| D16 | Authentication mechanism | One HR user seeded from environment variables via a rake task, with no sign-up. `has_secure_password` (bcrypt, one justified gem) plus a cookie session, CSRF protection, and Rails 7.2 `rate_limit` on login. JWT deferred. | 1.2 |
| D17 | Meaning of 403 with a single role | 401 for unauthenticated requests. 403 is effectively unused in v1; this is documented so tests assert 401 only. | 1.4 |
| D18 | Fields shown in employee lists | The list excludes salary amounts **and email**. Current salary appears only on employee detail and in salary endpoints, following the "do not expose unnecessarily" rule. | 1.4 |
| D19 | Cross-employee salary listing and report (FR-04, FR-06) | Add `GET /reports/salaries` (paginated JSON) as the counterpart of the CSV export, sharing one filter/query object. | 1.4 |
| D20 | Analytics population | Current salaries as of `as_of_date`, active and on-leave employees, grouped by currency. Filters: country, department, status, as-of date. | 1.4 |
| D21 | Median calculation | MySQL has no `MEDIAN()`. Proposed: a per-currency median using window functions (`ROW_NUMBER`/`COUNT` OVER), in a query object tested against known data. | 1.3 |
| D22 | Distribution bands | Per-currency bands with fixed-width buckets, computed from each currency's min/max (proposed 10 buckets), with the band edges returned in the response. | 1.4 |
| D23 | Pagination and sorting | `per_page` defaults to 25, maximum 100. Sort allowlist: `employee_number`, `last_name`, `hired_on`, `created_at`. | 1.4 |
| D24 | Export limits | Synchronous CSV with every filter applied and a hard cap of 10,000 rows. Exceeding it returns `422 export_too_large`; nothing is truncated. Values starting with `= + - @` or a tab/CR are escaped. No Sidekiq. | 1.4 |
| D25 | Ruby/Rails versions | **Superseded 2026-09-28:** the owner generated Rails 8.0.5 on Ruby 3.2.0 (RVM). See ADR 005 and Phase 2 G6. | 1.2 |
| D26 | Serialization and pagination libraries | **Superseded 2026-09-28:** `jbuilder` views (per `.claude/rules/backend.md`) and `pagy` for pagination; see ADR 005. | 1.2 |
| D27 | Character set and search | `utf8mb4` with case-insensitive collation. `q` does a prefix/contains `LIKE` on number and name. A full scan is acceptable at 10k rows; revisit only if measurement shows a problem. | 1.3 |

**D5–D27 approved as proposed on 2026-09-28.** They are recorded in `docs/requirements.md` §10 and will be detailed in tasks 1.2–1.4.

#### C. Assumptions (confirmed 2026-09-28)
- One organization and one HR Manager. 10,000 is the record count, not the concurrent-user count.
- No latency, uptime, RPO/RTO, retention, or data-residency targets. None will be claimed.
- No currency conversion. All monetary aggregates are per currency.
- Country and department history is not tracked. Analytics use each employee's *current* country and department.
- All data is synthetic. No real PII is imported.
- The frontend is deferred, but the auth decision (D16) assumes it will be served from the same site or through a dev proxy.

#### D. Dependencies
- **D1 (database)** blocks the whole of 1.3 and Phase 2.
- **D4, D6–D8** (history semantics) block the salary schema, the salary API, and the analytics as-of logic.
- **D16 (auth)** depends on how the future frontend is hosted (same-site vs cross-origin). Changing it later affects CSRF/CORS setup.
- **D25 (versions)** must be settled before `rails new` in 2.2.
- Tooling on the reviewer's machine: MySQL 8.0.16+ (needed for enforced CHECK constraints), a Ruby version matching D25, and bcrypt native-extension build tools.

#### E. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| The docx/md database conflict is resolved late, forcing migration rework | Medium / High | Resolve D1 first in 1.1 |
| Future-dated records make "current salary" wrong if defined as `effective_to IS NULL` | High / High | Adopt the date-based definition in D7 and test at boundary dates |
| Race condition: two concurrent salary changes create overlapping periods | Low (single user) / High | Transaction plus `SELECT … FOR UPDATE` on the employee row; unique "one open record" guard via a generated column (MySQL has no partial index) |
| Median/distribution queries are slow or incorrect on MySQL | Medium / Medium | Query objects with fixture-verified tests; measure with 10k seed rows in Phase 6 |
| Currency precision mismatch (0-, 2-, or 3-decimal currencies) | Medium / Medium | D10 validation against `minor_units` |
| Salary values leak into logs, errors, or exports | Medium / High | Filter parameters, sanitised error envelopes, explicit export column list |
| Endpoints built before auth (C7) | High / Medium | Mitigated: auth is now 4.1 |
| Ruby 3.1 end-of-life | Certain / Low for an assessment | Record the choice in D25 |

#### F. Changes recommended to later phases (all applied by 2026-09-28)
- ~~**4.4 → 4.1:** build the authentication foundation before any domain endpoint.~~ Applied 2026-09-28.
- ~~**5.3:** remove the "if approved" condition, since export is in scope.~~ Applied 2026-09-28 (C6).
- ~~**4.3:** add the PATCH correction on the current record if D4 is accepted.~~ Applied to 4.4 on 2026-09-28.
- ~~**5.x:** add the `GET /reports/salaries` JSON endpoint from D19.~~ Applied to 5.2 in task 1.5.

### 1.1 Backend scope, acceptance criteria, and decision sign-off
**Prompt:** `Read CLAUDE.md, docs/requirements.md, requirements.docx, and this plan. Resolve conflicts C1–C7 and record the approved decisions from the Phase 1 findings. Produce a backend requirements checklist mapping each FR/NFR to endpoints and acceptance tests. Do not write application code.`
**Tasks:**
1. Get sign-off on D1–D3. Where it differs, update `docs/requirements.md` and note the docx discrepancy in it.
2. Write a traceability table (FR-01…FR-07 plus NFRs → backend capability → planned endpoint → planned spec) in `docs/requirements.md` §11 (approved decisions are in §10).
3. Mark `PROJECT_DEV_PLAN.md` backend phases as superseded by this plan (D2).
4. Record the assumptions (§C) as confirmed or open.

**Deliverables:** Updated `docs/requirements.md` (traceability plus resolved conflicts) and a decision log entry.
**Acceptance:** Every backend feature maps to a requirement; C1–C7 each have a recorded resolution; excluded and frontend work is explicitly out of scope.
**Status:** Done (2026-09-28). Re-validated on 2026-09-28 after tasks 1.3–1.5; stale references were corrected.

### 1.2 Backend architecture
**Prompt:** `Update docs/architecture.md for the backend-only modular monolith using the approved decisions. Define domain modules, request/data flows, auth boundary, error envelope, logging/redaction policy, and deployment assumptions. Include a Mermaid component diagram. Do not implement code.`
**Tasks:**
1. Define domain modules and ownership: Auth, Employees, Reference Data, Salary History, Analytics/Reports.
2. Document the main request flows as sequence diagrams: login, salary change (transaction plus lock), analytics query, CSV export.
3. Specify the auth boundary (D16, D17), session/CSRF/CORS configuration, and login rate limiting.
4. Define the error-handling contract (error envelope, 404 without record data) and the parameter-filtering list for logs.
5. Record D25 (versions) and D26 (libraries) with justification for each gem.
6. Write ADR 004 (authentication) and ADR 005 (runtime versions and libraries). A database-engine ADR is not needed, because D1 matches the docx after its correction.

**Deliverables:** Updated `docs/architecture.md` and ADRs 004/005.
**Acceptance:** Every in-scope use case has a component owner and a flow; no unjustified infrastructure; the auth and redaction policies are explicit.
**Status:** Done (2026-09-28)

### 1.3 Database design
**Prompt:** `Finalize docs/database-design.md for MySQL using the approved decisions. Specify exact column types, nullability, defaults, FKs, CHECK constraints, unique/composite indexes, the "one open salary record" guard, and the current-salary and median query shapes. Do not create migrations.`
**Tasks:**
1. Finalize table definitions for D10–D13 and D27 (types, precision, nullability, charset). Add the `users` table (email, password_digest) required by ADR 004.
2. Specify salary-history rules for D4 and D6–D9: overlap prevention, closing the previous period, the correction rule, and the current-salary query.
3. Design the concurrency guard (row lock plus a generated-column unique index) and document the transaction boundaries.
4. Draft the current-salary, per-currency aggregate, median (D21), and distribution SQL shapes, and identify the indexes they need.
5. Define the seed strategy: deterministic, about 10k employees, multiple currencies, a subset with history, including future-dated records.
6. Update ADR 002 (precision) and ADR 003 (history semantics) and move them to Accepted.

**Deliverables:** Final ERD, column-level schema, index list with the query each serves, and updated ADRs.
**Acceptance:** Every endpoint in 1.4 can be served by the schema; every integrity rule is enforced by a DB constraint or a documented transactional check.
**Status:** Done (2026-09-28). I13 and O1 in docs/database-design.md §11 await review.

### 1.4 REST API contract
**Prompt:** `Finalize docs/api-specification.md with complete request/response examples for auth, employees, salary records, reference data, analytics, and reports/export, using the approved decisions. Do not add payroll or integration endpoints.`
**Tasks:**
1. Add the auth endpoints: `POST /session`, `DELETE /session`, `GET /session`.
2. Add the read-only reference endpoints: `/countries`, `/departments`, `/currencies` (D15).
3. Finalize the employee endpoints, including the list/detail field sets (D18), optional initial salary on create (D14), filters, sort allowlist, and pagination limits (D23).
4. Finalize the salary endpoints, including the PATCH correction rule (D4) and effective-date and as-of semantics.
5. Define the analytics metrics precisely (D20–D22), with per-currency response examples and the definitions of median and distribution.
6. Add `GET /reports/salaries` plus `.csv` with shared filters and the row cap (D19, D24).
7. Write an error and status-code catalogue for each endpoint (401/404/422; 403 per D17).

**Deliverables:** Complete API specification.
**Acceptance:** Every endpoint has a request/response example, validation errors, status codes, and currency/effective-date semantics; nothing contradicts the database design.
**Status:** Done (2026-09-28)

### 1.5 Phase 1 consistency review
**Prompt:** `Cross-check requirements, architecture, database design, API spec, and ADRs for contradictions. Update this plan's later phases per §F if approved.`
**Tasks:**
1. Check requirements ↔ API ↔ schema traceability and fix gaps.
2. Apply the approved changes from §F to Phases 4–5.
3. Mark all ADRs Accepted or Rejected and record the gate outcome in the completion log.

**Deliverables:** Consistency checklist and an updated plan.
**Acceptance:** No open blocking decisions remain; all documents agree.
**Status:** Done (2026-09-28)

**Consistency checklist (2026-09-28):**

| Check | Result |
|---|---|
| Every FR-01…FR-07 maps to an endpoint and a phase (requirements §11 ↔ API §11) | Pass |
| Every API endpoint is served by the schema and its query shapes (API ↔ DB design §7) | Pass. Added the summary count definitions (DB §7.1) and the report sort allowlist (DB §7.5) |
| Salary rules agree across ADR 003, DB §5–§6, API §7, architecture §4.2, requirements §10, and plan 4.4 | Pass. Plan 4.4 was still "current record only"; updated for O1 |
| Currency rules agree (ADR 002, DB §7, API §8, architecture §8) | Pass |
| Auth agrees (ADR 004, architecture §5, API §4, plan 4.1) | Pass. Plan 4.1 now owns the `users` migration; 3.1 notes this |
| Privacy (D18) agrees | Pass. D18 and requirements §10 now also mention email, matching API §6.1 and the CSV columns |
| Export cap agrees | Pass. Requirements §10 wrongly applied the cap to the JSON report; now CSV only, with `422 export_too_large` (D24 aligned) |
| Error catalogue agrees (architecture §6 ↔ API §10) | Pass |
| Plan phases match the API endpoint→phase map | Pass. 4.3 now includes the reference-data endpoints; 5.2 now includes the JSON report (§F D19); 2.2 includes health `503` |
| I13 holds for both write paths | Gap closed. An employee `PATCH` could move `hired_on` after an existing salary; now rejected with `422` (DB §5, API §6.4) |
| ADRs 001–005 | All Accepted (001 accepted in this task) |
| Decisions D1–D27, C1–C7, I13, O1 | All resolved; none deferred |

**Phase 1 gate: passed on 2026-09-28.**

**Phase gate:** Backend requirements, architecture, schema, and API contract are reviewed and consistent; decisions D1–D27 are resolved or explicitly deferred with a reason.

---

## Phase 2 — Repository and Rails foundation
**Goal:** Create a reproducible, bootable Rails API project.

### Phase 2 review findings (2026-09-28, updated after the owner's scaffold)

Inputs: Phase 1 documents, `CLAUDE.md`, `.claude/rules/*`, the repository, the local toolchain, and the `backend/` app the owner generated and committed. No domain code exists yet.

#### Current state (observed after the scaffold)

| Item | Observation |
|---|---|
| Ruby | **3.2.0 via RVM** (`backend/.ruby-version`). RVM also has 3.1.2 and 2.7.3. |
| Rails | **8.0.5.1** (`~> 8.0.5`), `config.load_defaults 8.0`. Generated with the **full-stack default**, not `--api`. |
| Gems | Adopted: mysql2, puma, jbuilder, pagy 43, dotenv-rails, solid_cache, solid_queue, brakeman, rubocop-rails-omakase. Pending decisions: propshaft, importmap, turbo, stimulus, solid_cable, kamal, thruster, capybara, selenium-webdriver (see G1–G3). `bcrypt` is commented out. |
| Database | Local Homebrew MySQL 8.4 on 3306. `database.yml` uses `ENV.fetch` for `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, and `DB_NAME`, with `utf8mb4_unicode_ci`. Databases are `salary_management` and `salary_management_test`. In development, the queue, cache, and cable roles share the primary database. **The fallback credentials are `root`/`root`** (G5). |
| Env | `backend/.env` exists (ignored). `backend/.env.example` now lists `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, but is still ignored by `/.env*` (G8 kept), and **`DB_USER` does not match `DB_USERNAME`** in `database.yml` (H2). |
| Routes | Only the generated `GET /up`. No `/api/v1/health` yet. |
| Config | `time_zone` not set; `filter_parameters` still the Rails 8 defaults (these already include `email`). |
| Tests | Minitest (owner decision; G2 reverted). `test_helper.rb` runs tests in parallel (`parallelize(workers: :number_of_processors)`) with `fixtures :all`. `minitest` 6.0.6 in the lockfile. |
| Deploy/CI | `Dockerfile`, `.kamal/`, `config/deploy.yml`, and `backend/.github/` generated. GitHub ignores `.github/` inside a subfolder. |
| Git | Owner-managed. Latest commit `8e3cb86`. `backend/` and `.idea/` are tracked. **Uncommitted:** the G3 changes (Gemfile, lockfile, `cable.yml`, `database.yml`, deleted `cable_schema.rb`) and the untracked **ADRs 004 and 005**. No root `.gitignore`; `.DS_Store` untracked. No `db/schema.rb` yet, so `db:prepare` has not run. |

#### A. Decisions: status after the scaffold

| ID | Decision | Status |
|---|---|---|
| E1 | MySQL provision | **Decided (owner):** local Homebrew MySQL 8.4. Docker support deferred to a later phase. |
| E2 | Database account | **Owner-managed:** the owner created the databases. Least-privilege user still recommended; see G5. |
| E3 | Env loading | **Decided (owner):** `backend/.env` loaded by `dotenv-rails`. |
| E4 | Production secrets | **Holds:** env vars only; `master.key` is ignored and untracked. |
| E5 | `rails new` options | **Superseded:** the owner generated a full-stack Rails 8 app. Consequences are in G1–G3. |
| E6 | Remove `/up` | **Open.** Now tracked as G7. |
| E7 | Health controller base class | **Holds:** `ActionController::API` (or `ActionController::Base` with JSON only, if G1 keeps full-stack). |
| E8 | Foundation config | **Open:** `time_zone = "UTC"` and the extra `filter_parameters` (`password`, `amount`, `salary`, `first_name`, `last_name`, `csrf_token`) are not done. Collation adopted as generated (`utf8mb4_unicode_ci`). |
| E9 | Gem timing | **Revised:** jbuilder, pagy, and dotenv-rails are already added (ADR 005). `factory_bot_rails`, `faker`, and `bcrypt` are still added when first needed. |
| E10 | Ruby pinning | **Decided (owner):** RVM default; Ruby 3.2.0 in `backend/.ruby-version`. Version concern in G6. |
| E11 | Single README | **Open:** the generated `backend/README.md` is a stub; the root README is still one paragraph. |
| E12 | CLAUDE.md pointer and commands | **Open.** |
| E13 | CI | **Deferred.** The generated `backend/.github/` is inert. |
| E14 | Unstage `.idea/` and add a root `.gitignore` | **Superseded (owner):** `.idea/` is now committed. A root `.gitignore` for `.DS_Store` is still recommended. |
| E15 | Commits | **Decided (owner):** the owner commits; Claude never commits. |

#### B. New decisions raised by the scaffold

**Owner decision (2026-09-28):** apply G3; G2 was applied and then **reverted** (Minitest kept); keep everything else as generated (G1 full-stack stays, G4 dotenv group, G5 `database.yml` fallbacks, G6 Ruby 3.2.0, G7 `/up`, G8 `.env.example` unchanged). The recommendations below are kept for reference.

| ID | Decision | Recommendation | Status |
|---|---|---|---|
| G1 | **API-only vs full-stack Rails.** CLAUDE.md specifies a React frontend, and the architecture and API spec describe a JSON API. The generated app includes Propshaft, importmap, Turbo, Stimulus, HTML layouts, and assets. | Convert to API-only: `config.api_only = true`; remove the frontend gems, `app/assets`, `app/javascript`, the HTML layouts, and `config/importmap.rb`. This keeps one frontend (React), as in scope. | Kept as generated (owner) |
| G2 | **Test framework.** Minitest was generated; CLAUDE.md, `.claude/rules/testing.md`, and the testing and rails-backend skills require RSpec. | Use RSpec: add `rspec-rails`, remove `test/`, `capybara`, and `selenium-webdriver`. End-to-end browser tests belong to the future React plan (Playwright). | **Reverted 2026-09-28:** Minitest `test/` kept (owner) |
| G3 | **Unused generated infrastructure:** `solid_cable`, `kamal`, `thruster`, `Dockerfile`, `.kamal/`, `config/deploy.yml`, `backend/.github/`. | Remove `solid_cable` (no WebSocket need). Keep the Docker and Kamal files untouched until the owner's Docker phase, then revisit. `.github/` can stay, since it is inert. | **Applied 2026-09-28** (solid_cable removed; Docker/Kamal/.github kept) |
| G4 | `dotenv-rails` is in the default group, so it loads in production too. | Move it to `group :development, :test`. Production uses real env vars. | Kept as generated (owner) |
| G5 | `database.yml` falls back to `root`/`root`. That is a hard-coded credential and the MySQL superuser (security rules). | Remove the username and password fallbacks so a missing `.env` fails loudly. Use a least-privilege app user in `.env`. | Kept as generated (owner) |
| G6 | Ruby 3.2.0: the 3.2 series was scheduled to reach end of life on 2026-03-31, and 3.2.0 is its first patch release. | Accept for the assessment (synthetic data only), or move to a supported Ruby (3.3/3.4) before Phase 3. Owner's choice; recorded in ADR 005. | Kept: Ruby 3.2.0 (owner) |
| G7 | Generated `/up` health route (was E6). | Remove it; keep the single documented `/api/v1/health` with a database check. | Kept as generated (owner) |
| G8 | `backend/.env.example` is empty and ignored by the generated `/.env*` rule. | Add `!/.env.example` to `backend/.gitignore` and list the variable names with placeholder values (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `SECRET_KEY_BASE`, `HR_USER_EMAIL`, `HR_USER_PASSWORD`). | Kept as generated (owner) |
| G9 | The test environment has no cache database, so `rate_limit` tests need a store. | Set `config.cache_store = :memory_store` in `test.rb` when 4.1 adds rate limiting. | 4.1 |

#### B2. Re-review findings (2026-09-28, after the Minitest sync)

Re-checked against `backend/` as it is now and the updated docs. Items G1–G9 above keep their recorded status.

**Owner decisions (2026-09-28):** H1 and H3 approved. H2 already fixed by the owner (`.env.example` uses `DB_USERNAME`; all five names match `database.yml`).

| ID | Finding | Recommendation | Needed by |
|---|---|---|---|
| H1 | **API controllers vs the full-stack app (G1 kept).** `ApplicationController < ActionController::Base` has `allow_browser versions: :modern` for HTML pages. The architecture assumes API-only; ADR 004 says session and CSRF middleware must be "added back", which is no longer true because full-stack Rails already has cookies, sessions, and CSRF. | `Api::V1::BaseController < ActionController::Base` (not `ApplicationController`), JSON-only (`before_action { request.format = :json }`), no `allow_browser`, `protect_from_forgery with: :exception`. Health stays on `ActionController::API` (E7). Update architecture §5 and ADR 004 consequences to match. | **Approved**; applied in 2.2 (docs) and 4.1 (base controller) |
| H2 | **`.env.example` uses `DB_USER`, but `database.yml` reads `DB_USERNAME`.** A copied `.env.example` would silently fall back to the `root` user (G5 kept). | Rename to `DB_USERNAME` in `.env.example`. | **Done** (owner) |
| H3 | **Solid Cache and Solid Queue share the primary database name in development and test** (`queue` and `cache` roles use the same `DB_NAME`, and test has a `queue` role). Each role dumps its own schema file from one physical database, so `schema.rb`, `queue_schema.rb`, and `cache_schema.rb` can each end up containing every table. Development and test don't use them anyway (dev cache is `:memory_store`, test is `:null_store`, and the dev and test job adapters are not Solid Queue). | Keep only the `primary` role in development and test; keep `queue` and `cache` roles in production only. Owner decision, because it edits `database.yml`. | **Approved**; apply in 2.2 before the first `db:prepare` |
| H4 | **Parallel Minitest on MySQL** creates one database per worker (`salary_management_test-0…N`). This needs `CREATE` rights for the DB user (fine with root, which G5 keeps), and gives slower cold starts. | Keep parallel; document it in the README. If a least-privilege user is adopted later, grant it `CREATE` on `salary_management_test%`. | 2.3 |
| H5 | **Stubbing the database for the 503 health test.** `minitest` 6.0.6 is in the lockfile; recent Minitest releases may no longer bundle `minitest/mock` (`Object#stub`). | Verify in 2.3. If unavailable, make the health check call a small `DatabaseHealth.up?` method and override it in the test, rather than adding a gem. | 2.3 |
| H6 | **`db:prepare` has not run** (no `db/schema.rb`). | Owner runs `bin/rails db:prepare` after H3 is decided; the first `schema.rb` is committed by the owner. | 2.2 |
| H7 | **ADRs 004 and 005 and the G3 changes are uncommitted.** Other committed docs already reference the ADRs. | Owner commits them. | Now |
| H8 | **Rate limiting in development** uses `:memory_store` (per process), which is fine locally. Production uses Solid Cache. Test uses `:null_store`, so `rate_limit` never triggers (G9). | No change now; G9 still applies in 4.1. | 4.1 |

#### C. Assumptions
- The owner runs all git operations, database setup, and scaffolding; Claude edits files only on request.
- Development and test run on the local MySQL 8.4 instance, in separate databases.
- Docker, Kamal, and deployment are out of Phase 2 (owner decision); generated files are left in place, unused.
- The backend serves JSON only; any Rails-rendered HTML is out of scope unless G1 decides otherwise.

#### D. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| Decisions G1–G8 | 2.2 remaining tasks, 2.3 | Project owner |
| G6 (Ruby version) | Must be settled before Phase 3, because changing Ruby later forces a re-bundle | Project owner |
| Root `.gitignore` for `.DS_Store` and `.idea/` (E14) | Clean `git status` | Project owner |

#### E. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Two frontends (Rails views and React) drift, or scope creeps into server-rendered UI | Medium / Medium | G1 |
| Minitest and RSpec both in use, so tests are split across frameworks | Medium / Medium | Resolved: Minitest only (G2 reverted); CLAUDE.md, rules, and skills updated |
| `root`/`root` fallback used by accident, or copied into production config | Medium / High | G5 |
| dotenv loaded in production masks missing env vars | Low / Medium | G4 |
| `.env.example` never committed, so reviewers can't configure the app | High / Low | G8 |
| Unsupported Ruby 3.2.0 lacks security fixes | Certain / Low for an assessment | G6, ADR 005 |
| Unused Kamal, Thruster, and Solid Cable code confuses reviewers | Medium / Low | G3 |

### 2.1 Repository and backend structure
**Prompt:** `Complete the repository skeleton around the owner-generated backend/: root .gitignore, backend/.env.example (G8), and README setup documentation. Never commit secrets. Do not run git commands (owner-managed).`
**Tasks:**
1. ~~Generate `backend/` and remove the nested git repository~~ Done by the owner.
2. ~~Root `.gitignore`: `.DS_Store` (and `.env`).~~ Done 2026-09-28. Backend paths are covered by `backend/.gitignore`; `.idea/` is tracked by owner choice (E14).
3. ~~`backend/.env.example`: rename `DB_USER` to `DB_USERNAME` (H2).~~ Done by the owner. Tracking it via `!/.env.example` stays the owner's choice (G8 kept).
4. ~~`README.md` (root): overview; repository layout; prerequisites; database setup via `backend/.env`; run and test commands; links to docs and this plan. Replace `backend/README.md` with a pointer to the root README (E11).~~ Done 2026-09-28. Because `.env.example` is ignored (G8), the README lists the `DB_*` variables itself so a fresh clone can be configured.
5. ~~`CLAUDE.md`: add a "Current plan: BACKEND_PLAN.md" pointer (E12).~~ Done 2026-09-28 (new "Current Plan" section). The "Commands" part of E12 belongs to 2.3.

**Deliverables:** Root `.gitignore`, a populated `backend/.env.example` (local only; ignored per G8, with its variables documented in the README), and updated `README.md` / `CLAUDE.md`.
**Acceptance:** `git check-ignore` shows `backend/.env` and `backend/config/master.key` are ignored; `.env.example` variable names match `database.yml`; no secrets in tracked files; the README setup steps work on a clean clone.
**Status:** Done (2026-09-28). The clean-clone check was partial: `bundle install` and `bin/rails test` were verified; `db:prepare` was not run because it is the owner's step after H3 (task 2.2).

### 2.2 Rails application configuration and health endpoint
**Prompt:** `Align the owner-generated Rails 8 app with the approved design per decisions G1, G3–G5, G7 and E8: API-only mode if approved, remove unused gems, harden database.yml, set UTC and filter_parameters, and add GET /api/v1/health with a database check (API spec §3). Do not add domain models, auth, or sessions.`
**Tasks:**
1. ~~`rails new backend` with MySQL~~ Done by the owner (Rails 8.0.5.1, full-stack default).
2. ~~Apply G3: remove `solid_cable` and its config.~~ Done 2026-09-28 (gem, `db/cable_schema.rb`, `cable` entries in `database.yml` removed; production `cable.yml` uses `async`). G1 and G4 kept as generated (owner).
3. ~~G5~~ Kept as generated (owner). ~~Apply H3 (approved): development and test use only the `primary` role.~~ Done 2026-09-28.
4. ~~E8: `config.time_zone = "UTC"`; extend `filter_parameters`.~~ Done 2026-09-28 (`amount`, `salary`, `first_name`, `last_name` added; `password`, `csrf_token`, and `email` were already covered by `:passw`, `:token`, and `:email`).
5. ~~Keep `/up`; add the `api/v1/health` route and `Api::V1::HealthController < ActionController::API` with a `DatabaseHealth.up?` check.~~ Done 2026-09-28 (`app/models/database_health.rb`, `app/controllers/api/v1/health_controller.rb`, `app/views/api/v1/health/show.json.jbuilder`, route with `format: :json` default).
6. Owner runs `bin/rails db:prepare` for development and test (H6); update the README run instructions.
7. ~~Docs: align architecture §5 and ADR 004 with the full-stack base controller decision (H1).~~ Done 2026-09-28.

**Deliverables:** A Rails 8 app configured per the design, with the health endpoint.
**Acceptance:** `bin/rails db:prepare` succeeds; `curl localhost:3000/api/v1/health` returns `200` with the documented body, and `503` when MySQL is unreachable; no secrets tracked.
**Status:** Done (2026-09-28, marked by owner). Open follow-ups: (a) **json constraint (resolved by the owner on 2026-09-28: Gemfile now has `gem "json", "< 3"`; lockfile json 2.21.2):** `Gemfile.lock` pins `json (< 3)` → 2.6.3, but the `gem "json", "< 3"` line is not in the `Gemfile`, so the next re-resolve could return to json 3.x and break all JSON responses (ActiveSupport 8.0 passes `quirks_mode`); restore the Gemfile line and note it in ADR 005. (b) The `503` path was not verified over HTTP (covered by the 2.3 integration test). (c) `db:prepare` (H6) is still the owner's step; the development database already exists. (d) README run section still says the health endpoint "arrives in task 2.2".

### 2.3 Minitest and quality baseline
**Prompt:** `Using the generated Minitest setup (owner decision, G2 reverted), write integration tests for the health endpoint (200 and 503), and run the test suite, RuboCop (omakase), and Brakeman. Record exact commands and results in the README and completion log.`
**Tasks:**
1. ~~Replace Minitest with RSpec.~~ Reverted: the Minitest `test/` tree, `capybara`, and `selenium-webdriver` stay as generated.
2. ~~`test/integration/api/v1/health_test.rb`: `200` with the exact body; `503` when `DatabaseHealth.up?` is forced false (H5); no version or environment keys.~~ Written 2026-09-28 (3 tests; `DatabaseHealth.up?` swapped via `define_singleton_method` because minitest 6 has no `minitest/mock`).
3. Run `bin/rails test`, `bin/rubocop`, and `bin/brakeman --no-pager`. Fix offences rather than disabling cops, and document any exception (the 2 pre-existing Gemfile offences need an owner OK). Note parallel test databases in the README (H4).
4. ~~README "Testing and quality" section and a `CLAUDE.md` "Commands" section (E12).~~ Done 2026-09-28.

**Deliverables:** Health integration tests and clean lint and security baselines.
**Acceptance:** All three commands exit 0; the actual result summary is recorded in the completion log; the commands are documented.
**Status:** Done (2026-09-28). All three commands exit 0: `bin/rails test` 3 runs, 7 assertions, 0 failures; `bin/rubocop` 28 files, no offences; `bin/brakeman` 0 warnings, 2 ignored (owner-accepted support warnings in `config/brakeman.ignore`). History: the 503 test initially failed because the `render … status:` line was commented out (restored with owner approval); 3 RuboCop offences in owner-edited lines were autocorrected with owner approval.

**Phase 2 gate: passed on 2026-09-28.** The app boots; the database is reachable; health returns 200 (HTTP on :3000 and test) and 503 (integration test); tests, RuboCop, and Brakeman pass; no `.env` or `master.key` tracked. Carried-over follow-ups from 2.2: README health line still says "arrives in task 2.2"; `db:prepare` (H6) remains the owner's step (dev and test databases already exist).

**Phase gate:** The Rails app boots, database connectivity works, health returns 200 and 503 correctly, `bin/rails test`, `bin/rubocop`, and `bin/brakeman` pass, and no secrets are tracked.

---

## Phase 3 — Domain models and persistence
**Goal:** Implement the core backend data model with reliable data integrity.

### Phase 3 review findings (2026-09-28)

Inputs: `docs/database-design.md` v2.0 (with later updates), ADRs 002, 003, and 005, `docs/requirements.md` §10–§11, API spec §5–§7, and the Phase 2 outcome. Observed: both databases are `utf8mb4` / `utf8mb4_unicode_ci` on MySQL 8.4.10 and contain only `schema_migrations` and `ar_internal_metadata`; there is no `db/migrate/` or `db/schema.rb`; `test_helper.rb` loads `fixtures :all` and parallelizes at 50 or more tests; `factory_bot_rails` and `faker` are not in the Gemfile.

#### A. Missing decisions

**Owner decisions (2026-09-28):** all of J1–J14 approved. J3–J5 and J14 were applied in 3.1; J7–J13 apply in 3.2; J6 applies in 3.3.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| J1 | **Test data approach.** The testing rules say "use factories", ADR 005 lists `factory_bot_rails` and `faker` for 3.1, and Minitest's default is YAML fixtures (`fixtures :all` is already on). | Add `factory_bot_rails` (test) and `faker` (development and test; the seeds need it). Use **fixtures** for the small, fixed reference data (countries, departments, currencies) and **FactoryBot** for employees and salary records. `faker` stays out of production (J6). | 3.1 |
| J2 | **Who runs migrations.** The owner creates the databases (H6), but every Phase 3 subphase needs `bin/rails db:migrate` for development and a test-schema load to validate. | Allow Claude to run `bin/rails db:migrate` (development) and `bin/rails db:test:prepare`; these create tables only, not databases or users. Otherwise the owner runs them and Claude validates afterwards. | 3.1 |
| J3 | **Currency key type.** The design says `CHAR(3)`; Rails generates `VARCHAR(3)` for `string, limit: 3`. The FK column and the referenced key must have compatible types and the same collation. | Use `string, limit: 3` (VARCHAR) for `currencies.code`, `salary_records.currency_code`, and `countries.code` (`limit: 2`). Update database design §3. | 3.1 |
| J4 | **Employment status representation.** | String-backed Rails enum, `enum :employment_status, { active: "active", on_leave: "on_leave", terminated: "terminated" }, validate: true`, plus the DB `CHECK` (I3). | 3.1 |
| J5 | **Normalisation.** | Rails `normalizes`: `employee_number` stripped and upper-cased; `email` stripped and down-cased, with blank stored as `NULL` (so the unique index allows many "no email" rows); `countries.code` and `currencies.code` upper-cased. | 3.1 |
| J6 | **Reference data vs demo data.** The app cannot work without countries, departments, and currencies, even in production, but 10,000 synthetic employees must never reach production. | Split the seeds: `db/seeds.rb` does an idempotent `upsert_all` of reference data only (safe everywhere); synthetic employees and salaries come from a separate `bin/rails demo:seed` task (development only, refuses in production, requires `faker`). Update database design §9. | 3.3 |
| J7 | **Where the salary services are built.** The plan puts the salary *model* in 3.2 and the *endpoints* in 4.4, but the history rules (I10, I11) live in `Salaries::ChangeService` and `Salaries::CorrectionService`. | Build and test both services in **3.2** (domain logic), and `Employees::CreateService` (employee plus optional initial salary) in **3.2** after salary records exist. Controllers in 4.3 and 4.4 only call them. | 3.2 |
| J8 | **Read-only columns.** With `load_defaults 8.0`, assigning an `attr_readonly` attribute on a persisted record **raises** `ActiveRecord::ReadonlyAttributeError`. | Keep `attr_readonly :employee_id, :effective_from`. `CorrectionService` rejects date changes before assigning (API §7.5 expects `422 validation_failed`), so the error is never user-visible. Cover it with a model test. | 3.2 |
| J9 | **Where the salary scale rule lives (I5).** `DECIMAL(18,4)` accepts 4 decimal places for every currency. | A model validation: `amount.round(currency.minor_units) == amount`, for example rejecting JPY `1000.5` and accepting KWD `1.234`. | 3.2 |
| J10 | **I13 in both directions.** The employee-side rule (`hired_on` must not be after the first salary start) needs `SalaryRecord`. | The salary-side check is added in 3.2 on `SalaryRecord`; the employee-side check is also added in 3.2 (not 3.1), once the association exists. | 3.2 |
| J11 | **Testing the concurrency guard.** A real two-thread race needs non-transactional tests against MySQL, which are slow and flaky. | Test the database guards directly (a second open record raises `ActiveRecord::RecordNotUnique`; a duplicate start date is rejected) and test that `ChangeService` takes `lock!` on the employee. No thread-race test. | 3.2 |
| J12 | **Time in tests.** | Use `travel_to` for every test involving "current", "scheduled", or "historical" status, including month and year boundaries. | 3.2 |
| J13 | **Schema format.** Generated columns and `CHECK` constraints must survive `schema.rb`. | Keep `schema.rb` (Rails dumps MySQL virtual columns and check constraints). Validate by running `db:test:prepare`, which loads from `schema.rb`, and asserting that the constraints fire in tests. Switch to `structure.sql` only if the round-trip loses anything. | 3.2 |
| J14 | **Association deletion behaviour.** | `has_many ..., dependent: :restrict_with_exception` on countries, departments, currencies, and employees, matching `ON DELETE RESTRICT` (I12). | 3.1 |

#### B. Assumptions
- The schema follows `docs/database-design.md` v2.0 as approved (tables §3, indexes §4, rules I1–I13, O1), with the type adjustment in J3.
- Reference data is the fixed set in database design §8 (8 countries, 8 departments, 7 currencies). Adding more is a seed change.
- `users` stays in 4.1; Phase 3 adds no auth.
- No endpoints, controllers, or jbuilder views in Phase 3.
- Analytics query objects (median, distribution) belong to Phase 5. Phase 3 only provides the `SalaryRecord.in_effect_on(date)` scope they build on.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| J1 (gems) and J2 (who runs migrations) | 3.1 | Project owner |
| 3.1 tables (countries, currencies, employees) | 3.2 foreign keys | — |
| 3.2 services and scope | 3.3 seed history generation, 4.3 and 4.4 endpoints, Phase 5 queries | — |
| MySQL 8.0.16 or later (CHECK enforcement) | 3.1, 3.2 | Met (8.4.10) |
| `CREATE` rights for per-worker test databases once there are 50 or more tests (H4) | 3.2 onwards | Met with the current `root` user (G5) |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Generated column or CHECK constraints lost in the `schema.rb` round-trip, so the test database lacks the guards | Low / High | J13: tests that expect the constraint errors |
| FK or collation mismatch between `currency_code` and `currencies.code` | Low / Medium | J3: same type and collation on both sides; migration runs in development and test |
| Overlapping periods written outside the service (console, `insert_all`) | Medium / High | Model overlap validation (I10); seeds build history already closed; unique open-record index |
| Off-by-one errors in period closing (`effective_to = new start − 1 day`) or status at boundaries | Medium / High | J12: `travel_to` tests on the day before, the day of, and the day after |
| Demo seeds run in production | Low / High | J6: separate task that refuses in production |
| 10k-row seed is slow or non-deterministic | Medium / Low | `insert_all` batches of 1,000, fixed `Random`/Faker seed, one transaction |
| Mixing fixtures and factories causes duplicate reference rows | Medium / Low | J1: reference data only in fixtures; factories look it up instead of creating it |
| Rules drift between the model and the services | Medium / Medium | Database constraints as the backstop, services as the only writers, tests at both levels |

### 3.1 Reference data and employee models
**Prompt:** `Implement countries, departments, currencies, and employees from docs/database-design.md §3.2–§3.5 and §4 (with J3–J5, J14). Add migrations with FKs, CHECK constraints, and indexes; models with associations, normalisation, and validations; fixtures for reference data and factories for employees (J1); and model tests. No salary records, users, or endpoints.`
**Tasks:**
1. ~~Resolve J1 and J2 with the owner.~~ Approved 2026-09-28. Add `factory_bot_rails` (test) and `faker` (development and test) with an ADR 005 amendment; Claude may run `bin/rails db:migrate` and `bin/rails db:test:prepare`.
2. ~~Migrations: `countries` (code `limit: 2`, unique code and name), `departments` (unique name), `currencies` (string PK `code`, `limit: 3`; `minor_units` with `CHECK 0–4`), `employees` (columns per §3.5; FKs with `ON DELETE RESTRICT`; `CHECK` on `employment_status`; the indexes in §4).~~ Done.
3. ~~Models: `Country`, `Department`, `Currency` (`self.primary_key = "code"`), `Employee` (`belongs_to` country and department; enum J4; `normalizes` J5; presence, format, and uniqueness validations I1–I3).~~ Done.
4. ~~Test data: fixtures for the reference data in design §8; an `employee` factory that uses the reference fixtures.~~ Done.
5. ~~Model tests: required fields; employee number format and case-insensitive uniqueness; email normalisation and blank-to-NULL; status values; FK and restrict-delete behaviour; that the DB constraints fire when validations are bypassed (`insert_all` or `update_column`).~~ Done.

**Deliverables:** Four migrations, four models, fixtures, an employee factory, and model tests. `db/schema.rb` generated.
**Acceptance:** `db:migrate` and `db:test:prepare` succeed; `bin/rails test` passes; each of I1–I3 and I12 has a test at the model level and, where the DB enforces it, at the database level; `bin/rubocop` and `bin/brakeman` stay clean.
**Status:** Done (2026-09-28). Applied the J3, J4, J5, and J14 defaults (approved by the owner on 2026-09-28). Results: `db:migrate` and `db:test:prepare` succeed; the test DB has both CHECK constraints after loading `schema.rb`; `db:migrate:redo STEP=4` leaves `schema.rb` identical; `bin/rails test` 37 runs, 79 assertions, 0 failures; RuboCop 41 files, no offences; Brakeman 0 warnings (2 ignored). Note for 3.3: MySQL `insert_all` silently skips unique-key conflicts, so use `insert_all!`.

### 3.2 Salary records, history services, and employee creation
**Prompt:** `Implement salary_records per docs/database-design.md §3.6, §4–§7 and ADR 003 (with J7–J13): migration with the generated open_flag column, CHECKs, FKs, and unique indexes; SalaryRecord model with validations I4–I7, I9–I11, I13, the in_effect_on scope, and status helpers; Salaries::ChangeService, Salaries::CorrectionService, and Employees::CreateService with locking and transactions. Do not calculate payroll, tax, or net pay; no endpoints.`
**Tasks:**
1. ~~Migration: `salary_records` (amount `DECIMAL(18,4)` with `CHECK > 0`; `currency_code` FK to `currencies.code`; `CHECK effective_to >= effective_from`; virtual stored `open_flag`; unique `(employee_id, effective_from)` and `(employee_id, open_flag)`).~~ Done 2026-09-28.
2. ~~`SalaryRecord` model: validations I4–I7 plus scale versus `minor_units` (J9), overlap (I10), and `effective_from >= hired_on` (I13); `attr_readonly` (J8); `in_effect_on(date)` scope (D7); `status_on(date)` returning `current`, `scheduled`, or `historical`; `editable?` (D4 + O1).~~ Done 2026-09-28.
3. ~~`Employee`: `has_many :salary_records` (restrict); `current_salary`; the I13 employee-side validation (J10).~~ Done 2026-09-28.
4. ~~`Salaries::ChangeService` (design §6: lock the employee, check the latest record, close it, insert the new one), `Salaries::CorrectionService` (lock; editable only; `amount`/`currency_code` only), and `Employees::CreateService` (employee plus optional initial salary in one transaction).~~ Done 2026-09-28.
5. ~~Tests (J11, J12): scale per currency (JPY 0, USD 2, KWD 3); boundary dates; future-dated records are `scheduled`; the database guards fire; change closes the prior period exactly one day earlier; backdating and same-date changes are rejected; rollback leaves no partial state; correction allowed for current and scheduled records and rejected for historical ones; dates are immutable; create with a bad initial salary creates nothing.~~ Done 2026-09-28.
6. ~~Update the database design §3 types (J3) and note that the schema round-trip was verified (J13).~~ Done 2026-09-28.

**Deliverables:** Migration, `SalaryRecord` model, three services, a salary factory, model and service tests, and an updated `schema.rb`.
**Acceptance:** `bin/rails test` passes with every rule I4–I13 and O1 covered; `db:test:prepare` from `schema.rb` keeps the generated column and CHECKs (asserted by tests); RuboCop and Brakeman are clean.
**Status:** Done (2026-09-28). All code implemented and verified: `bin/rails test` 75 runs, 190 assertions, 0 failures (about 1 s); RuboCop 51 files, no offences; Brakeman 0 warnings (2 ignored); `db:migrate:redo STEP=1` leaves `schema.rb` identical.

**K1 — test runner (owner decision 2026-09-28: option 3, parallel runs off).** Once the suite passed the 50-test threshold, plain `bin/rails test` hung. Rails 8.0.5.1's parallel process workers are incompatible with the locked minitest 6.0.6, which removed `Minitest.run_one_method` and the reporter argument of `with_info_handler`: workers died after the first test (DRb `Errno::EBADF`). `test/test_helper.rb` now uses `parallelize(workers: 1)`. Revisit when upgrading Rails (8.1 targets minitest 6). This also makes H4 (per-worker test databases) moot.

### 3.3 Reference seeds, demo data, and integrity review
**Prompt:** `Split seeds per J6: idempotent reference-data seeds in db/seeds.rb, and a development-only demo:seed task generating about 10,000 deterministic synthetic employees with salary histories per docs/database-design.md §9. Review every integrity rule against the implemented schema. Document seed and reset commands.`
**Tasks:**
1. ~~`db/seeds.rb`: `upsert_all` of countries, departments, and currencies from design §8. Safe to rerun and safe in production.~~ Done 2026-09-28.
2. ~~`lib/tasks/demo.rake` (`demo:seed`, `demo:reset`): refuses unless `Rails.env.development?`; fixed random seed (42); 10,000 employees across all countries and statuses; about 5% paid in USD; about 60% with one record, 38% with 2–4, 2% future-dated, 1% with none; history rows built already closed; `insert_all` in batches of 1,000 inside one transaction; refuses if employees exist unless reset.~~ Done 2026-09-28.
3. ~~Integrity review: a table of I1–I13 → where it is enforced → which test proves it; any gaps fixed or recorded.~~ Done 2026-09-28.
4. ~~Verify after seeding: counts per country, currency, and status; zero overlapping periods (SQL check); at most one open record per employee; scale matches `minor_units`; runtime recorded.~~ Done 2026-09-28.
5. ~~README "Sample data" section with the seed, demo, and reset commands.~~ Done 2026-09-28.

**Deliverables:** Reference seeds, demo seed task, integrity checklist, and README instructions.
**Acceptance:** `db:seed` is idempotent (a second run changes 0 rows); `demo:seed` produces the same counts on every run; the SQL integrity checks return zero violations; `demo:seed` refuses to run in production.
**Status:** Done (2026-09-28). `db:seed` twice leaves identical `CHECKSUM TABLE` values (0 rows changed). `demo:seed`: 10,000 employees and 16,826 salary records in about 1.5 s, 0 violations in all 6 integrity checks. `demo:reset` reproduces the same data fingerprint. `demo:seed` and `demo:reset` refuse in production. `bin/rails test` 89 runs, 224 assertions, 0 failures; RuboCop 59 files clean; Brakeman 0 warnings. Integrity checklist: `docs/database-design.md` §12.

**Phase 3 gate: passed on 2026-09-28.**

**Phase gate:** Schema and domain behaviour are verified by model and service tests, the constraints survive the `schema.rb` round-trip, reference seeds are idempotent, and demo data loads deterministically with zero integrity violations.

---

## Phase 4 — Employee and salary APIs
**Goal:** Deliver secure, documented REST APIs for core salary management.

### Phase 4 review findings (2026-09-28)

Inputs: API spec v2.0 (§1–§7, §10–§12), architecture v2.2 (§3, §5–§7), ADR 004, database design §5–§7 and §12, requirements §10–§11, and the codebase after Phase 3. Observed:
- Full-stack Rails 8.0.5.1 app. `ApplicationController` has `allow_browser`. No `session_store` or `wrap_parameters` initializers, so Rails defaults apply: cookie store and automatic JSON parameter wrapping.
- The test environment has `allow_forgery_protection = false` and `cache_store = :null_store`.
- `bcrypt` is **not installed** (only a commented Gemfile line). There is no `users` table, and `.env.example` has no `HR_USER_*`.
- Pagy 43.4.4 uses `page` and `limit` parameters, silently caps limits at `client_max_limit`, and by default does **not** raise for a page past the end.
- The Phase 3 services (`Salaries::ChangeService`, `Salaries::CorrectionService`, `Employees::CreateService`) return records with errors, and `errors.of_kind?(:base, :not_editable)` marks a historical-record rejection.
- The development database holds 10,000 demo employees.

#### A. Missing decisions

**Owner decisions (2026-09-28):** L1–L18 approved, including the `bcrypt` install (L3).

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| L1 | **Subphase order.** 4.2 (conventions) builds the error envelope and base controller that 4.1 (auth) needs for its `401`/`422`/`429` responses. | Re-scope, keeping the numbers: **4.1 = API base controller, error envelope, and authentication**, tested through the session endpoints; **4.2 = list conventions (pagination, query-parameter validation, formatting) plus the read-only reference-data endpoints** as their first protected consumers; 4.3 employees; 4.4 salaries. No domain endpoint exists before auth (C7 still holds). | 4.1 |
| L2 | **Rails 8 `bin/rails generate authentication` vs a hand-rolled login.** The generator adds a DB `sessions` table, an `email_address` column, a password-reset mailer, and HTML views, which is more than ADR 004 allows (no reset flows). | Hand-roll per ADR 004: `User` with `has_secure_password`, a cookie session, and an `Authentication` concern. | 4.1 |
| L3 | **Installing `bcrypt`.** | Uncomment `gem "bcrypt", "~> 3.1.7"` and run `bundle install` (owner approval, as for 3.1). | 4.1 |
| L4 | **HR user provisioning.** | `bin/rails hr:create_user` reads `HR_USER_EMAIL` and `HR_USER_PASSWORD` (minimum 12 characters). It refuses if the user already exists unless `RESET_PASSWORD=1`, which updates the password. Add both variable names to `.env.example`. The owner runs it with real credentials. | 4.1 |
| L5 | **Login check.** | `User.authenticate_by(email:, password:)` (timing-safe, Rails 7.1+); email normalised to lower case; the same `401 invalid_credentials` for an unknown email or a wrong password. | 4.1 |
| L6 | **Session cookie settings.** | Explicit `config/initializers/session_store.rb`: cookie store, key `_acme_salary_session`, `httponly`, `same_site: :lax`, `secure` in production. The `Authentication` concern enforces a 30-minute idle expiry (`session[:last_seen_at]`) and an 8-hour absolute expiry (`session[:signed_in_at]`); `reset_session` on login and logout. | 4.1 |
| L7 | **Testing CSRF.** The test environment disables forgery protection, so default tests never exercise CSRF. | Keep the default off, and add dedicated tests that temporarily set `ActionController::Base.allow_forgery_protection = true` for: missing token → `422 invalid_csrf_token`; token from `GET /session` accepted. | 4.1 |
| L8 | **Rate-limit store in tests (G9).** `:null_store` means `rate_limit` never triggers. | `config.cache_store = :memory_store` in `test.rb`, plus `Rails.cache.clear` in the rate-limit test setup. `rate_limit to: 5, within: 1.minute, only: :create` on `SessionsController`. | 4.1 |
| L9 | **Automatic JSON parameter wrapping.** Rails wraps unwrapped JSON bodies under the controller key, so the spec's "missing wrapper key → `400`" would never happen. | `wrap_parameters false` in `Api::V1::BaseController`; `params.require(:employee)` / `:salary_record` raises `ParameterMissing` → `400 bad_request`. | 4.1 |
| L10 | **Unknown API routes.** In a full-stack app, unmatched paths render HTML (a debug page in development, `public/404.html` in production). | A catch-all `match "*path", via: :all` inside the `api/v1` namespace (declared last) → `404 not_found` JSON. | 4.1 |
| L11 | **`500` handling.** Rescuing `StandardError` everywhere hides real failures in tests. | `rescue_from StandardError` → `500 internal_error`, logging the class and backtrace only. Active outside the test environment (`config.x.api_rescue_unexpected_errors`), with one test that enables it and asserts the envelope. | 4.1 |
| L12 | **Query-parameter validation (API §2.3, §2.4, §6.1).** | A small `QueryParams` concern that validates `page` ≥ 1, `per_page` 1–100, the `sort` allowlist, enum values, existing filter IDs, `q` ≤ 100 characters, and ISO dates. It raises `Api::BadRequest` with `details` → `400 bad_request`, validating **before** Pagy so oversized values are rejected rather than capped. | 4.2 |
| L13 | **Pagy 43 integration.** | `include Pagy::Method`; `pagy(:offset, scope, limit: per_page, page: page)`. Build `meta` ourselves (`page`, `per_page`, `total_count`, `total_pages` = `ceil(count / per_page)`, which is 0 when there are no rows). A page past the end returns `data: []` (Pagy's default, verified in its source). | 4.2 |
| L14 | **Money and time formatting.** | Shared jbuilder helper: amounts via `ActiveSupport::NumberHelper.number_to_rounded(amount, precision: minor_units)` (exact BigDecimal, e.g. `"85000.00"`, `"250000"`, `"1500.125"`). Timestamps: `ActiveSupport::JSON::Encoding.time_precision = 0` so they match the spec (`2026-09-28T10:15:00Z`). Dates as `YYYY-MM-DD`. | 4.2 |
| L15 | **Where list logic lives.** | `EmployeeSearchQuery` (filters, `q` via `sanitize_sql_like`, allowlisted sort with `id` tie-break, `includes(:country, :department)`). A no-N+1 test uses `assert_queries_count` (Rails 7.2+). | 4.3 |
| L16 | **Service errors → HTTP.** | `persisted?`/`errors.empty?` → `201`/`200`; `errors.of_kind?(:base, :not_editable)` → `422 salary_record_not_editable`; any other errors → `422 validation_failed` with `details` (attribute → messages, including `initial_salary.*`). Salary records are looked up via `@employee.salary_records.find`, so a record of another employee returns `404`. | 4.3 / 4.4 |
| L17 | **Checking log redaction (NFR security).** | An integration test captures the Rails log for a salary `POST`/`PATCH` and a login, and asserts that `amount`, `first_name`, `last_name`, `email`, and `password` values are absent and `[FILTERED]` is present. | 4.4 |
| L18 | **I12 "no destroy routes".** | Routing tests: `DELETE /api/v1/employees/:id` and `DELETE …/salary_records/:id` return `404` JSON (via L10). Closes the gap in database design §12. | 4.3 / 4.4 |

#### B. Assumptions
- One HR user; the future frontend is same-site (ADR 004). No CORS, JWT, or password-reset flow.
- Responses follow API spec v2.0 exactly; anything that has to deviate (e.g. time precision) is updated in the spec in the same subphase.
- `status`, `editable`, and `current_salary` are computed against `Date.current` (UTC); tests use `travel_to`.
- The salary history list stays unpaginated (API §7.2); reference lists are unpaginated (API §5).
- Analytics and reports (Phase 5) are out of scope; Phase 4 only adds the employee, reference, salary, session, and health endpoints (API §11).

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| L1–L11 approval; `bcrypt` install (L3) | 4.1 | Project owner |
| `HR_USER_EMAIL` / `HR_USER_PASSWORD` in `backend/.env` and running `hr:create_user` (L4) | Manual login in development (tests use factories) | Project owner |
| 4.1 base controller, errors, and auth | 4.2–4.4 | — |
| 4.2 pagination, parameter validation, and formatting | 4.3, 4.4, Phase 5 | — |
| Phase 3 models and services | 4.3, 4.4 | Done |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| CSRF gaps unnoticed because tests disable forgery protection | Medium / High | L7 dedicated tests |
| Contract drift: auto-wrapped params, HTML error pages, Pagy silently capping `per_page` | High / Medium | L9, L10, L12 |
| Rate limit untestable or ineffective | High / Medium | L8 memory store in tests; production uses Solid Cache |
| Session cookie misconfigured (not HttpOnly, wrong SameSite, not Secure in production) | Low / High | L6 explicit initializer plus a test on `Set-Cookie` flags |
| Salary or personal data in logs or error bodies | Medium / High | Existing parameter filters; L17 log test; errors never echo values |
| N+1 queries on the 10k-employee list | Medium / Medium | L15 `includes` plus a query-count test |
| Timing leak on login | Low / Medium | L5 `authenticate_by` |
| Malformed JSON body producing `500` | Medium / Low | Rescue `ActionDispatch::Http::Parameters::ParseError` → `400` |
| Date-dependent flakiness in status and `current_salary` | Medium / Low | `travel_to` in all such tests |
| `bcrypt` native build fails | Low / Medium | Build tools are already present for `mysql2`; the owner can run `bundle install` |

### 4.1 API base controller, error envelope, and authentication
**Prompt:** `Per L1–L11 and ADR 004: add Api::V1::BaseController (< ActionController::Base, JSON-only, wrap_parameters false, forgery protection, default-deny auth), the ErrorHandling concern (API §10 envelope), an /api/v1 catch-all 404, the users table and User model, the Authentication concern (session, idle and absolute expiry), SessionsController (GET/POST/DELETE /session, CSRF token, rate limit), and the hr:create_user task. No domain endpoints.`
**Tasks:**
1. ~~Owner: approve L1–L11; allow the `bcrypt` install (L3).~~ Approved 2026-09-28.
2. ~~`users` migration (database design §3.1) and `User` (`has_secure_password`, email normalised and unique, password ≥ 12 characters); `lib/tasks/hr.rake` (`hr:create_user`, L4); `.env.example` gains `HR_USER_EMAIL` and `HR_USER_PASSWORD` names.~~ Done 2026-09-28.
3. ~~`config/initializers/session_store.rb` (L6); `ActiveSupport::JSON::Encoding.time_precision = 0` (L14); `test.rb` memory cache store (L8).~~ Done 2026-09-28.
4. ~~`Api::V1::BaseController` with the `ErrorHandling` concern (400/401/404/422/429/500 per API §10, plus `ParseError` → 400, L11) and the `Authentication` concern (`require_login`, `current_user`, expiry).~~ Done 2026-09-28.
5. ~~`Api::V1::SessionsController` (API §4): `GET` returns state and CSRF token; `POST` uses `authenticate_by`, `reset_session`, and `rate_limit`; `DELETE` → 204.~~ Done 2026-09-28.
6. ~~Routes: session routes plus the catch-all (L10).~~ Done 2026-09-28.
7. ~~Tests: login success and failure (generic message); logout; `401` when unauthenticated; idle and absolute expiry (`travel_to`); rate limit → `429`; CSRF (L7); `Set-Cookie` flags; catch-all JSON 404; malformed JSON → 400; `500` envelope (L11); the `hr:create_user` task; `User` model rules.~~ Done 2026-09-28.

**Deliverables:** Base controller, error and auth concerns, users table and model, session endpoints, HR task, and tests.
**Acceptance:** All auth and error-envelope tests pass; no path under `/api/v1` returns HTML; RuboCop and Brakeman clean.
**Status:** Done (2026-09-28). `bin/rails test` 115 runs, 317 assertions, 0 failures (twice); RuboCop 76 files clean; Brakeman 0 warnings (2 ignored). Live check on a spare port: `GET /session` 200 JSON; unknown path 404 JSON; `DELETE /session` unauthenticated 401; `POST` without CSRF token 422 `invalid_csrf_token`; health 200; `Set-Cookie: _acme_salary_session…; httponly; samesite=lax`.
Notes: unauthenticated state-changing requests get `401` before the CSRF check (the login check runs first), so no CSRF detail leaks to anonymous callers. Rails 8.0 prints a harmless `STATS_DIRECTORIES` warning when tests load rake tasks.

### 4.2 List conventions and reference-data endpoints
**Prompt:** `Per L12–L14: add the QueryParams and Pagination concerns (Pagy 43, validated before paging), shared jbuilder helpers for money, dates, errors, and pagination meta, and the protected read-only GET /countries, /departments, /currencies endpoints (API §5).`
**Tasks:**
1. ~~`QueryParams` concern and `Api::BadRequest` (L12); `Pagination` concern using `pagy(:offset, …)` with our own `meta` (L13).~~ Done 2026-09-28.
2. ~~Jbuilder helpers and partials: money (L14), pagination meta, error envelope.~~ Done 2026-09-28.
3. ~~`CountriesController`, `DepartmentsController`, `CurrenciesController` (index only; ordered per API §5) and their views.~~ Done 2026-09-28.
4. ~~Tests: `401` without login; ordering and shapes; unit tests for `QueryParams` edge cases (0, 101, non-numeric, unknown sort, unknown ID, long `q`, bad date) and pagination meta (empty set, last page, past the end).~~ Done 2026-09-28.

**Deliverables:** Shared conventions and 3 reference endpoints with tests.
**Acceptance:** Reference endpoints match API §5; every invalid list parameter yields `400` with `details`; RuboCop and Brakeman clean.
**Status:** Done (2026-09-28). `bin/rails test` 139 runs, 431 assertions, 0 failures on 6 random seeds (including one that failed earlier); RuboCop 91 files clean; Brakeman 0 warnings. Live on a spare port: the three reference endpoints return `401` JSON when signed out; `POST /countries` returns `404` JSON.
Notes:
- **`with_routing` is not used in tests.** In Rails 8.0 it broke route helpers for integration tests that ran afterwards, so some random seeds failed. Pagination is unit-tested through a host object (Pagy accepts a request hash), and the 4.1 `500` test now makes `GET /countries` fail temporarily instead.
- `ParameterMissing` now returns `details` naming the missing key (e.g. `{"employee": ["is required"]}`), used from 4.3.
- `QueryParams` raises on the first invalid parameter, so `details` names one parameter.

### 4.3 Employee endpoints
**Prompt:** `Implement GET/POST /employees and GET/PATCH /employees/:id per API §6 using EmployeeSearchQuery (L15), Employees::CreateService, and the 4.2 conventions. List without salary or email (D18); detail with current_salary and email; no DELETE route.`
**Tasks:**
1. ~~`EmployeeSearchQuery`: `q`, `country_id`, `department_id`, `employment_status`, and the sort allowlist (`employee_number` default, `last_name`, `hired_on`, `created_at`, `-` for descending, `id` tie-break); `includes`.~~ Done 2026-09-28.
2. ~~`EmployeesController` (`index`, `show`, `create` via `CreateService`, `update` with strong params; `hired_on` I13 via the model) and jbuilder views (summary and detail).~~ Done 2026-09-28.
3. ~~Tests: contract shapes; the list has no `email` or salary fields; filter combinations; `q` search (case- and accent-insensitive, wildcard escaping); every sort field; pagination; `per_page` cap; `400` cases; create with and without `initial_salary`, prefixed errors, and nothing saved on failure; update including the I13 error; `404`; `401`; no N+1 (`assert_queries_count`); `DELETE` → 404 (L18).~~ Done 2026-09-28.

**Deliverables:** Employee endpoints, query object, views, and tests.
**Acceptance:** API §6 contract, validation, filtering, pagination, and authorization behaviour tested; no N+1; RuboCop and Brakeman clean.
**Status:** Done (2026-09-28). `bin/rails test` 164 runs, 560 assertions, 0 failures on 5 seeds; RuboCop 97 files clean; Brakeman 0 warnings. Live, signed out: `GET /employees` and `/employees/1` return `401`; `DELETE /employees/1` returns `404`. Query timing on the 10k demo data: default page 12 ms, `q=smith` 32 ms, country and status 12 ms, sort by `-hired_on` 9 ms. No N+1: the list's query count is identical for 2 and 12 employees.
Notes:
- **Bug fixed in 3.2 code:** `Employees::CreateService` re-added salary errors with `errors.add(..., message:)`. Rendering those messages crashed (`undefined method 'initial_salary.currency'`). It now uses `errors.import`, and a regression assertion was added to `create_service_test.rb`.
- **Contract clarifications** (recorded in API spec §6.3): `details` keys use request field names (`country_id`, `department_id`, `initial_salary.currency_code`); an invalid `hired_on` returns `422` (new `Employee` validation); a missing `employee` key returns `400` with `details`.
- `current_salary` is loaded in the controller (thin views) and uses `Date.current` (UTC).

### 4.4 Salary and history endpoints
**Prompt:** `Implement GET/POST /employees/:employee_id/salary_records and GET/PATCH …/:id per API §7 using Salaries::ChangeService and Salaries::CorrectionService (L16). Status, editable, and period in every record; no DELETE route; verify log redaction (L17).`
**Tasks:**
1. ~~`SalaryRecordsController` (`index` newest first, unpaginated; `show`; `create` via `ChangeService`; `update` via `CorrectionService`), scoped to the employee, and jbuilder views (API §7.1).~~ Done 2026-09-29.
2. ~~Error mapping: `not_editable` → `422 salary_record_not_editable`; date fields in `PATCH` → `422 validation_failed`; other errors → `422` with `details`.~~ Done 2026-09-29.
3. ~~Tests (with `travel_to`): history order, status, and `editable`; a change closes the prior period (API §7.3); backdated, same-date, and pre-hire changes → 422; decimal places per currency; correcting current and scheduled records → 200; historical → `422 salary_record_not_editable`; record of another employee → 404; `401`; `DELETE` → 404 (L18); log redaction (L17).~~ Done 2026-09-29.
4. ~~Update database design §12 (I12 no destroy routes: closed) and API spec if any detail changed.~~ Done 2026-09-29.

**Deliverables:** Salary endpoints, views, and tests.
**Acceptance:** Current and historical records behave as documented; a change preserves the prior record; `PATCH` corrects current and scheduled records and returns `422 salary_record_not_editable` for historical ones; invalid changes are rejected; logs contain no salary values; RuboCop and Brakeman clean.
**Status:** Done (2026-09-29). `bin/rails test` 183 runs, 650 assertions, 0 failures on 5 seeds; RuboCop 102 files clean; Brakeman 0 warnings. Live, signed out: `GET` and `PATCH` salary records return `401`; `DELETE` returns `404`.
Notes:
- **Log redaction (L17) finding:** request parameters are always `[FILTERED]`, but at `debug` level mysql2 writes SQL with inline values (`INSERT … VALUES (…, 123456.78, …)`, `SET first_name = 'Zenobia'`), because prepared statements are off. The test therefore asserts the production policy (architecture §7): logging at `info` (production default `RAILS_LOG_LEVEL=info`) contains no amounts, names, or emails, and `production.rb` defaults to `info`. **Follow-up (owner decision):** keep `RAILS_LOG_LEVEL` at `info` in production; optionally enable `prepared_statements: true` so debug SQL is redacted too.
- `POST` ignores `employee_id` and `effective_to` in the body; `PATCH` passes date fields through only so they are rejected as `cannot be changed`.

**Phase 4 gate: passed on 2026-09-29.** Session, reference, employee, and salary endpoints satisfy API spec §4–§7 and §10; all integration tests pass; no `/api/v1` path renders HTML (catch-all tests); I12 fully verified.

**Phase gate:** Session, reference, employee, and salary endpoints satisfy API spec §4–§7 and §10, all integration tests pass, no `/api/v1` path renders HTML, and I12 is fully verified.

---

## Phase 5 — Compensation analytics and report APIs
**Goal:** Provide accurate, currency-aware answers to organizational compensation questions.

### Phase 5 review findings (2026-09-29)

Inputs: requirements §3 (FR-04–FR-06), §7, §10–§11; API spec v2.0 §1–§2, §8–§12; database design §4, §7; architecture v2.2 §2–§4, §6–§8; ADRs 002–005; the Phase 4 codebase. No code written. Observed:
- **Reusable from Phase 4:** `Api::QueryParams` (`date_param`, `id_param`, `enum_param`, `sort_param`, `string_param`), `Api::Pagination` (with `@pagination_meta`), `Api::FormattingHelper#money` (BigDecimal, half-up), the `ErrorHandling` envelope, `SalaryRecord.in_effect_on(date)`, and `EmployeeSearchQuery` (its `q` matching is a private method).
- **`BaseController` forces JSON on every request** (`prepend_before_action :force_json_format`), and the routes default to `format: :json`. As things stand, `GET /reports/salaries.csv` would be treated as JSON. `render_error` already renders with `formats: :json`, so error envelopes stay JSON.
- There is no `export_too_large` handling yet. The `csv` library is a Ruby 3.2 default gem and is not in the `Gemfile`, which is fine on 3.2. On Ruby 3.4 or later it becomes a bundled gem and must be declared.
- Architecture §3 plans one `AnalyticsController` with three custom actions. `.claude/rules/backend.md` asks for RESTful conventions.
- Architecture §4.4 says the CSV "streams rows in batches", and database design §7.5 says "batches of 1,000". Rails `find_each`/`in_batches` always iterate in primary-key order, which conflicts with "same rows *and order* as the JSON report" under `sort=last_name` or `amount`.
- Test DB and dev DB run MySQL 8.4, so CTEs and window functions (median, D21) are available. Minitest 6 has no `minitest/mock`; tests override methods with `define_singleton_method` (H5).
- Dev DB holds 10,000 demo employees and 16,826 salary records in 7 currencies (JPY 0 and KWD 3 minor units). These can be used for read-only timing checks.
- **Repository state (not Phase 5 code, but it blocks a clean commit):** the git index has 31 staged **additions at the repo root** (`Gemfile`, `app/…`, `config/…`, `db/…`, `test/…`) that don't exist in the working tree (status `AD`), plus a staged rename of `backend/ .ruby-gemset`. This looks like an accidental `git add` from the wrong directory.

#### A. Missing decisions

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| M1 | **One shared population.** Summary, distribution, breakdown, and the report must use identical filter and as-of semantics. | Add an `Analytics::Population` query object. It builds `employees` filtered by `country_id`, `department_id`, and `employment_status` (default `active` + `on_leave`, D20), then `INNER JOIN`s the salary record `in_effect_on(as_of)`. All three analytics queries and `SalaryReportQuery` start from it. Also add an `employees_in_scope` relation (same filters, no salary join) for the summary counts. | 5.1 |
| M2 | **What the filters mean for a past `as_of`.** Status, country, and department are *current* values with no history (requirements §7). With `as_of` in the past, today's `terminated` employees are excluded even if they were active then, and employees hired after `as_of` count as "without salary". | Document the limitation, and echo `as_of` in every response (already specified). Exclude employees whose `hired_on > as_of` from `employees_in_scope` (NULL `hired_on` is included), so `employees_without_salary` isn't inflated by people not yet hired. Record this in API spec §8.2. | 5.1 |
| M3 | **Median SQL execution.** | Run the design §7.2 CTE through `connection.select_all` with a `sanitize_sql_array` bind for `as_of`. The inner population SQL comes from the AR relation (`to_sql`), so no user string is interpolated. Summary uses 3 queries: counts, grouped aggregates, and median. They are merged in Ruby by `currency_code`. Currency `minor_units` are loaded once (7 rows). | 5.1 |
| M4 | **Distribution bucket formula and edges.** Design §7.3 divides by a pre-computed width, `(max − min) / 10`. MySQL rounds decimal division, so values on or near an edge can land in the wrong band. The spec also doesn't say whether empty bands are returned or how edges are rounded for display. | Bucket index `LEAST(FLOOR((amount − min) * 10 / (max − min)), 9)`, with min and max per currency from a CTE. Always return **all 10 bands, including zero-count bands** (1 band when min = max), so charts stay stable. Edges are computed in Ruby with BigDecimal as `min + k × (max − min) / 10`. Counts use the exact edges; displayed `lower`/`upper` are rounded half-up to minor units (display only). Record this in API spec §8.3 and design §7.3. | 5.1 |
| M5 | **Breakdown dimension safety and filter combinations.** | `by` is validated with `enum_param(:by, %w[country department])` and mapped through a fixed hash to `employees.country_id` / `employees.department_id`. User input never reaches SQL. The other filters remain allowed alongside `by`, e.g. `by=department&country_id=5`. Metrics are count, total, average, and median (no min/max, per spec §8.4). | 5.1 |
| M6 | **Rounding of aggregates.** | SQL returns exact `DECIMAL` values (`AVG` returns 4 extra digits of scale). Views round average, median, total, min, max, and band edges with `money(value, minor_units)` (half-up, L14). A JPY median of `100001.5` is shown as `"100002"`. | 5.1 / 5.2 |
| M7 | **Controllers and routes (RESTful).** | `namespace :analytics { resource :summary, :distribution, :breakdown, only: :show }` → `Api::V1::Analytics::{Summaries,Distributions,Breakdowns}Controller#show`. `namespace :reports { resources :salaries, only: :index }` → `Api::V1::Reports::SalariesController#index` for JSON and CSV. The paths match API spec §11. Update architecture §3, which currently shows a single `analytics_controller.rb`. Declare these routes before the catch-all. | 5.2 |
| M8 | **Shared filter parsing and echo.** | Add an `Api::AnalyticsFilters` concern (built on `QueryParams`) that returns the parsed filters plus the echo hash. `employment_status` is **always an array** (`["active","on_leave"]` by default, `["terminated"]` when requested). Absent IDs are `null`. `as_of` is an ISO date. The report echo adds `q`. | 5.2 |
| M9 | **Report sort.** | `employee_number` (default), `last_name` (then `first_name`), and `amount`, each followed by `id` as the tie-breaker. `amount` and `-amount` both order by `currency_code ASC` first; only the amount direction changes. | 5.2 |
| M10 | **Shared `q` search.** `EmployeeSearchQuery#search` is private. | Move it into an `Employee.matching(q)` scope used by both `EmployeeSearchQuery` and `SalaryReportQuery`. This is a small Phase 4 refactor that the existing employee search tests already cover. | 5.2 |
| M11 | **Report `meta`.** | A `_report_meta` partial that renders `_pagination_meta` plus `as_of` and `filters` (API spec §9.1). | 5.2 |
| M12 | **Caching of salary responses.** Rails' default is `Cache-Control: max-age=0, private, must-revalidate`, which still lets a browser store the response. | Send `Cache-Control: no-store` on analytics and report JSON as well as the CSV. They carry salary data (security rules). Record this in API spec §8 and §9. | 5.2 |
| M13 | **Small-group disclosure.** A breakdown group of one employee reveals that person's salary. | No minimum group size. The single HR Manager is already authorised to see individual salaries through the report. Record this so it isn't mistaken for an oversight, and revisit if a second role is added. | 5.2 |
| M14 | **`.csv` versus the forced JSON format.** | `force_json_format` keeps `csv` only for actions that declare it (e.g. a class-level `csv_actions :index` on the report controller). Every other format, such as `.xml` or `.csv` on analytics, is still forced to JSON or gets `404`. Errors on a CSV request (`400`/`401`/`422`) render the JSON envelope with `application/json` (spec §9.2). | 5.3 |
| M15 | **CSV generation: no streaming, and a single-query cap.** | Query `SalaryReportQuery` with `limit(10_001)` and `pluck` the allowlisted columns in the report order. If more than 10,000 rows come back, return `422 export_too_large`. Otherwise build the file with `CSV.generate` and `send_data`. Rationale: one query means no count/fetch race. `find_each` would break the ordering. About 10k rows (1–2 MB) fits in memory, and streaming can't report an error after the first byte. Replace "streams in batches" in architecture §4.4 and design §7.5. The cap lives in a constant read through a method, so tests can lower it without inserting 10k rows. | 5.3 |
| M16 | **CSV file details.** | Header row = the allowlisted column names (spec §9.2). Amounts use `money()` formatting with no thousands separators. The filename uses the **`as_of` date** (`salary-report-<as_of>.csv`). The formula guard applies to every text cell. Prefix a **UTF-8 BOM** so Excel shows accented names correctly, since HR is moving off Excel. The `Content-Type` stays `text/csv; charset=utf-8`. Record this in API spec §9.2. | 5.3 |
| M17 | **Infrastructure.** | No caching layer, background jobs, new indexes, or new gems in Phase 5 (`csv` is stdlib on 3.2). Check `EXPLAIN` and timing on the 10k demo data read-only, and pass the results to 6.2. | 5.1–5.3 |
| M18 | **Test data.** | Build small known datasets with factories, explicit amounts, and `travel_to`. Never use the demo seeder in tests. Include two currencies of very different magnitude (e.g. JPY and KWD) in every aggregate test to catch accidental cross-currency mixing. | 5.1 |

#### B. Assumptions
- API spec v2.0 §8–§9 is the contract. The clarifications above (M2, M4, M8, M12, M16) are written into the spec in the subphase that implements them.
- Country, department, and employment status are current values for any `as_of` (no attribute history, requirements §7).
- There is no FX conversion. Every monetary figure is per currency and monthly (D3, ADR 002).
- There is one role, so being signed in is the only authorization check (D17). Every Phase 5 route requires login.
- About 10k employees and 17k salary records. SQL aggregates are expected to take tens of milliseconds. This is not an SLA; 6.2 measures it.
- The CSV is synchronous (D24); no Solid Queue job.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| Approval of M1–M18 (especially M2, M4, M12, M16, which change documented behaviour) | 5.1 | Project owner |
| Phase 4 concerns, helpers, and `in_effect_on` | 5.1–5.3 | Done |
| MySQL 8.0+ for CTEs and window functions | 5.1 | Available (8.4, dev and test) |
| 5.1 population and query objects | 5.2 | — |
| 5.2 `SalaryReportQuery`, filters concern, and report controller | 5.3 | — |
| Clean git index (unstage the root-level `AD` entries) | A clean Phase 4/5 commit, not the code | Project owner |
| Carried over: `RAILS_LOG_LEVEL` / `prepared_statements` decision (4.4); README health line (2.2) | Phase 6.3 / 7.2 | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Median or bands wrong on edge cases (even count, a single row, all amounts equal, values on a band edge) | Medium / High | M3, M4; known-data tests for each case |
| Currencies mixed by accident (e.g. global min/max in distribution, a median partition missing `currency_code`) | Low / High | Every CTE partitioned by currency; M18 two-magnitude test data; assert no top-level total key |
| JSON report and CSV diverge in rows or order | Medium / Medium | One `SalaryReportQuery`; M15 avoids `find_each`; a test concatenates JSON pages and compares them with the CSV |
| `.csv` served as JSON, or errors served as CSV | High (as the code stands) / Medium | M14 plus tests for `401`/`400`/`422` on the CSV path and `.xml` → 404 |
| CSV formula injection, or garbled names in Excel | Medium / Medium | Guard on every text cell with tests for `= + - @` tab CR; M16 BOM |
| Past `as_of` misread as a historical headcount | Medium / Low | M2 documentation; `as_of` echoed |
| SQL injection through `by`, `sort`, or `q` | Low / High | Fixed column maps, `sanitize_sql_like`, bound parameters; Brakeman clean |
| Salary responses stored by the browser or an intermediary | Low / Medium | M12 `no-store` on every Phase 5 response, asserted in tests |
| Slow aggregates or report on 10k rows | Low / Medium | SQL aggregates; `includes` / `pluck`; M17 timing check; indexes only in 6.2 if measured |
| Date-dependent flaky tests | Medium / Low | `travel_to` and explicit `as_of` in every test |
| Ruby upgrade later drops `csv` from the default gems | Certain on Ruby ≥ 3.4 / Low | Note in ADR 005: add `gem "csv"` with the upgrade |

### 5.1 Metric definitions and query layer
**Prompt:** `Per M1–M6 and M18: add Analytics::Population and Analytics::{Summary,Distribution,Breakdown}Query on the shared in-effect salary scope (design §7), per-currency only, with the median and bands computed in MySQL. Unit-test against small known datasets. No endpoints.`
**Tasks:**
1. ~~Owner: approve M1–M18.~~ The 5.1 defaults (M1–M6, M17, M18) were applied with the owner's request to implement 5.1 (2026-09-29). M7–M16 are still to be confirmed before 5.2 and 5.3.
2. ~~`Analytics::Population`: filters, default statuses, `INNER JOIN` to `in_effect_on(as_of)`, and the `employees_in_scope` relation with the M2 `hired_on` rule.~~ Done 2026-09-29.
3. ~~`Analytics::SummaryQuery`: in-scope and without-salary counts, then per-currency count, total, average, min, and max, then the median CTE (M3).~~ Done 2026-09-29 (`Analytics::Median` is shared with the breakdown query).
4. ~~`Analytics::DistributionQuery`: per-currency min and max, the bucket formula, 10 bands including empty ones, a single band when min = max, and BigDecimal edges (M4).~~ Done 2026-09-29.
5. ~~`Analytics::BreakdownQuery`: `by` column map (M5), grouped by `(dimension, currency)`, median partitioned by both, ordered by name then currency.~~ Done 2026-09-29.
6. ~~Tests (factories, `travel_to`, JPY + KWD + 2-decimal currencies) covering the cases listed in the review.~~ Done 2026-09-29: 22 tests in `test/queries/analytics/`.
7. ~~Read-only `EXPLAIN` and timing on the 10k dev data (M17).~~ Done 2026-09-29; see the notes below.

**Deliverables:** Population and three analytics query objects, with unit tests.
**Acceptance:**
- Every metric in API spec §8.2–§8.4 has a test on known data.
- No query produces a cross-currency figure.
- Median and band edge cases pass.
- `bin/rails test` passes on several seeds; RuboCop and Brakeman clean.

**Status:** Done (2026-09-29). `bin/rails test` 205 runs, 704 assertions, 0 failures on 5 seeds (1, 42, 1234, 9876, 31337); `test/queries` alone 22 runs, 54 assertions. RuboCop 112 files clean; Brakeman 0 warnings (2 ignored).
Notes:
- **M4 refinement:** the band index is not `FLOOR((amount − min) × 10 / (max − min))`. It is the count of k = 1…9 with `(amount − min) × 10 ≥ k × (max − min)`, which uses only exact decimal multiplication, so MySQL's rounded division can't move an edge value. A test covers a non-terminating width (0.3): 100.89 is in band 2 and 100.90 in band 3. Design §7.3 and API spec §8.3 are to be updated in 5.2 task 5, together with the M2 wording.
- Results are `Data` value objects with exact BigDecimals and `minor_units` per currency, so 5.2 views can round without another lookup (M6).
- **10k dev data (read-only, query cache off, best of 5):** summary 41 ms, distribution 70 ms, breakdown by country 50 ms, by department 51 ms. Population: 9,429 employees in scope, 93 without a salary on 2026-09-28, 7 currencies, 15 country/currency rows; the band counts add up to each currency's employee count. `EXPLAIN`: a full scan of `employees` (9,429 of 10,000 rows match the status filter, so a scan is expected), then a `ref` lookup on `salary_records (employee_id, …)`. No index is needed now; pass these figures to 6.2.
- With the query cache on (e.g. `rails runner` repeats), timings drop to about 1 ms. The figures above are uncached.

### 5.2 Analytics and salary report endpoints
**Prompt:** `Per M7–M13: expose GET /analytics/summary, /analytics/distribution, and /analytics/breakdown (API §8) and the paginated JSON GET /reports/salaries (§9.1) on SalaryReportQuery built from Analytics::Population. Shared AnalyticsFilters concern, jbuilder views with money rounding, Cache-Control no-store, integration tests including 401 and 400 cases.`
**Tasks:**
1. ~~`Api::AnalyticsFilters` concern: parse `as_of`, `country_id`, `department_id`, `employment_status`, and `by`, and build the echo hash (M8).~~ Done 2026-09-29 (`by` is parsed in the breakdown controller; the echo is `Analytics::Population#filters`).
2. ~~Routes (M7, before the catch-all); the three analytics controllers and their jbuilder views (`period: "monthly"`, `money()` per M6); `no-store` (M12).~~ Done 2026-09-29.
3. ~~`Employee.matching(q)` extraction (M10); `SalaryReportQuery` (population + `q` + M9 sort + preloads); `Reports::SalariesController#index` (JSON, `paginate`) and the report meta (M11).~~ Done 2026-09-29.
4. ~~Tests: `401` on all 4 routes; response shapes; filter echo; `400` cases; no employee-level fields in analytics; no `email` in the report; pagination; sort; `q`; no N+1; `Cache-Control: no-store`.~~ Done 2026-09-29: 17 integration tests.
5. ~~Docs: API spec §8 and §9.1 clarifications (M2, M4, M8, M9, M12, M13); architecture §3 (M7); database design §7.3 (M4, carried over from 5.1).~~ Done 2026-09-29.
6. ~~Live smoke on a spare port (signed out → `401` JSON); stop the server afterwards.~~ Done 2026-09-29.

**Deliverables:** Three analytics endpoints, the JSON salary report, views, the filters concern, tests, and updated docs.
**Acceptance:**
- Filtered and unfiltered responses match API §8 and §9.1.
- Every monetary figure is paired with `currency_code` and rounded to minor units.
- Access control and parameter validation are tested; no N+1.
- RuboCop and Brakeman clean.

**Status:** Done (2026-09-29). `bin/rails test` 222 runs, 829 assertions, 0 failures on 5 seeds (1, 42, 1234, 9876, 31337); the new integration tests alone: 17 runs, 125 assertions. RuboCop 124 files clean; Brakeman 0 warnings (2 ignored). Live on :3108, signed out: `GET /analytics/summary`, `/analytics/distribution`, `/analytics/breakdown?by=country`, and `/reports/salaries` each return `401` JSON; the server was stopped.
Notes:
- M7–M13 defaults were applied with the owner's request to implement 5.2 (2026-09-29).
- **M11 simplified:** the report `meta` is written inline in `reports/salaries/index.json.jbuilder` (reusing `_pagination_meta`) rather than in a separate `_report_meta` partial, since only one view uses it. The CSV has no `meta`.
- `Cache-Control: no-store` uses Rails' `no_store` in a `before_action` of the concern, so it also covers `400` responses from those endpoints.
- `GET /reports/salaries.csv` is still answered as JSON (forced format) until 5.3 (M14).
- Controllers call `::Analytics::…` with a leading `::`, because the `Api::V1::Analytics` controller namespace would otherwise shadow the query namespace.

### 5.3 CSV/report export endpoint
**Prompt:** `Per M14–M16 and D24: serve GET /reports/salaries.csv from the same controller and SalaryReportQuery. Allow csv only for that action; single-query 10,000-row cap returning 422 export_too_large; allowlisted columns; formula-injection guard; UTF-8 BOM; no-store and attachment headers; JSON error envelopes for every failure. Integration tests.`
**Tasks:**
1. ~~`BaseController` format handling (M14): CSV is allowed per action, and every other format still resolves to JSON or `404`.~~ Done 2026-09-29 (`allow_csv :index`; the report route is constrained to `json|csv`).
2. ~~A CSV builder: column allowlist, `money()` amounts, formula guard, BOM (M16).~~ Done 2026-09-29 as `SalaryReportCsv` in `app/exports/`, not `Reports::SalaryCsv`. `app/services` is kept for multi-step writes (architecture §3), and a `Reports` module would clash with the `Api::V1::Reports` controller namespace.
3. ~~Controller CSV branch: `limit(cap + 1)` → `422 export_too_large` or `send_data` with the three headers.~~ Done 2026-09-29 (rendered in the controller; no new `ErrorHandling` code).
4. ~~Tests: CSV equals the JSON pages; header row; no `email`; formula triggers; JPY/KWD formatting; `page`/`per_page` ignored; cap → JSON `422`; JSON `401` and `400`; `.xml` → `404`; headers; BOM.~~ Done 2026-09-29: 8 integration tests.
5. ~~Docs: architecture §3, §4.4 and §9 (M15); design §7.5; API spec §9.2 (M16); ADR 005 `csv` note.~~ Done 2026-09-29.
6. ~~Live smoke: signed out `.csv` → `401` JSON; stop the server afterwards.~~ Done 2026-09-29.

**Deliverables:** The CSV export on the report endpoint, the CSV builder, tests, and doc updates.
**Acceptance:**
- Exported rows equal the JSON report for the same filters and in the same order.
- Only allowlisted columns appear, and formula cells are escaped.
- Over 10,000 rows returns `422 export_too_large` with nothing truncated.
- Every error on the CSV path is a JSON envelope.
- RuboCop and Brakeman clean.

**Status:** Done (2026-09-29). `bin/rails test` 230 runs, 886 assertions, 0 failures on 5 seeds (1, 42, 1234, 9876, 31337); the new CSV tests alone: 8 runs, 57 assertions. RuboCop 126 files clean; Brakeman 0 warnings (2 ignored). Live on :3109, signed out: `.csv` → `401` JSON, `.xml` → `404` JSON; the server was stopped. Read-only on the 10k dev data: the unfiltered export is 9,336 rows and 0.73 MB, built in about 300 ms (uncached, best of 3).
Notes:
- M14–M16 defaults were applied with the owner's request to implement 5.3 (2026-09-29).
- The cap is read through `SalaryReportCsv.max_rows`. Tests lower it with `define_singleton_method` (no `minitest/mock` in minitest 6), so a 10,001-row fixture isn't needed; the boundary (exactly the cap allowed, cap + 1 rejected) is tested.
- **Formula-guard test finding:** `Employee` strips whitespace, and `normalizes` also applies to `update_columns` and to hash-form `update_all`, so a leading tab or CR can only reach the table through a raw SQL write. The test inserts those two cases with `update_all([ "first_name = ?", … ])` to prove data written outside the app is still neutralised.
- `page` and `per_page` are ignored on the CSV path and not validated there (API §9.2).
- `.csv` on analytics endpoints still answers JSON (they don't declare `allow_csv`).

**Phase 5 gate: passed on 2026-09-29.** The analytics (summary, distribution, breakdown), JSON report, and CSV export endpoints pass correctness tests on known data (per currency, with no cross-currency figures) and access-control tests (`401` on every route, JSON errors on the CSV path, `no-store`).

**Phase gate:** Analytics, report, and export endpoints pass correctness and access-control tests.

---

## Phase 6 — Backend quality, performance, and regression
**Goal:** Validate backend behavior against the target data volume without inventing unspecified SLAs.

### Phase 6 review findings (2026-09-29)

Inputs: requirements §4 (NFRs), §8, §11; API spec §1, §10, §12; architecture §5–§7, §9; database design §4, §6, §12; ADRs 004 and 005; `.claude/rules/*`; the codebase and test suite after Phase 5. No code written. Observed:
- **Suite:** 230 runs and 886 assertions across 31 test files (models, services, queries, concerns, helpers, integration, lib and tasks). It has passed on 5 seeds at the end of every subphase. There is no line-coverage tool (no SimpleCov).
- **Measured so far on the 10k demo data:**
  - employee list 9–32 ms (4.3);
  - analytics 41–70 ms uncached (5.1);
  - full CSV export (9,336 rows) about 300 ms (5.3).
  - Not yet measured: employee detail, salary history, JSON report sorts and `q`, deep pages, past `as_of`, and pagination `COUNT`s.
- **N+1 tests** exist for the employee list and the salary report. Salary history preloads `currency`, but no test proves its query count is constant.
- **Authentication tests are per file.** No test walks the route table, so a future route added without the default-deny base controller would go unnoticed.
- **CSRF** is tested only on `POST /session` (sessions test). No test covers the employee or salary `POST`/`PATCH` routes with forgery protection on.
- **Defect (contract gap):** database design §6 says unique or CHECK violations (`ActiveRecord::RecordNotUnique`, `StatementInvalid`) map to `422` with a generic message. Nothing in `app/` rescues them, so two concurrent creates with the same `employee_number` or `email` would pass validation and return **`500 internal_error`**. Salary writes are protected by the employee row lock, but employee create and update are not.
- **Log exposure:** Rails logs `Started GET "<filtered_path>"` and `Parameters:` at `info`. `filter_parameters` covers `amount`, `salary`, `first_name`, `last_name`, and `email`, but **not `q`**, so a name typed into employee or report search is logged in clear text. The L17 log test covers salary writes and login, not employee create/update or searches.
- **Production config:** `force_ssl` and `assume_ssl` are on; the log level defaults to `info`; `config.hosts` is unset (commented out). The `Secure` cookie flag is set by `session_store.rb` for production, but only `HttpOnly` and `SameSite` are tested. `prepared_statements` is not set (the 4.4 follow-up is still open).
- **Tooling:** Brakeman and RuboCop run locally. There is no dependency-vulnerability scan (`bundler-audit` is not installed). `backend/.github/workflows/ci.yml` sits outside the repo root, so GitHub never runs it, and it calls `importmap audit` and system tests (G3, kept by the owner).
- **Support dates:** Ruby 3.2.0 is past end of life, and Rails 8.0.x support ends **2026-11-07**, five weeks from today (ADR 005; Brakeman ignores both warnings).
- **Dev DB:** 10,000 employees, 16,826 salary records, and 1 user (the owner's HR login, whose password Claude does not have). The demo data is deterministic (seed 42), and `demo:verify` can confirm it is unchanged.

#### A. Missing decisions

**Owner decisions (2026-09-29):** N1–N13, N15, and N16 approved as recommended, including N9 option **(b)**: a temporary dev user, created and deleted by Claude. **N14 declined:** no dependency audit is run in Phase 6, and the missing scan is recorded as an accepted risk.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| N1 | **Fixing defects found while adding tests.** | 6.1 adds tests for behaviour that is already documented. If a test exposes a defect against the documented contract (e.g. N5), fix it in the same task with the smallest change and record it. Anything that changes the contract goes back to the owner. | 6.1 |
| N2 | **How coverage is judged.** | A requirement → test matrix (requirements §11, API spec §12, `.claude/rules/testing.md`) recorded under 6.1, with every row pointing at test names. No SimpleCov: line coverage would add a gem and says little about business rules. The owner can still request it (ADR 005 amendment). | 6.1 |
| N3 | **Default-deny proof.** | One integration test that walks `Rails.application.routes` under `/api/v1`, skipping `GET /health`, `GET`/`POST /session`, and the catch-all. For every other route and verb it asserts a JSON `401` without a session. New routes are covered automatically. | 6.1 |
| N4 | **CSRF coverage.** | The same route walk with `allow_forgery_protection = true` (pattern L7). Signed in, every `POST`/`PATCH`/`DELETE` without a token gets `422 invalid_csrf_token`, and with the token gets anything but that. | 6.1 |
| N5 | **Unique-constraint race → `422` (design §6).** | `ErrorHandling` rescues `ActiveRecord::RecordNotUnique` → `422 validation_failed` with a generic message. `details` is filled only for known unique indexes, mapped to request fields (`employee_number`, `email` → `["has already been taken"]`); otherwise it is omitted. It never contains values. CHECK violations stay `500`, since validations make them unreachable through the API. Test by making a controller path raise (as the 4.1 `500` test does), because the race can't be reproduced in a transactional test. | 6.1 |
| N6 | **Real concurrency tests.** | None. Transactional tests share one connection, so two-thread tests would be flaky and slow. Rely on the existing lock test (`lock!` called), the unique-index tests (I8, I9), and N5. Record this as an accepted limitation. | 6.1 |
| N7 | **Search terms in logs.** | Add `:q` to `filter_parameters` (search input is often a name). Extend the L17 log test to cover employee create/update and `GET` with `q` on employees and the report, at `info`. | 6.3 |
| N8 | **How performance is measured.** | Read-only `bin/rails runner` scripts in Claude's scratchpad (not committed), against the deterministic dev dataset after `demo:verify`. The query cache is off, each case takes the best of 5 runs, and `EXPLAIN ANALYZE` is captured for each query. No writes to the dev DB. | 6.2 |
| N9 | **End-to-end HTTP timings at volume** need a signed-in session, and Claude doesn't have the HR password. | **(a)** Claude writes a curl script that the owner runs with their credentials; **(b)** with owner approval, Claude creates a temporary user (`perf-smoke@example.test`) in the dev DB and deletes it afterwards; **(c)** skip HTTP and rely on N8 query and render timings. Recommended: **(b)**, falling back to (a). | 6.2 |
| N10 | **Scenarios to measure.** | Employee list: default, each filter, `q`, each sort, and page 400. Employee detail. History of the employee with the most records. Analytics ×3: default, filtered, and past `as_of`. JSON report: default, `sort=amount`, `q`, and a deep page. Full CSV. Pagination `COUNT`s. OFFSET paging is kept (at 10k rows, page 400 is cheap); keyset paging is not introduced. | 6.2 |
| N11 | **When to add an index.** | Only when a scenario is over **100 ms uncached** on the 10k data, *or* `EXPLAIN` shows a scan or filesort that an index removes with at least a 2× gain. 100 ms is an internal review threshold, **not an SLA**. Candidates already named in design §4: `hired_on` / `created_at` sorts, `(employment_status, country_id)`, `(effective_from, effective_to)`. Any index goes through a migration with a round-trip check (J13). | 6.2 |
| N12 | **Where results are recorded.** | A new database design **§13 "Measured performance (6.2)"** (scenario, rows, time, plan, decision), rather than a separate document. The plan's 6.2 notes summarise it. | 6.2 |
| N13 | **Target-volume regression (phase gate).** | No 10k-row tests in the suite (too slow, and they duplicate the known-data tests). Instead run `demo:verify` plus a read-only runner script of cross-endpoint invariants on the dev data: <br>- per-currency counts add up to the population; <br>- band counts equal the employee counts; <br>- breakdown counts add up to the summary counts; <br>- CSV row count equals the report's `total_count`; <br>- no currency appears without its own rows. <br>Record the results. | 6.2 / 6.3 |
| N14 | **Dependency vulnerability scan.** *Declined by the owner (2026-09-29).* | ~~An owner-approved one-off `gem install bundler-audit` (outside the Gemfile, so no new app dependency), then `bundle-audit check --update`, which needs network access. Record the results; fixing any finding that needs a gem update is an owner decision.~~ Not run; recorded as an accepted risk in 6.3. | 6.3 |
| N15 | **Production hardening.** | Test that the production session config sets `Secure`. Set `config.hosts` from an env var (e.g. `APP_HOSTS`) in production, or document it as a deployment prerequisite (deployment is deferred, so documenting is the recommended default). Close the 4.4 log follow-up: keep `info` and document "never `debug` in production"; `prepared_statements: true` stays optional. | 6.3 |
| N16 | **CI.** | Out of scope for Phase 6. `backend/.github/workflows/ci.yml` stays inert (G3). Phase 7 documents the manual quality commands. The owner can ask for a root-level workflow later. | 6.3 |

#### B. Assumptions
- No latency, throughput, or concurrency SLA exists (requirements §4, §7). Timings are reported as observations on the owner's laptop (MySQL 8.4), not guarantees.
- The dev DB still holds the deterministic 10k dataset. `demo:verify` confirms this before any measurement; if it differs, the owner reseeds.
- One HR user and a same-site frontend (ADR 004). No new roles, CORS, or JWT.
- Phase 6 changes are limited to tests, verified defect fixes (N1), measured indexes (N11), and config or doc hardening (N7, N15). No new features and no new gems unless the owner approves (N2, N14).
- The owner still commits, and the 31 root-level `AD` entries should be unstaged before the next commit.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of N1–N16~~ Approved 2026-09-29 except N14 | 6.1 | Project owner |
| Dev DB with the unchanged 10k demo dataset (`demo:verify`) | 6.2, N13 | Owner (reseed if changed) |
| A temporary dev user (N9 b, approved) | 6.2 HTTP timings | Claude (created and deleted in one script) |
| 6.1 test additions and the N5 fix | 6.3 regression run | — |
| Carried over: README health line (2.2); log-level decision (4.4, folded into N15) | 6.3 / 7.2 | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| A duplicate-key race returns `500` and breaks the documented contract | Low (single user) / Medium | N5 fix and test |
| A new route ships without authentication or CSRF | Low / High | N3, N4 route-walking tests |
| Employee names leak into logs through `q` | High (always happens at `info`) / Medium | N7 filter and extended log test |
| Rails 8.0 support ends 2026-11-07; Ruby 3.2.0 is already past end of life | Certain / Medium for real data, Low for the assessment | Record in 6.3 and Phase 7 known limitations; upgrade is out of Phase 6 scope |
| Unpatched gem vulnerabilities go unnoticed | Medium / Medium | N14 declined: accepted risk; listed in Phase 7 known limitations (e.g. run `bundle-audit` or enable Dependabot before real data) |
| Indexes added without evidence (or missing where needed) | Medium / Low | N11 threshold and `EXPLAIN`; the migration round-trip check |
| Measurement noise on a laptop | Medium / Low | Best of 5, query cache off, report plans as well as times |
| A temporary user is left in the dev DB (N9 b) | Low / Medium | Created and deleted in one script with `ensure`; `User.count` checked before and after |
| Route-walking tests are brittle (the catch-all or globbed routes) | Medium / Low | Explicit skip list; fill route params with an existing record's id |
| Scope creep into Phase 7 docs or CI | Medium / Low | N16; 6.x docs limited to design §13 and the plan |

### 6.1 Backend test coverage review
**Prompt:** `Per N1–N6: build the requirement → test matrix (requirements §11, API spec §12, testing rules), add the missing tests (route-walking 401 and CSRF, salary-history N+1, RecordNotUnique → 422), fix documented-contract defects they expose, and run bin/rails test on several seeds.`
**Tasks:**
1. ~~Owner: approve N1–N16.~~ Approved 2026-09-29 except N14.
2. ~~Requirement → test matrix (N2).~~ Done 2026-09-29; see below.
3. ~~`test/integration/api/v1/route_protection_test.rb`: default-deny route walk (N3) and CSRF route walk (N4).~~ Done 2026-09-29. The walk covers 21 `/api/v1` route/verb pairs (8 state-changing), and a guard test asserts the documented routes are among them.
4. ~~N5: `RecordNotUnique` → `422 validation_failed` in `ErrorHandling` (known-index `details` only), with integration tests on employee create and update.~~ Done 2026-09-29.
5. ~~Salary-history no-N+1 test; further gap tests from the matrix.~~ Done 2026-09-29: history N+1; duplicate `email` through the API (422, value not echoed); the `404` body asserted generic. The unpermitted `id`/`created_at` case was already covered ("unknown body fields are ignored").
6. ~~`bin/rails test` on 5 seeds; RuboCop; Brakeman.~~ Done 2026-09-29.

**Deliverables:** Coverage matrix, new tests, the N5 fix, and test results.
**Acceptance:**
- Every FR-01…FR-07, NFR security/reliability row, and API §12 bullet maps to at least one passing test, or is listed as an accepted gap with a reason (e.g. N6).
- The suite passes on 5 seeds; RuboCop and Brakeman clean.

**Status:** Done (2026-09-29). `bin/rails test` 238 runs, 995 assertions, 0 failures on 5 seeds (1, 42, 1234, 9876, 31337); RuboCop 127 files clean; Brakeman 0 warnings (2 ignored).

**Coverage matrix (6.1, N2).** Test files are under `backend/test/`; `int/` = `integration/api/v1/`.

| Requirement / API §12 bullet | Covered by (test file → tests) | Status |
|---|---|---|
| FR-01 Employee management | `int/employees_test` (create with and without initial salary, update, detail, list, `404`, no `DELETE`); `models/employee_test`; `services/employees/create_service_test`; `int/reference_data_test` | Covered |
| FR-02 Salary records | `models/salary_record_test` (amount > 0, scale vs minor units, currency, period order, hire date, read-only columns); `int/salary_records_test` (create, validation `422`, corrections); `services/salaries/correction_service_test` | Covered |
| FR-03 Salary history | `services/salaries/change_service_test` (closes prior period, rollback, backdate, scheduled, lock); `int/salary_records_test` (history order and status, historical `422`); `models/salary_record_test` (one open record, overlap, same start date) | Covered |
| FR-04 Search, filters, pagination | `int/employees_test` (filters, `q`, sorts, pagination, `400`, N+1); `int/salary_report_test`; `controllers/concerns/api/query_params_test`; `…/pagination_test` | Covered |
| FR-05 Analytics | `queries/analytics/*` (22 known-data tests); `int/analytics_test` (9 contract tests) | Covered |
| FR-06 Reports and export | `int/salary_report_test`; `int/salary_report_csv_test` (CSV = JSON pages, allowlist, formula guard, cap `422`, JSON errors) | Covered |
| FR-07 Authentication and access | `int/sessions_test` (login, generic failure, fixation, logout, expiry, `429`, cookie flags, CSRF on session); **`int/route_protection_test`** (every route `401`; every state-changing route needs CSRF); a `401` test in each endpoint file | Covered |
| NFR Performance | N+1 tests: employee list, salary report, **salary history** (new) | Covered in tests; 10k measurements in **6.2** |
| NFR Security and privacy | Log redaction at `info` (`int/salary_records_test`, `int/sessions_test`); no email or salary in lists (D18); errors never echo values (employees, salary, **duplicate email**, **N5 race**); generic `404` body; `no-store` (analytics, report, CSV); formula guard; CSRF walk | Covered, except: `q` in logs (**6.3, N7**); `Secure` cookie in production (**6.3, N15**) |
| NFR Reliability | Rollback tests (`create_service_test`, `change_service_test`); lock test; DB guards (unique, CHECK, FK tests in the model tests); **N5 race → `422`** | Covered. Accepted gap: no real multi-thread tests (**N6**) |
| NFR Maintainability | This suite; RuboCop; Brakeman | Covered; setup docs in Phase 7 |
| §12 Auth | route walk `401`; generic login failure; `429`; CSRF walk; logout; idle and absolute expiry | Covered |
| §12 Employees | required fields and formats; unique number (`422` + race) and email (`422` + race); filter combinations; sort allowlist `400`; `per_page` cap; list without salary or email; transactional create; no delete route | Covered |
| §12 Salary | period closing; backdated, same-date, and pre-hire `422`; JPY and KWD scale; `scheduled` status; current and scheduled corrections; historical `422`; date fields `422`; another employee's record `404` | Covered |
| §12 Analytics | per-currency totals; no cross-currency total; odd and even medians; `as_of`; terminated excluded; bands; dimension + currency keys; `by` validated | Covered |
| §12 Reports | JSON = CSV rows; column allowlist; formula escaping; over-cap `422`; JSON `401` on CSV | Covered |
| §12 Privacy | no submitted values in error bodies; salary fields filtered from logs | Covered; `q` filtering in **6.3** |
| Operational (health, `hr:create_user`, demo tasks) | `int/health_test`; `lib/tasks/hr_rake_test`; `lib/tasks/demo_rake_test`; `lib/demo/*` | Covered |

Notes:
- **N5 fix (defect against design §6):** `Api::ErrorHandling` rescues `ActiveRecord::RecordNotUnique` → `422 validation_failed`, with `details` only for `index_employees_on_employee_number` and `index_employees_on_email`. The race is reproduced by temporarily making `Employee#valid?` return true, so the real MySQL error fires. **Mutation check:** with the rescue removed, both tests error with `Mysql2::Error: Duplicate entry '…' for key 'employees.index_employees_on_…'`; the message contains the duplicate value, which is why only the index name is inspected. Docs updated: design §6 (CHECK violations stay `500`, being unreachable through the API), API spec §10, architecture §6.
- The `count_queries` helper was copied into two test files, so it moved into `ActionDispatch::IntegrationTest` in `test/test_helper.rb`; the history test is its third user.
- The route walk replaces every `:param` with `1`. A `401` (and the CSRF check) fires before any record lookup, so no records are needed. The session routes are left out of the with-token walk because `sessions_test.rb` covers them.

### 6.2 Performance and query review
**Prompt:** `Per N8–N13: after demo:verify, measure the N10 scenarios on the 10k dev data (read-only runner scripts, query cache off, best of 5, EXPLAIN ANALYZE). Add an index only when N11's threshold is met, via a migration with a round-trip check. Record results in database design §13. Run the N13 invariants. Do not claim an SLA.`
**Tasks:**
1. ~~`bin/rails demo:verify` (dataset unchanged).~~ Done 2026-09-29: 10,000 employees, 16,826 records, 0 violations in every check (the same counts as 3.3). The 3.3 fingerprint method isn't recorded, so the counts and integrity checks stand in for it.
2. ~~Query and render timings plus `EXPLAIN ANALYZE` for every N10 scenario (N8).~~ Done 2026-09-29: 28 scenarios (design §13.1).
3. ~~HTTP timings per N9 option (b).~~ Done 2026-09-29: 15 endpoints (design §13.2). Temporary user: `User.count` 1 → 2 → 1; server stopped; port free.
4. ~~Evaluate the design §4 index candidates against N11.~~ Done 2026-09-29. Trial migration, measured, then finalised: `hired_on`, `created_at`, and `(employment_status, country_id)` added; `(effective_from, effective_to)` dropped (design §13.3).
5. ~~The N13 cross-endpoint invariants on the dev data.~~ Done 2026-09-29: 33 checks over 3 populations, all holding.
6. ~~Database design §13 (N12); update design §4.~~ Done 2026-09-29 (design v2.1).

**Deliverables:** Performance findings, justified changes (if any), and the invariant results.
**Acceptance:**
- Every N10 scenario is measured with its plan.
- No avoidable N+1 queries or unbounded listings remain (all lists are paginated or capped).
- Every index decision cites a measurement.
- The invariants hold; the limitations are documented.

**Status:** Done (2026-09-29).
- **Migration:** `db/migrate/20260929100001_add_measured_indexes.rb` (`db:migrate` on dev; `db:migrate:redo STEP=1` leaves `schema.rb` identical; `db:test:prepare`).
- **Checks:** `bin/rails test` 238 runs, 995 assertions, 0 failures on 5 seeds; RuboCop 128 files clean; Brakeman 0 warnings (2 ignored).
- **Invariants (N13), each checked for default, `country=IN` + `active`, and `as_of` 2025-01-01:**
  - in scope = with salary + without;
  - one salary row per employee;
  - band counts equal the currency counts, and band edges span min..max;
  - country and department breakdown counts and totals add up to the summary per currency;
  - report `total_count` equals the summary count, and CSV rows equal the report count (9,336 / 1,110 / 8,483).

Notes:
- **Results:** every query-layer scenario is under 100 ms except the full CSV, which is 293 ms, with 71 ms of it SQL and the rest Ruby formatting. Over HTTP in development, requests take 37–94 ms and the CSV 338 ms; development mode adds a floor of about 35–40 ms. No SLA is claimed.
- **Index gains:** combined status + country filter 12.1 → 4.6 ms; `sort=hired_on` / `created_at` about 6.3 → 2.1–2.4 ms. Descending sorts stay a filesort of about 7 ms, because `field DESC, id ASC` is a mixed direction. Changing the tie-break direction would alter API §2.4 and the gain is below the threshold, so it wasn't changed.
- **No N+1 and no unbounded lists:** query counts are constant per scenario (3–6). Every list is paginated (at most 100 per page) or capped (CSV at 10,000). Salary history and reference lists are small and bounded by design (API §1).
- **Owner options, not done:**
  - the single-column `employment_status` index is now a left prefix of the new composite and could be dropped (not measured, so kept);
  - `q` contains-search (18–19 ms) scans an index by design (D27).
- The first HTTP script run failed before creating anything: RVM doesn't load under `set -u`. The check afterwards found no temporary user and a free port. The scripts live in Claude's scratchpad and are not committed (N8).

### 6.3 API regression and security review
**Prompt:** `Per N7 and N13–N16: review authentication, authorization, parameters, sensitive-data exposure, error responses, CSV safety, logs, and production config. Apply the approved fixes (q log filter, Secure-cookie test, hosts/log-level docs; no dependency audit, N14 declined), then run the full regression (tests on 5 seeds, RuboCop, Brakeman, live signed-out smoke) and report exact commands and outcomes.`
**Tasks:**
1. ~~Security checklist against `.claude/rules/security.md` and architecture §5–§7.~~ Done 2026-09-29; see below.
2. ~~N7: `q` in `filter_parameters`; extend the log test.~~ Done 2026-09-29. `/\Aq\z/` is an exact match, because a bare `:q` would filter every key containing "q". New `test/integration/api/v1/log_redaction_test.rb` covers employee create and `q` on the employee list, JSON report, and CSV.
3. ~~N15: production `Secure` cookie test; `config.hosts` decision; log-level follow-up closed.~~ Done 2026-09-29. New `test/config/security_config_test.rb`: `session_store.rb` re-evaluated as production; `force_ssl`, `assume_ssl`, and `info` in `production.rb`; the exact `q` filter; redacted model `inspect`. `config.hosts` and "never `debug`" are recorded as deployment prerequisites in architecture §9. The 4.4 follow-up is closed: keep `info`; `prepared_statements` stays optional and not adopted.
4. ~~N14: `bundle-audit` run.~~ Declined by the owner; recorded as accepted risk R2 below.
5. ~~Regression: tests ×5 seeds, RuboCop, Brakeman, live smoke; stop the server afterwards.~~ Done 2026-09-29.
6. ~~Record the unresolved risks for Phase 7.~~ Done 2026-09-29; see "Accepted risks".

**Deliverables:** Security findings with resolutions, regression results, and the list of accepted risks.
**Acceptance:**
- Critical API workflows pass.
- Every security-rule item has a test or a documented acceptance.
- No search terms, names, emails, or amounts appear in `info` logs.
- Unresolved risks and skipped checks are listed with reasons.

**Status:** Done (2026-09-29).
- **Tests:** `bin/rails test` 245 runs, 1,040 assertions, 0 failures on 5 seeds (1, 42, 1234, 9876, 31337); RuboCop 130 files clean; `bin/brakeman --no-pager` 0 warnings (2 ignored), 0 errors.
- **N7 mutation check:** with the `q` filter removed, the log test fails, showing `Started GET "/api/v1/employees?q=Garcia…"` and `Parameters: {"q"=>"Garcia"…}`; with it restored, the test passes.
- **Live smoke on :3111, signed out (the server was stopped and the port freed):**
  - `GET /health` → `200` `{"status":"ok","database":"ok"}`; `GET /session` → `200` with a CSRF token;
  - `401` JSON for the employee list, detail, create and update; salary history and create; countries; analytics summary and breakdown; the JSON report; `.csv`; and `DELETE /session`;
  - `404` JSON for `DELETE /employees/1`, `.xml`, and an unknown path.
- **Secrets:** no `.env`, `master.key`, `.pem`, or credential key is tracked (`git ls-files`); `backend/.env` and `config/master.key` are ignored; no hard-coded secret literals in tracked `app`/`config`/`lib`/`db`.

**Security checklist (6.3).**

| Rule / policy | Evidence | Result |
|---|---|---|
| Never expose secrets in source code | `git ls-files` and `git check-ignore` (above); secrets come from `ENV` (`database.yml`, `hr:create_user`) | Pass |
| Enforce authorization on the server | Default-deny `BaseController`; `route_protection_test` (every route `401` signed out); one role, `403` unused (D17) | Pass |
| Validate and sanitize user input | `QueryParams` (`400` on invalid page, sort, IDs, dates, `q` length); strong params; model validations and DB constraints; `LIKE` escaping (`q treats LIKE wildcards literally`); malformed JSON → `400`; the `by` dimension map | Pass |
| Do not log salary or other sensitive data | `info`-level log tests: salary writes and employee update (`salary_records_test`), login (`sessions_test`), employee create and `q` searches (`log_redaction_test`); redacted model `inspect` (`security_config_test`) | Pass at `info`. Accepted: SQL at `debug` shows values (R3) |
| Protect against mass assignment | `permit` allowlists; `unknown body fields are ignored` (employee `id`, `created_at`); salary `POST` ignores `employee_id`/`effective_to`; `PATCH` rejects date changes; Brakeman mass-assignment check clean | Pass |
| Use secure session or token handling | `sessions_test` (bcrypt, `authenticate_by`, fixation reset, 30-minute and 8-hour expiry, `429`, `HttpOnly`, `SameSite=Lax`); `security_config_test` (`Secure` in production); CSRF on every state-changing route (`route_protection_test`) | Pass |
| Avoid exposing employee data in error messages | Generic `404`/`500` envelopes; `422` never echoes values (employees, salary, duplicate email, N5 race); CSV errors are JSON | Pass |
| Architecture §5 auth boundary | Default deny; only health and `GET`/`POST /session` are public (route walk); JSON-only (catch-all, forced format, `.xml` → `404`) | Pass |
| Architecture §6 error contract | `error_handling_test`, N5 tests, CSV `422 export_too_large`, `invalid_csrf_token` | Pass |
| Architecture §7 redaction; CSV safety | As above; the CSV column allowlist (no email), formula guard, `no-store` (`salary_report_csv_test`); analytics and report responses `no-store` | Pass |
| Dependency vulnerabilities | Not scanned (N14 declined) | Accepted risk R2 |

Brakeman note: it analyses controllers and models but not jbuilder views ("Templates: 2" are the generated HTML layouts). JSON views render no HTML, and the fields they output are covered by the contract tests above.

**Accepted risks and skipped checks (for Phase 7 known limitations):**
- **R1 Runtime support:** Ruby 3.2.0 is past end of life, and Rails 8.0.x support ends 2026-11-07. Acceptable for an assessment with synthetic data; upgrade before any real data (ADR 005; Brakeman ignores both).
- **R2 No dependency audit:** N14 declined. Run `bundle-audit` or enable Dependabot before real data.
- **R3 Debug SQL logging:** at `debug`, mysql2 writes SQL with inline values (including `LIKE '%<q>%'`). Production must stay at `info` (architecture §9). `prepared_statements: true` is optional and not adopted.
- **R4 `config.hosts` unset:** host-header checks are off until deployment. Documented as a deployment prerequisite (architecture §9, N15).
- **R5 CI inert:** `backend/.github/workflows/ci.yml` is not at the repo root, so GitHub never runs it (G3, N16). The quality commands are run manually and will be documented in Phase 7.
- **R6 No real concurrency tests:** N6. The row lock, unique indexes, and the N5 `422` mapping are tested.

**Phase 6 gate: passed on 2026-09-29.**
- The backend suite (245 runs) passes on 5 seeds.
- Critical API workflows are verified on the 10k synthetic dataset (6.2: measurements, HTTP timings, and 33 invariants).
- The security checklist passes, with accepted risks R1–R6 recorded.

**Phase gate:** Backend test suite and critical API workflows are verified with synthetic target-volume data.

---

## Phase 7 — Backend documentation and handoff
**Goal:** Make the backend easy to run, inspect, and extend when frontend work begins.

### Phase 7 review findings (2026-09-29)

Inputs:
- `docs/requirements.md` (v1.1, §8 acceptance, §11 traceability);
- `docs/architecture.md` (v2.2), `docs/database-design.md` (v2.1), `docs/api-specification.md` (v2.0), ADRs 001–005;
- root and backend `README.md`, `CLAUDE.md`, `.claude/rules/*`, `PROJECT_DEV_PLAN.md`, `backend/.env.example` (names only);
- the codebase and git state after the Phase 6 commit (`707ff61`).

No code written. Observed:
- **Backend state:** Phases 1–6 are done and committed. The suite has 245 runs and passes on 5 seeds; RuboCop and Brakeman are clean. Accepted risks R1–R6 are recorded under 6.3.
- **Root `README.md` is stale in places:**
  - the status line still says "Phase 2";
  - the health line says `GET /api/v1/health` "arrives in task 2.2" (a follow-up carried since 2.2);
  - step 3 still says to check H3 "before the first run" (H3 was applied in 2.2);
  - there is no step to run `bin/rails db:migrate` on an existing checkout (6.2 added a migration);
  - there are no MySQL commands to create the recommended dedicated user and databases;
  - there is no API overview, sign-in walkthrough, or known-limitations section.
- `backend/README.md` only points to the root README, as decided in 2.1.
- **Stale design-doc details:**
  - architecture §3's code layout names `lib/tasks/hr_user.rake` (the real file is `hr.rake`, next to `demo.rake`), lists concerns without their `api/` folder, and omits `not_found_controller.rb` and `lib/demo/`;
  - API spec §11 gives the reference-data endpoints phase 4.3 (they shipped in 4.2, L1);
  - requirements §11 still has a "Planned tests" column, while the actual tests now exist (6.1 coverage matrix).
- **Doc headers and versions:** the headers still say "Approved design/contract for implementation". The API spec is v2.0 and architecture v2.2, although both were clarified in Phases 4–6 without version bumps or a changelog.
- **Frontend handoff:** the API spec is the contract. There is no client-oriented summary (session + CSRF sequence, error handling, pagination, money as strings, CSV download, same-site or dev-proxy requirement), no OpenAPI file, and no curl walkthrough. `PROJECT_DEV_PLAN.md` holds the only frontend phases (2.3, 2.4) and is marked superseded for backend work.
- **Generated but unused (G1/G3, kept by the owner):**
  - importmap, Turbo, Stimulus, `app/javascript`, HTML layouts, PWA views, mailers, and jobs;
  - Solid Queue (no jobs);
  - Kamal, Thruster, and the Dockerfile;
  - `backend/.github/workflows/ci.yml` (inert, R5).
- **Repository hygiene:** 30 accidental root-level `AD` entries are still staged. `.idea/` IDE files are tracked in git.
- **No out-of-scope code:** a scan of `app/`, `lib/`, and routes for payroll, tax, disbursement, FX, and AI terms found nothing.

#### A. Missing decisions

**Owner decisions (2026-09-29):** P1–P13 approved as recommended, including the P2 fix policy (report first; Critical/High only with approval) and P9 (the clean clone may copy `backend/.env` without reading it).

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| P1 | **7.1 review method and output.** | Read every file in `app/`, `lib/`, `config/` (non-generated), `db/migrate`, and the routes against CLAUDE.md, `.claude/rules/*`, and the four docs. Report findings in a table by severity (Critical / High / Medium / Low), each with a `file:line` and evidence. Reuse the 6.1 matrix and 6.3 checklist rather than repeating them. | 7.1 |
| P2 | **Fix policy for 7.1 findings.** | Per the 7.1 prompt, report first. Fix Critical and High only after owner approval, with tests. Low findings and doc-only corrections can be fixed directly. Medium findings are listed for the owner to decide. Nothing that changes the API contract without approval. | 7.1 |
| P3 | **Generated but unused code (G1/G3).** | Keep, as the owner decided. List it in the README under "Generated files not used by the API", so reviewers aren't confused. | 7.2 |
| P4 | **Redundant `index_employees_on_employment_status`** (6.2 owner option). | Keep: no measured harm at 10k rows, and removal wasn't measured. Record it under known limitations as an optional clean-up. | 7.1 |
| P5 | **Where setup docs live.** | The root `README.md` stays the single setup guide (2.1). Fix the stale items above, and add these sections: <br>- **MySQL setup:** example `CREATE DATABASE`/`CREATE USER`/`GRANT` statements, with placeholder values only; <br>- **Updating an existing checkout:** `bin/rails db:migrate` and `db:test:prepare`; <br>- **API overview:** an endpoint table, conventions, and links to the spec; <br>- **Sign-in walkthrough:** curl with a cookie jar and the CSRF header; <br>- **Known limitations** (P8); <br>- **Troubleshooting:** RVM gemset, `json < 3`, single-process tests (K1). | 7.2 |
| P6 | **Frontend-ready API documentation.** | No OpenAPI or Swagger (it would add tooling or gems; the Markdown spec is the contract). Add API spec **§13 "Client integration notes"**: <br>- the session and CSRF sequence, and same-site or dev-proxy use; <br>- handling `401`/`422`/`429`; <br>- the error envelope and `details`; <br>- pagination `meta`; <br>- money as strings with `currency_code`, and no cross-currency totals; <br>- dates in UTC; <br>- CSV download and its `422`. <br>Bump the spec to **v2.1**, with a changelog of the Phase 4–6 clarifications. | 7.2 |
| P7 | **Doc headers, versions, and stale details.** | Set each design doc's status to "Implemented through Phase 6 (2026-09-29)" and bump versions: requirements 1.2, architecture 2.3, database design 2.2 (if changed), API 2.1. Each gets a short changelog. Fix architecture §3 to match the real tree and API §11's phase numbers. In requirements §11, change "Planned tests" to "Tests", naming the actual test files. | 7.2 |
| P8 | **Known limitations (one list).** | In the README, linking to the plan: <br>- the accepted risks R1–R6 (6.3); <br>- no currency conversion; <br>- only current country, department, and status (no history); <br>- no mid-history salary inserts, and a future record's start date can't be corrected; <br>- one HR user with no roles; <br>- CSV synchronous and capped at 10,000 rows; <br>- OFFSET paging, and descending sorts are a filesort; <br>- history plus timestamps as the only audit trail (D5); <br>- single-process tests (K1); the `json < 3` pin; <br>- demo tasks are development-only; <br>- measured timings are laptop observations, not SLAs. | 7.2 |
| P9 | **Clean-clone verification** (the 7.2 acceptance: "a reviewer can run the backend"). | With owner approval: <br>- Claude clones `HEAD` into its scratchpad and copies `backend/.env` there without reading it; <br>- it runs `bundle check`, `bin/rails db:test:prepare`, `bin/rails test`, and `bin/rails server` on a spare port (health `200`, a signed-out `401`); <br>- then it deletes the clone. <br>It uses the existing databases only; creating databases and users stays the owner's step, per the standing rule. The owner may also do a from-scratch walkthrough. | 7.2 |
| P10 | **Repository hygiene before handoff.** | Owner: <br>- unstage the 30 root-level `AD` entries (`git restore --staged Gemfile Gemfile.lock Gemfile.lock.bck app config db test`); <br>- stop tracking `.idea/` (`git rm -r --cached .idea` plus a root `.gitignore` entry). <br>Claude doesn't run git commands (standing rule). | 7.2 |
| P11 | **`CLAUDE.md` Commands section.** | Add the `db:seed`, `demo:seed`/`demo:verify`, `hr:create_user`, and `db:migrate` commands, so later sessions (including frontend planning) can run the app. Leave the rest of `CLAUDE.md` unchanged. | 7.2 |
| P12 | **Frontend handoff pointer.** | No new handoff document. Expand the plan's **"Future work"** section with the frontend prerequisites: <br>- same-site serving or a dev proxy to `:3000` (ADR 004); <br>- the CSRF flow; <br>- the `401` redirect; <br>- currency-safe display; <br>- links to API §13 and the known limitations. | 7.2 |
| P13 | **Final regression after the doc changes.** | `bin/rails test` ×5 seeds, RuboCop, Brakeman, and a live signed-out smoke (health, `401`, catch-all `404`), recorded at the end of 7.2, even if 7.1 changes nothing. | 7.2 |

#### B. Assumptions
- Backend and docs only. No frontend code, new features, new gems, or Docker work (Docker stays deferred).
- The docs describe what is implemented and tested. Where a doc and the code disagree, the code (confirmed by tests) wins, unless 7.1 finds the code is wrong (P2).
- A reviewer uses macOS or Linux with RVM (or another Ruby manager), MySQL 8.0.16 or later, and can create a MySQL user and databases.
- The owner keeps making all commits and creating databases and users.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| ~~Approval of P1–P13~~ Approved 2026-09-29 | 7.1 | Project owner |
| Owner approval of any Critical/High fix found in 7.1 (P2) | 7.1 close | Project owner |
| 7.1 findings resolved or accepted | 7.2 (the docs must describe the final code) | — |
| Git hygiene (P10) | A clean handoff commit | Project owner |
| Existing dev and test databases, and `backend/.env` (P9) | 7.2 clean-clone check | Project owner |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Docs describe behaviour the code doesn't have (drift) | Medium / High | 7.1 cross-checks the routes (`bin/rails routes`) against API §11, and the rules against the code. Each doc change cites a test or file |
| A reviewer can't install Ruby 3.2.0 (end of life; OpenSSL 3 builds on newer macOS) | Medium / High | README troubleshooting notes; R1 recorded; note that Ruby needs OpenSSL 1.1/3 build flags if `rvm install` fails. The upgrade itself is out of scope |
| A reviewer lacks the owner's RVM gemset (`salary-mgn-3.2.0`) | High / Low | README uses a plain `rvm use 3.2.0` plus `bundle install`; the gemset stays an owner-local detail |
| Fresh MySQL setup unclear (user and grants) | Medium / Medium | P5 MySQL setup section with placeholder credentials |
| The 7.1 review becomes a refactor (scope creep) | Medium / Medium | P2 fix policy; report first |
| Frontend developers misread money or currency rules | Medium / High | P6 §13 client notes: money strings, per-currency totals only |
| Handoff commit includes stray root files or IDE settings | Medium / Low | P10 owner hygiene |
| Rails 8.0 support ends 2026-11-07 (R1) | Certain / Medium | Listed prominently in known limitations with the upgrade recommendation |

### 7.1 Code and scope review
**Prompt:** `Per P1, P2, and P4: review every non-generated file in backend/app, lib, config, db/migrate, and the routes against CLAUDE.md, .claude/rules/*, requirements, architecture, database design, and the API spec. Check correctness, security, currency handling, salary history, query behaviour, tests, and scope discipline. Report findings by severity with file:line and evidence before making nontrivial changes; fix Low and doc-only items directly; ask before fixing Critical or High.`
**Tasks:**
1. ~~Owner: approve P1–P13.~~ Approved 2026-09-29.
2. ~~Contract cross-check: routes against API §11; `.claude/rules/*` against the code.~~ Done 2026-09-29. The routes match API §11 (21 route/verb pairs, including 2 undocumented `PUT` aliases, F3). The backend rules check is below; the security and testing rules reuse the 6.3 checklist and the 6.1 matrix.
3. ~~File-by-file review.~~ Done 2026-09-29: all 78 non-generated files in `app/` (controllers, concerns, models, services, queries, exports, helpers, views), `config/` (application, environments, custom initializers, database, routes, brakeman.ignore), `db/migrate/`, and `lib/` (reference data, demo seeder, integrity check, rake tasks).
4. ~~Scope check.~~ Done 2026-09-29: no out-of-scope features (requirements §6) and no unused custom code. Generated G1/G3 files are exempt (P3).
5. ~~Findings table; apply Low and doc-only fixes; ask before Critical/High.~~ Done 2026-09-29: no Critical or High findings; 1 Medium (F1) awaits the owner; 1 Low fixed (F2); doc items passed to 7.2.
6. ~~Tests, RuboCop, Brakeman (code changed: F2).~~ Done 2026-09-29.

**Deliverables:** Review findings and resolutions.
**Acceptance:**
- No known Critical or High issue remains unresolved or unaccepted.
- Every deviation from the docs is either fixed or recorded for 7.2.
- Scope discipline is confirmed.

**Status:** Done (2026-09-29). No Critical or High findings. F1 (Medium) was fixed after owner approval (2026-09-29). `bin/rails test` 245 runs, 1,040 assertions, 0 failures on 5 seeds; RuboCop 130 files clean; Brakeman 0 warnings (2 ignored).

**Findings (7.1).**

| ID | Severity | Where | Finding and evidence | Resolution |
|---|---|---|---|---|
| F1 | **Medium** | `app/controllers/concerns/api/query_params.rb:17` (`page_param`, no maximum); `concerns/api/pagination.rb:13` | A very large `page` returns **`500 internal_error`** instead of a `400`. Once `(page − 1) × per_page` exceeds MySQL's unsigned 64-bit `OFFSET`, the SQL is invalid. A probe (throwaway test in the scratchpad, rescue enabled): `page=99999999999999999999` and `page=10^18` → `500` on `/employees` and `/reports/salaries`; `page=10^17` → `200`, empty. The envelope is generic, so no data leaks | **Fixed (owner approved 2026-09-29):** `Api::QueryParams::MAX_PAGE = 1_000_000`, so a larger `page` → `400`, `details.page` "must be at most 1000000". Tests: a `QueryParams` unit test (cap, 10^18, 10^20) and endpoint cases in `employees_test` and `salary_report_test`. Mutation check: without the cap, both endpoint tests error with the SQL failure. API §2.3 and the §14 changelog updated; the README limitation removed |
| F2 | Low | `lib/demo/integrity_check.rb:61` | `demo:verify` printed `employees_without_salary` (employees with no salary record at all, 95) under the same name as the analytics field (no salary in effect on `as_of`, 93) | **Fixed:** renamed the report key to `employees_without_salary_records`, with a comment. `test/lib` 17 runs pass; `demo:verify` output checked. The API field is unchanged |
| F3 | Low (doc) | `config/routes.rb` (`resources … only: %i[… update]`) | Rails also routes `PUT` to `update` for employees and salary records; API §11 lists only `PATCH`. `PUT` behaves identically, and the route-protection walk covers it (`401` and CSRF) | **7.2:** document "`PUT` is accepted as an alias of `PATCH`" in API §11 |
| F4 | Low (doc) | `concerns/api/authentication.rb:43–54` | Every authenticated request, including `GET /session`, refreshes the 30-minute idle timer, so a client polling `/session` keeps the session alive until the 8-hour absolute limit. This is intended behaviour but undocumented for clients | **7.2:** state it in API §13 client notes |
| F5 | Low (doc) | `config/environments/production.rb` (Solid Cache), `sessions_controller.rb:7` | In production the login `rate_limit` counts in Solid Cache, so the cache tables (`db/cache_schema.rb`) must exist in the production database (`db:prepare`); otherwise the limit fails | **7.2:** add it to the architecture §9 deployment prerequisites |
| F6 | Info | `app/services/salaries/change_service.rb:46` (`close_period` → `update!`) | If the previous record failed validation while being closed, `RecordInvalid` would surface as a `422` naming that record's fields. Unreachable through the API: I13 is enforced both ways, currencies are static, and periods are service-controlled | No change |
| F7 | Info | `db/schema.rb` (`index_employees_on_employment_status`) | Redundant with the `(employment_status, country_id)` composite from 6.2 | Kept (P4); listed as an optional clean-up in the known limitations (7.2) |
| F8 | Doc drift | `docs/architecture.md` §3; `docs/api-specification.md` §11; `docs/requirements.md` §11; doc headers | Stale code layout (`hr_user.rake`, missing `not_found_controller.rb`, `concerns/api/`, `lib/demo/`); reference-data phase 4.3 (should be 4.2); "Planned tests"; versions not bumped | **7.2** (P7) |

**Backend rules check (`.claude/rules/backend.md`).** Every rule passes:
- **Rails conventions, RESTful:** resources with singular analytics resources (M7); no custom actions.
- **Thin controllers:** they parse, call a service or query, and render.
- **ActiveRecord:** used throughout; raw SQL only for the median CTE and band counts, built from relations with bound values.
- **JSON builder:** jbuilder for every JSON response; the CSV goes through `SalaryReportCsv` (`app/exports`, 5.3).
- **Service objects:** for multi-step writes (`Employees::CreateService`, `Salaries::ChangeService`, `Salaries::CorrectionService`).
- **Query objects:** for analytics, reports, and search.
- **Transactions:** every salary write, with a row lock.
- **Constraints plus validations:** I1–I13 (design §5).
- **Pagination:** employee list and report.
- **Indexes:** justified per query (design §4, §13).
- **N+1:** tests for the employee list, report, and history.
- **Strong parameters and concerns:** `permit` allowlists; `Api::*` concerns shared across controllers.
- **Request and model tests:** 245 runs.
- **Dependencies:** all justified in ADR 005.

Currency safety (every aggregate grouped by `currency_code`; the 6.2 invariants) and salary-history invariants (services, DB guards, `demo:verify` 0 violations) are confirmed.

### 7.2 Backend setup and API documentation
**Prompt:** `Per P3 and P5–P13: update the root README (status, health, MySQL setup, updating a checkout, API overview, curl sign-in walkthrough, known limitations, troubleshooting, unused generated files), API spec v2.1 with §13 client integration notes and a changelog, doc headers and versions and stale details (architecture §3, API §11, requirements §11), CLAUDE.md Commands, and the plan's Future work. Verify with a clean clone (P9) and a final regression (P13). No frontend code.`
**Tasks:**
1. ~~Root `README.md` per P5 and P8 (and P3's list of unused generated files).~~ Done 2026-09-29. It now has:
   - a current status line and the real health endpoint;
   - MySQL user and grant setup (placeholders only) and `.env` from `.env.example`;
   - `db:prepare` plus `db:test:prepare`, and "Updating an existing checkout" (`db:migrate`);
   - "Using the API" (endpoint table, conventions, curl sign-in walkthrough);
   - test layout and count; troubleshooting;
   - known limitations (R1–R6, design limits, unused generated files; F1 was listed until it was fixed).
   The stale H3 and "arrives in task 2.2" lines are gone. All relative links resolve.
2. ~~API spec v2.1: §13 client integration notes and changelog (P6); fix §11 phases.~~ Done 2026-09-29. §11: reference data is phase 4.2, and the `PUT` alias is documented (F3). New §13: hosting and cookies, sign-in and CSRF (new token after sign-in), session lifetime (F4 keep-alive), errors, lists, money/currency/dates, CSV. New §14 changelog.
3. ~~Doc headers, versions, and changelogs (P7); architecture §3; requirements §11.~~ Done 2026-09-29:
   - requirements v1.2 (§11 names the implemented endpoints and actual test files, with corrected phases; §12 changelog);
   - architecture v2.3 (§3 matches the real tree: `hr.rake`/`demo.rake`, `not_found_controller.rb`, `concerns/api/`, `helpers/api/formatting_helper.rb` instead of a `_money` partial, `lib/demo/`; §9 adds the Solid Cache prerequisite (F5); §11 changelog);
   - database design v2.2 (§14 changelog);
   - API spec v2.1.
4. ~~`CLAUDE.md` Commands (P11); plan "Future work" (P12).~~ Done 2026-09-29.
5. ~~Clean-clone verification (P9).~~ Done 2026-09-29; see the status.
6. ~~Final regression (P13); close the Phase 7 gate; owner hygiene reminder (P10).~~ Done 2026-09-29.

**Deliverables:** Backend setup guide and handoff-ready API documentation.
**Acceptance:**
- A reviewer can follow the README to set up, load synthetic data, run the tests and the server, and sign in with curl (proved by the clean clone and the walkthrough).
- The API spec lets a frontend developer integrate without reading backend code.
- The known limitations are complete.
- The final regression passes.

**Status:** Done (2026-09-29).
- **Clean clone (P9):**
  - `git clone` of `HEAD` (`707ff61`) into Claude's scratchpad; `backend/.env` copied without being read;
  - Ruby 3.2.0; `bundle check` satisfied; `bin/rails db:test:prepare`; `bin/rails test` → 245 runs, 1,040 assertions, 0 failures;
  - `bin/rails server` on :3112: health `200` `{"data":{"status":"ok","database":"ok"}}`, `GET /employees` signed out `401`;
  - server stopped, clone deleted, port free. Existing databases only; no database or user created.
- **Final regression (P13), on the working tree including the 7.1 and 7.2 edits:**
  - `bin/rails test` ×5 seeds: 245 runs, 1,040 assertions, 0 failures;
  - RuboCop 130 files clean; Brakeman 0 warnings (2 ignored);
  - live on :3113: health `200`; `/employees`, `/analytics/summary`, and `/reports/salaries.csv` signed out `401` JSON; an unknown path `404` JSON; server stopped.

Notes:
- **F1 (Medium) fixed after 7.2** on owner approval (2026-09-29); see the 7.1 findings and the completion log.
- The curl walkthrough wasn't run with the HR credentials (Claude doesn't have them). It follows the sign-in and CSRF sequence verified by `sessions_test.rb`, `route_protection_test.rb`, and the 6.2 HTTP script (the same `GET /session` → `POST /session` → cookie jar steps).
- **P10 (owner):** before the handoff commit, unstage the 30 root-level `AD` entries (`git restore --staged Gemfile Gemfile.lock Gemfile.lock.bck app config db test`) and stop tracking `.idea/` (`git rm -r --cached .idea`, plus `.idea/` in the root `.gitignore`).

**Phase 7 gate: passed on 2026-09-29.** The backend is independently runnable (clean clone), tested (245 runs, 5 seeds), documented (README, API spec v2.1 with client notes, updated design docs), and ready for a separately planned frontend phase ("Future work"). Open item: P10 (owner git hygiene). F1 fixed 2026-09-29.

**Phase gate:** Backend is independently runnable, tested, documented, and ready for a separately planned frontend phase.

---

## Cross-phase rules
- Keep this plan limited to Rails backend, persistence, and REST API work.
- Do not implement frontend screens or frontend tooling in these phases.
- Prefer a modular monolith; add complexity only when justified.
- Do not implement excluded features without an approved scope change.
- Keep salary amount and currency together; never add unlike currencies into one total.
- Preserve effective-dated salary history.
- Use synthetic data for development and demos.
- Add background jobs or Redis/Sidekiq only when a concrete backend need is established.
- Never mark a subphase Done unless acceptance criteria are checked and tests reported as run have actually executed.

## Completion log

| Date | Phase/subphase | Summary | Tests/verification | Decisions/follow-up |
|---|---|---|---|---|
| 2026-09-28 | 1 (review) | Reviewed all requirements/design docs; recorded conflicts C1–C7, decisions D1–D27, assumptions, dependencies, risks; expanded Phase 1 into tasks 1.1–1.5 | Documentation review only; no code or tests | Awaiting sign-off on D1–D27 and §F phase changes |
| 2026-09-28 | 1.1 (decisions) | D1 MySql confirmed (docx corrected); D4 salary create+update approved and API spec §4 updated; auth moved to 4.1 (C7) | Documentation only; docx checked for MySql | D2, D3 and D5–D27 still open |
| 2026-09-28 | 1.1 (decisions) | D2 BACKEND_PLAN.md governs backend; PROJECT_DEV_PLAN.md backend phases marked superseded. D3 amount = monthly; recorded in requirements, database design, and API spec | Documentation only | Confirm gross-base interpretation of D3; D5–D27 open |
| 2026-09-28 | 1.1 | D5–D27 approved as proposed; C1–C7 all resolved; `docs/requirements.md` v1.1 adds approved decisions (§10) and backend traceability (§11); 5.3 export made unconditional | Documentation review only; no code or tests | Next: 1.2 architecture. §F D19 JSON report endpoint to be applied in 1.5 |
| 2026-09-28 | 1.2 | Rewrote `docs/architecture.md` v2.0: modules and data ownership, code layout, login/salary-change/analytics/export flows, auth boundary, error contract, log redaction, time and money conventions, deployment trade-offs. Added ADR 004 (session-cookie auth) and ADR 005 (Ruby 3.1.2 / Rails 7.2; gems limited to bcrypt, rspec-rails, factory_bot_rails, faker) | Documentation review only; no code or tests | 1.3 must add the `users` table; Ruby 3.1 end-of-life accepted as an assessment-only risk |
| 2026-09-28 | 1.3 | Rewrote `docs/database-design.md` v2.0: column-level schema for 6 tables incl. `users`; index list with the query each serves; integrity rules I1–I13 mapped to DB/model/service; transactions and locking; SQL shapes for current salary, summary, median, distribution, breakdown, report, search; reference data; deterministic 10k seed plan. ADR 002 and 003 accepted with details | Documentation only. SQL not executed: the local MySQL root login needs credentials, so the generated-column and median SQL will be verified by migrations and specs in Phase 3 and 5.1 | Review I13 (salary start not before `hired_on`) and O1 (allow correcting future-dated records) |
| 2026-09-28 | 1.3 (approvals) | I13 and O1 approved; recorded in database design §5/§6/§11, ADR 003, requirements §10, and architecture §4.2 | Documentation only | — |
| 2026-09-28 | 1.4 | Rewrote `docs/api-specification.md` v2.0 (22 operations): conventions; error, pagination and sort shapes; health; session; reference data; employees (list without salary or email, detail with current salary, transactional create with `initial_salary`); salary records (status current/scheduled/historical, change, correction per D4+O1); analytics summary, distribution and breakdown with metric definitions; JSON report and CSV export (shared filters, allowlisted columns, formula guard, `422 export_too_large` instead of truncation); status catalogue; endpoint→phase map; request-spec expectations. Architecture error table updated to match | Documentation only; example numbers cross-checked by hand | New contract choices listed for review: invalid filter values return `400` rather than a default; CSV over the cap returns `422`; report `sort=amount` groups rows by currency first |
| 2026-09-28 | 1.5 | Cross-checked all Phase 1 documents (checklist under 1.5). Fixed: plan 2.2, 3.1, 4.1, 4.3, 4.4, 5.2, 5.3 and D4/D18/D24 wording; requirements §10 export cap and email; DB design §4, §5 (I13 both ways), §7.1, §7.5; API §6.4; ADR 001 accepted. §F fully applied | Documentation cross-check only; no code or tests | Phase 1 gate passed. Derived rule for review: an employee `PATCH` that moves `hired_on` after the first salary start is rejected (I13 enforced both ways) |
| 2026-09-28 | 1.1 (re-validation) | Re-checked 1.1 acceptance against the current docs; all criteria still met. Brought requirements §11 in line with O1, I13 (both directions), email exclusion, and `422 export_too_large`; fixed stale wording in C2 and 1.1 task 2 | Documentation cross-check only; no code or tests | None |
| 2026-09-28 | 2 (review) | Reviewed Phase 1 docs, repository state, and toolchain for Phase 2. Recorded current state, decisions E1–E15, assumptions, dependencies, and risks. Expanded 2.1–2.3 into concrete tasks with verifiable acceptance criteria | Read-only checks: Ruby 3.1.2 (RVM), Rails 7.2.3.1 and mysql2 0.5.7 installed, Homebrew MySQL 8.4 listening on 3306, Docker daemon not running. No code written | Awaiting E1–E15; owner to commit Phase 1 docs (E15) and create the `salary_app` DB user (E2) |
| 2026-09-28 | 2 (scaffold sync) | Owner generated `backend/` (Rails 8.0.5.1, Ruby 3.2.0, full-stack default, jbuilder, pagy, dotenv-rails, Solid Cache/Queue/Cable, Kamal) and committed it. Updated ADR 005 (versions and gems), ADR 004 (rate-limit store), architecture v2.1 (jbuilder views, pagy, Solid Cache/Queue, versions), database design (collation, database names, Solid tables), D25/D26, and rewrote the Phase 2 findings and tasks. Recorded owner decisions and new decisions G1–G9 | Read-only inspection of `backend/` (Gemfile, lockfile, database.yml, routes, config, tracked files). `.env` values not read. No code changed, no commands run in the app | Owner to decide G1 (API-only), G2 (RSpec), G3–G5, G6 (Ruby version), G7 (`/up`), G8 (`.env.example`) |
| 2026-09-28 | 2.2 / 2.3 (G2, G3) | Owner chose G2 and G3; everything else kept as generated. G2: removed `capybara`, `selenium-webdriver`, and `backend/test/`; added `rspec-rails` and ran `rails generate rspec:install`. G3: removed `solid_cable`, `db/cable_schema.rb`, and the `cable` roles in `database.yml`; production `cable.yml` now uses `async`. Updated ADR 005 and the database-design header | Under Ruby 3.2.0 (RVM): `bundle install` completed (rspec-rails 8.0.4; solid_cable, capybara, selenium gone from the lockfile); `bundle exec rspec` → 0 examples, 0 failures; `bin/rails runner` boots Rails 8.0.5.1 with cable adapter `async`; `bin/rubocop` reports 2 pre-existing Gemfile offences (not changed) | Deletions left unstaged for the owner to commit. `backend/.github/workflows/ci.yml` still calls `bin/rails test test:system` (inert) |
| 2026-09-28 | 2.3 (G2 revert) | Owner reverted G2: restored `backend/test/` from git; restored `capybara` and `selenium-webdriver`; removed `rspec-rails`, `.rspec`, and `spec/`. G3 changes kept. ADR 005 and task 2.3 updated for Minitest | Ruby 3.2.0: `bundle install` completed (lockfile has capybara and selenium, no rspec-rails); Gemfile differs from HEAD only by the G3 solid_cable removal; `bin/rails test` → 0 runs, 0 assertions, 0 failures | CLAUDE.md, `.claude/rules/testing.md`, and the testing and rails-backend skills still say RSpec (owner to update); `docs/requirements.md` §11 and API spec §12 use RSpec wording |
| 2026-09-28 | 2 (docs sync: Minitest) | Aligned Markdown with the codebase's Minitest setup: CLAUDE.md (backend tests), `.claude/rules/testing.md` (paths `backend/test/**/*.rb`), testing skill (Minitest layers; MySQL instead of PostgreSQL; BACKEND_PLAN.md instead of PROJECT_DEV_PLAN.md), rails-backend skill, requirements §5 and §11, API spec §12 heading, architecture, database design, ADR 004, and Phases 3–6 of this plan ("specs" → "tests") | grep for RSpec/spec references afterwards (see summary). Completion-log history and superseded PROJECT_DEV_PLAN.md left unchanged on purpose | — |
| 2026-09-28 | 2 (re-review) | Re-reviewed Phase 2 against the current codebase (Minitest, G3 applied) and docs. Updated current-state rows (Env, Tests, Git, E14). Added findings H1–H8 (API base controller in a full-stack app, `DB_USER`/`DB_USERNAME` mismatch, Solid roles sharing the dev/test database, parallel Minitest databases, `minitest/mock` availability, `db:prepare` not run, uncommitted ADRs and G3, test rate-limit store). Revised 2.1–2.3 tasks | Read-only inspection: controllers, routes, `application.rb`, `filter_parameter_logging.rb`, environment cache stores, `.gitignore`, `.env.example` variable names (values not read), `test_helper.rb`, lockfile `minitest` version, `db/` | Owner: decide H1 and H3; fix H2; commit H7 |
| 2026-09-28 | 2 (H decisions) | Owner approved H1 (API base controller on `ActionController::Base`, JSON-only, no `allow_browser`) and H3 (development and test use only the `primary` database role). H2 was already fixed by the owner | Read `backend/.env.example`: variable names `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` match `database.yml`. No file changed except this plan | Apply H3 in `database.yml` and the H1 doc alignment when instructed |
| 2026-09-28 | 2.2 (H1 docs) | Aligned docs with H1: architecture v2.2 (G1 banner now records the full-stack app with a JSON-only API; code layout adds `base_controller` on `ActionController::Base` and `health_controller` on `ActionController::API`; §5 adds a controller-base bullet, drops "added back to the API-only middleware stack", and the default-deny rule no longer lists `/health` as an opt-out). ADR 004: session decision, default-deny rule, and consequences updated | Documentation only; grep confirms no remaining "API-only middleware" wording | H3 `database.yml` edit still pending instruction |
| 2026-09-28 | 2.1 | Added root `.gitignore` (`.DS_Store`, `.env`); rewrote root `README.md` (overview, layout, prerequisites, `.env` variables, setup, run, test, docs links, out of scope); replaced the generated `backend/README.md` with a pointer; added a "Current Plan" section to `CLAUDE.md`. Corrected the 2.1 deliverable wording for G8 | `git check-ignore`: `backend/.env`, `backend/config/master.key`, `backend/log/x.log`, `.DS_Store`, `docs/.DS_Store` ignored; README not ignored. `.env.example` names equal `database.yml` `DB_*` names. No `.env` or `master.key` tracked; no hard-coded credential patterns found (`database.yml` `root` fallbacks are inside `ENV.fetch`, G5 kept). All README links resolve. `bundle check` satisfied; `bin/rails test` → 0 runs, 0 failures (Ruby 3.2.0). `db:prepare` not run | Owner: commit; decide when to apply H3 (2.2) |
| 2026-09-28 | 2.2 | H3 (primary-only dev/test DB roles), E8 (UTC, filter params), `DatabaseHealth.up?`, `Api::V1::HealthController < ActionController::API` with jbuilder view, `GET /api/v1/health` route. Found that json 3.0.2 breaks ActiveSupport 8.0 JSON encoding (`unknown keyword: quirks_mode`); the lockfile now resolves json 2.6.3 with `json (< 3)`, while the Gemfile line was reverted. Marked Done by owner | `rails runner`: `time_zone=UTC`; 7 sensitive keys filtered, `currency_code` not; configs dev=`primary`, test=`primary`, prod=`primary,queue,cache`; `DatabaseHealth.up?` = true. `rails routes`: `/api/v1/health` → `api/v1/health#show` (json), `/up` kept. HTTP on the owner's server (:3000): `{"data":{"status":"ok","database":"ok"}}`, 200, `application/json`. Claude's own servers (:3101/:3102) hit the json 3.0.2 error before the lockfile change; 503 not verified over HTTP | Restore `gem "json", "< 3"` in Gemfile + ADR 005 note; update README health line; owner commits |
| 2026-09-28 | 2.3 | Added `test/integration/api/v1/health_test.rb` (200 body, 503 body via `DatabaseHealth.up?` swap, no extra keys). README "Testing and quality" expanded (single-file/single-test commands, test DB, parallel-worker DBs, test layout). `CLAUDE.md` gains a "Commands" section | Ran under the owner's gemset `ruby-3.2.0@salary-mgn-3.2.0` (json 2.21.2; the default gemset lacks it). Test DB `salary_management_test` reachable. `bin/rails test`: 3 runs, 6 assertions, **1 failure** (503 test → 200, commented `render` line). `bin/rubocop`: 28 files, **4 offences**, none in the new test. `bin/brakeman`: 0 errors, **2 warnings** (Ruby 3.2.0 EOL, Rails 8.0.5.1 support end) | Owner: restore the `render … status:` line (or confirm always-200); approve RuboCop fixes; accept or act on the Brakeman support warnings |
| 2026-09-28 | 2.3 (render restored) | Owner approved restoring `render :show, status: @database_up ? :ok : :service_unavailable` in `HealthController` | `bin/rails test`: 3 runs, 7 assertions, 0 failures. `bin/rubocop`: 28 files, 3 offences (Gemfile ×2, jbuilder final newline) | Remaining for 2.3: owner OK for RuboCop fixes; decision on Brakeman support warnings |
| 2026-09-28 | 2.3 (close) | Owner approved RuboCop fixes and accepted Brakeman support warnings. `bin/rubocop -a` on `Gemfile` (`# gem "sqlite3"` comment spacing, `"dotenv-rails"` quotes) and `show.json.jbuilder` (final newline). Added `config/brakeman.ignore` with notes for the EOL Ruby and Rails warnings. ADR 005 records the accepted warnings and the `json < 3` constraint. 2.3 Done; Phase 2 gate passed | Gemset `ruby-3.2.0@salary-mgn-3.2.0`: `bin/rails test` exit 0 (3 runs, 7 assertions, 0 failures); `bin/rubocop` exit 0 (28 files, no offences); `bin/brakeman --no-pager` exit 0 (0 security warnings, 2 ignored, 0 errors); `bundle check` satisfied after the Gemfile edits | Owner: commit; fix the README health line (2.2 follow-up d) when convenient |
| 2026-09-28 | 3 (review) | Reviewed Phase 3 against the database design, ADRs 002/003/005, requirements, API spec, and the Phase 2 outcome. Recorded decisions J1–J14, assumptions, dependencies, and risks. Rewrote 3.1–3.3 with concrete tasks and acceptance criteria: salary services move into 3.2 (J7); seeds split into reference and development-only demo data (J6) | Read-only: dev and test databases are `utf8mb4_unicode_ci` on MySQL 8.4.10 with no domain tables; no `db/migrate`; no factory_bot or faker. No code written | Owner: decide J1 (factory_bot and faker, plus fixtures for reference data) and J2 (may Claude run `db:migrate` and `db:test:prepare`?); approve J3–J14 |
| 2026-09-28 | 3 (J decisions) | Owner approved J1 (factory_bot_rails and faker; fixtures for reference data, factories for employees and salaries) and J2 (Claude may run `db:migrate` and `db:test:prepare`) | Plan update only | J3–J14 defaults not yet explicitly confirmed |
| 2026-09-28 | 3.1 | Added factory_bot_rails (test) and faker (dev/test). Migrations for countries, departments, currencies (string PK `code`), employees (FKs, CHECK on status, indexes). Models with normalisation, enum, validations, restrict-delete. Reference fixtures (8 countries, 8 departments, 7 currencies), employee factory, 34 model tests. Database design §3 types updated to VARCHAR (J3) and §9 now uses `insert_all!`; ADR 005 lists the new gems | `bundle install` added only factory_bot 6.6.0, factory_bot_rails 6.5.1, faker 3.8.0. `db:migrate` (dev), `db:test:prepare` (test tables and 2 CHECK constraints present), `db:migrate:redo STEP=4` (schema.rb identical). `bin/rails test`: 37 runs, 79 assertions, 0 failures (3 initial failures fixed: MySQL `insert_all` skips duplicates, switched tests to `insert_all!`). `bin/rubocop`: 41 files, no offences. `bin/brakeman`: 0 warnings, 2 ignored | Owner: confirm the J3/J4/J5/J14 defaults; commit |
| 2026-09-28 | 3 (J decisions) | Owner approved J3 (VARCHAR codes), J4 (string-backed status enum), J5 (normalisation), and J14 (restrict-delete), all already implemented in 3.1 | Plan update only | J6–J13 (mostly 3.2 and 3.3) not yet explicitly confirmed |
| 2026-09-28 | 3 (J decisions) | Owner approved J6–J13: seed split (J6), salary services in 3.2 (J7), read-only columns (J8), scale vs `minor_units` (J9), I13 both directions in 3.2 (J10), direct DB-guard tests (J11), `travel_to` in date tests (J12), `schema.rb` with round-trip checks (J13). All Phase 3 decisions are now resolved | Plan update only | — |
| 2026-09-28 | 3.2 | Migration `salary_records` (DECIMAL(18,4), stored virtual `open_flag`, unique `(employee_id, effective_from)` and `(employee_id, open_flag)`, FKs to employees and `currencies.code`, CHECKs amount > 0 and period order). `SalaryRecord` (I4–I7, I10, I13 validations, raw-input scale check J9, `attr_readonly` J8, `in_effect_on`, `status_on`, `editable?`). `Employee` `has_many :salary_records` (restrict), `current_salary`, I13 employee side (J10); `Currency` `has_many :salary_records` (restrict). Services: `Salaries::ChangeService`, `Salaries::CorrectionService`, `Employees::CreateService` (savepoint transactions, employee row lock). Salary factory; 38 new model and service tests | `db:migrate`; `SHOW INDEX` lists exactly PK plus the 3 planned indexes; `db:test:prepare`; serial `bin/rails test` ×3 seeds: 75 runs, 190 assertions, 0 failures; RuboCop 51 files clean; Brakeman 0 warnings; `db:migrate:redo STEP=1` leaves schema.rb identical. **Parallel `bin/rails test` hangs** (Rails 8.0.5.1 vs minitest 6.0.6) | Owner: decide K1; then re-run `bin/rails test` and close 3.2 |
| 2026-09-28 | 3.2 (K1, close) | Owner chose K1 option 3: `parallelize(workers: 1)` in `test/test_helper.rb`. README testing and setup notes updated (no per-worker databases). 3.2 marked Done | Plain `bin/rails test`: 75 runs, 190 assertions, 0 failures in about 1 s; RuboCop on `test_helper.rb` clean | Revisit parallel tests after a Rails 8.1 upgrade |
| 2026-09-28 | 3.3 | `lib/reference_data.rb` (single source for design §8; idempotent `seed!`); `db/seeds.rb` calls it; `lib/demo/seeder.rb` (deterministic 10k generator, seed 42, fixed as-of 2026-09-28, `insert_all!` batches, one transaction); `lib/demo/integrity_check.rb` (6 SQL checks and a summary); `lib/tasks/demo.rake` (`demo:seed`, `demo:reset` development only; `demo:verify` read-only); 14 tests in `test/lib/`. Database design §9 rewritten with actual counts; new §12 integrity checklist I1–I13; README "Sample data" section. Phase 3 gate passed | Dev DB: `db:seed` ×2 identical checksums; `demo:seed` 10,000 employees, 16,826 records, 1.5 s, 0 violations; refuses when employees exist; `demo:reset` same fingerprint (432578cbe2b388cf); `demo:verify` clean; production refusal for seed and reset. `bin/rails test` 89 runs, 224 assertions, 0 failures; RuboCop 59 files clean; Brakeman 0 warnings | I12 "no destroy routes" to verify in Phase 4. The development DB now holds demo data |
| 2026-09-28 | 4 (review) | Reviewed Phase 4 against API spec v2.0, architecture v2.2, ADR 004, database design, requirements, and the Phase 3 codebase. Recorded decisions L1–L18, assumptions, dependencies, and risks. Re-scoped the subphases (L1): 4.1 base controller, errors, and auth; 4.2 list conventions and reference endpoints; 4.3 employees; 4.4 salaries | Read-only: no session_store or wrap_parameters initializers; test env disables forgery protection and uses null_store; bcrypt not installed; no users table; Pagy 43.4.4 does not raise past the last page (source checked) | Owner: approve L1–L18 and the bcrypt install (L3); set `HR_USER_*` in `.env` when 4.1 lands |
| 2026-09-28 | 4 (L decisions) | Owner approved L1–L18, including the subphase re-scope (L1), a hand-rolled login (L2), and the `bcrypt` install (L3) | Plan update only | Owner: set `HR_USER_EMAIL` / `HR_USER_PASSWORD` in `backend/.env` before manual login |
| 2026-09-28 | 4.1 | `bcrypt` 3.1.22 installed (L3). `users` migration and `User` (normalised unique email, `has_secure_password`, ≥ 12 characters); `hr:create_user` task (L4). Initializers: `session_store.rb` (L6), `json_encoding.rb` (time precision 0, L14); test env memory cache (L8); `config.x.api_rescue_unexpected_errors` (L11). `Api::ErrorHandling` and `Api::Authentication` concerns; `Api::V1::BaseController` (< ActionController::Base, JSON-only, `wrap_parameters false`, forgery protection); `SessionsController` (`authenticate_by`, `reset_session`, `rate_limit` 5/min); `NotFoundController` catch-all (L10); shared jbuilder error template. 26 new tests (User, sessions incl. expiry, rate limit, cookie flags, log redaction, CSRF; errors incl. catch-all, malformed JSON, 500; HR task). README (HR login, env vars), `.env.example`, ADR 005 updated | `bundle install` added only bcrypt; `db:migrate` and `db:test:prepare`; `bin/rails test` 115 runs, 317 assertions, 0 failures (×2); RuboCop 76 files clean; Brakeman 0 warnings; live smoke on :3104 as recorded under 4.1 | Owner: add `HR_USER_EMAIL` / `HR_USER_PASSWORD` to `backend/.env`, run `bin/rails hr:create_user`, restart the dev server (new initializers) |
| 2026-09-28 | 4.2 | `Api::BadRequest`; `Api::QueryParams` (page, per_page 1–100, sort allowlist, enum, existing IDs, string length, ISO dates, single values; L12); `Api::Pagination` (Pagy 43 `pagy(:offset, …)` with validated limit and page, own meta with `total_pages` = ceil, L13), included in `BaseController`; `_pagination_meta` partial; `Api::FormattingHelper#money` (BigDecimal half-up, L14); `ErrorHandling` maps `BadRequest` and `ParameterMissing` to `400` with `details`. `GET /countries` (by name), `/departments` (by name), `/currencies` (by code), sign-in required. 24 new tests (QueryParams, Pagination and meta partial, money, reference endpoints); 4.1 `500` tests rewritten without `with_routing` | `bin/rails test` ×6 seeds: 139 runs, 431 assertions, 0 failures; RuboCop 91 files clean; Brakeman 0 warnings; live smoke on :3105 (401 ×3, 404 on `POST`) | Pagination's first real consumer is the employee list (4.3) |
| 2026-09-28 | 4.3 | `EmployeeSearchQuery` (filters, escaped contains `q`, allowlisted sort with `id` tie-break, `includes`). `EmployeesController` (`index` paginated, `show`, `create` via `CreateService`, `update`; `details` keys renamed to request fields); jbuilder summary and detail views (no email or salary in the list; `current_salary` with `money()`); `resources :employees` without destroy. `Employee` validates an unparseable `hired_on`. Fixed `CreateService` error import (see 4.3 notes). 25 integration tests. API spec §6.3 and database design §12 (I12) updated | `bin/rails test` ×5 seeds: 164 runs, 560 assertions, 0 failures; RuboCop 97 files clean; Brakeman 0 warnings; live smoke on :3106; 10k-row query timings 9–32 ms | I12 salary-record route to verify in 4.4 |
| 2026-09-29 | 4.4 | `SalaryRecordsController` nested under employees (`index` newest first, `show`, `create` via `ChangeService`, `update` via `CorrectionService`; scoped lookups; L16 error mapping incl. `salary_record_not_editable`); `_salary_record` partial (money, status, editable); routes without destroy. 19 integration tests (auth, no DELETE, unknown employee, history order and status, change closing periods, scheduled, 422 cases, currency scale, wrapper, ignored fields, corrections, historical 422, immutable dates, cross-employee 404, log redaction at info, production log level). Database design §12 I12 closed; architecture §7 log note. Phase 4 gate passed | `bin/rails test` ×5 seeds: 183 runs, 650 assertions, 0 failures; RuboCop 102 files clean; Brakeman 0 warnings; live smoke on :3107 (401, 401, 404) | Owner: decide the log follow-up (keep `RAILS_LOG_LEVEL=info`; optionally `prepared_statements: true`) |
| 2026-09-29 | 5 (review) | Reviewed Phase 5 against requirements, API spec §8–§9, database design §7, architecture, ADRs, and the Phase 4 code. Recorded decisions M1–M18, assumptions, dependencies, and risks. Expanded 5.1–5.3 into concrete tasks. Key gaps found: `BaseController` forces JSON (so `.csv` would not work); the planned batched CSV (`find_each`) can't keep the report order; the distribution bucket formula can misplace edge values; a past `as_of` interacts with current-only attributes | Read-only inspection of concerns, controllers, models, queries, views, routes, `test_helper.rb`, `Gemfile.lock` (no `csv` entry; stdlib on 3.2), and the git index. No code written; no tests run | Owner: approve M1–M18; unstage the 31 root-level `AD` entries in the git index before committing |
| 2026-09-29 | 5.1 | `app/queries/analytics/`: `Population` (shared filters, default `active`+`on_leave`, in-effect salary join, M2 `hired_on` rule), `Median` (window-function CTE, D21), `SummaryQuery`, `DistributionQuery` (exact comparison banding, empty bands, a single band when min = max), `BreakdownQuery` (fixed `by` column map, dimension and currency). 22 known-data tests in `test/queries/analytics/` plus a shared helper | `bin/rails test` ×5 seeds: 205 runs, 704 assertions, 0 failures; RuboCop 112 files clean; Brakeman 0 warnings; read-only timing and `EXPLAIN` on the 10k dev data (41–70 ms uncached) | Treated the request to implement 5.1 as approval of M1–M6, M17, M18. Owner: confirm M7–M16 before 5.2; API spec §8.2/§8.3 and design §7.3 wording (M2, M4) in 5.2 |
| 2026-09-29 | 5.2 | `Api::AnalyticsFilters` concern (validated filters, `no_store`); `Analytics::Population#filters` echo; `Employee.matching(q)` scope extracted from `EmployeeSearchQuery` (M10); `SalaryReportQuery` (M9 sorts, preloads); `Api::V1::Analytics::{Summaries,Distributions,Breakdowns}Controller` and `Api::V1::Reports::SalariesController` with jbuilder views; routes under `analytics` and `reports`. 17 integration tests. API spec §8/§9, architecture §3, and database design §7.3 updated | `bin/rails test` ×5 seeds: 222 runs, 829 assertions, 0 failures; RuboCop 124 files clean; Brakeman 0 warnings; live smoke on :3108 (4 × `401` JSON) | Applied M7–M13 defaults; M11 meta written inline. Owner: confirm M14–M16 before 5.3 |
| 2026-09-29 | 5.3 | CSV export on `GET /reports/salaries.csv`: `BaseController.allow_csv` (M14); report route constrained to `json|csv`; `SalaryReportCsv` in `app/exports/` (one query with `LIMIT cap + 1`, column allowlist, `money()` amounts, formula guard, UTF-8 BOM; M15, M16); controller `send_data` with the `as_of` filename, or `422 export_too_large`. 8 integration tests. Architecture §3/§4.4/§9, design §7.5, API spec §9.2, ADR 005 updated. Phase 5 gate passed | `bin/rails test` ×5 seeds: 230 runs, 886 assertions, 0 failures; RuboCop 126 files clean; Brakeman 0 warnings; live smoke on :3109 (`.csv` 401 JSON, `.xml` 404 JSON); dev-data export of 9,336 rows in about 300 ms | Applied M14–M16 defaults. Carried over to Phase 6: 10k timings from 5.1 and 5.3 (for 6.2); log-level decision (4.4); README health line (2.2); unstage the root-level `AD` entries in the git index |
| 2026-09-29 | 6 (review) | Reviewed Phase 6 against the requirements NFRs and traceability, API spec §10/§12, architecture §5–§9, database design §4/§6/§12, ADRs 004–005, and the Phase 5 codebase and suite. Recorded decisions N1–N16, assumptions, dependencies, and risks. Expanded 6.1–6.3 into concrete tasks. Key findings: `RecordNotUnique` is unmapped (a race gives `500`, contrary to design §6); `q` search terms are logged in clear text at `info`; no route-walking 401/CSRF tests; no salary-history N+1 test; no dependency audit; `config.hosts` unset in production; Rails 8.0 support ends 2026-11-07 | Read-only: test inventory (230 runs, 31 files); grep of `app/` for constraint-error handling; production config; `filter_parameters` via runner; the Rails request-log source (`filtered_path`); dev DB counts (10,000 / 16,826 / 1 user). No code written; no tests run | Owner: approve N1–N16; choose an N9 option; approve the N14 network audit; unstage the root-level `AD` entries |
| 2026-09-29 | 6 (N decisions) | Owner approved N1–N13, N15, and N16 as recommended (N9 option b: a temporary dev user); declined N14 (no dependency audit) | Plan update only | Missing dependency scan recorded as an accepted risk for Phase 7 known limitations |
| 2026-09-29 | 6.1 | Requirement → test matrix (under 6.1). New `test/integration/api/v1/route_protection_test.rb` (default-deny walk over 21 route/verb pairs, CSRF walk over 8 state-changing routes, coverage guard). N5 fix: `Api::ErrorHandling` maps `RecordNotUnique` → `422 validation_failed` (known-index `details`, value never echoed), with create and update race tests. New tests: salary-history N+1, duplicate email via the API, generic `404` body. `count_queries` moved to `test_helper.rb`. Design §6, API spec §10, architecture §6 updated | `bin/rails test` ×5 seeds: 238 runs, 995 assertions, 0 failures; RuboCop 127 files clean; Brakeman 0 warnings; N5 mutation check (tests fail without the rescue) | Remaining gaps are assigned: `q` log filter and `Secure` cookie test → 6.3; 10k measurements → 6.2; no real concurrency tests (N6, accepted) |
| 2026-09-29 | 6.2 | Measured 28 query-layer scenarios with `EXPLAIN ANALYZE` and 15 HTTP endpoints (temporary dev user, deleted) on the 10k demo data. Trial-migrated the 4 design §4 index candidates; kept `employees(hired_on)`, `(created_at)`, and `(employment_status, country_id)` per N11 (2.6–3.0× gains); dropped `(effective_from, effective_to)` (no gain). Migration `20260929100001_add_measured_indexes.rb`. N13 invariants: 33 checks over 3 populations, all holding. Database design v2.1: §4 indexes, new §13 measurements | `demo:verify` clean; `db:migrate`, `db:migrate:redo STEP=1` (`schema.rb` identical), `db:test:prepare`; `bin/rails test` ×5 seeds: 238 runs, 995 assertions, 0 failures; RuboCop 128 files clean; Brakeman 0 warnings; `User.count` 1 → 2 → 1 | Owner options: drop the now-redundant single `employment_status` index; the CSV is the only scenario over 100 ms (Ruby formatting, accepted) |
| 2026-09-29 | 6.3 | N7: `/\Aq\z/` added to `filter_parameters`; new `log_redaction_test.rb` (employee create; `q` on the employee list, report, and CSV at `info`). N15: new `test/config/security_config_test.rb` (production `Secure` cookie via the re-evaluated initializer, `force_ssl`/`assume_ssl`/`info`, exact `q` filter, redacted `inspect`); `config.hosts` and never-`debug` documented as deployment prerequisites (architecture §7, §9); 4.4 log follow-up closed. Security checklist and accepted risks R1–R6 recorded under 6.3. Phase 6 gate passed | `bin/rails test` ×5 seeds: 245 runs, 1,040 assertions, 0 failures; RuboCop 130 files clean; Brakeman 0 warnings; N7 mutation check; live smoke on :3111 (health 200, 401 ×12, 404 ×3; server stopped); secrets check (nothing tracked) | Accepted risks R1–R6 go to Phase 7 known limitations; N14 declined |
| 2026-09-29 | 7 (review) | Reviewed Phase 7 against requirements (§8 acceptance, §11 traceability), architecture v2.2, database design v2.1, API spec v2.0, ADRs, READMEs, CLAUDE.md, `.env.example` (names only), and the codebase after commit `707ff61`. Recorded decisions P1–P13, assumptions, dependencies, and risks. Expanded 7.1–7.2 into concrete tasks. Key findings: stale README (Phase 2 status, health line, H3 note, no `db:migrate`, MySQL, API overview, or known-limitations sections); architecture §3 names `hr_user.rake`; API §11 reference-data phase 4.3 (should be 4.2); doc versions not bumped since Phases 4–6; no client integration notes for the frontend; 30 root-level `AD` entries still staged; `.idea/` tracked; no out-of-scope code | Read-only: doc headers and grep for stale markers; `git log`/`git status`; `git ls-files` (IDE files); scope grep over `app/`, `lib/`, and routes; `lib/tasks` listing. No code written; no tests run | Owner: approve P1–P13; P10 git hygiene |
| 2026-09-29 | 7 (P decisions) | Owner approved P1–P13 as recommended | Plan update only | Owner: P10 git hygiene before the handoff commit |
| 2026-09-29 | 7.1 | Reviewed all 78 non-generated backend files, the routes, and `.claude/rules/*` against the docs. Findings F1–F8: no Critical or High; **F1 Medium** (a huge `page` → `500`, the `OFFSET` overflows MySQL's 64-bit limit) awaits the owner; **F2 Low fixed** (`demo:verify` label renamed to `employees_without_salary_records`); F3–F5 doc items (`PUT` alias, session keep-alive, Solid Cache prerequisite) and F8 doc drift passed to 7.2; F6/F7 informational. Scope and currency checks pass | Throwaway probe test (scratchpad, deleted) confirmed F1 on `/employees` and `/reports/salaries`; read-only runner probe of huge IDs (`400`/`404`, fine); `bin/rails test` ×5 seeds: 245 runs, 1,040 assertions, 0 failures; RuboCop 130 files clean; Brakeman 0 warnings | Owner: approve or decline the F1 fix (cap `page` at 1,000,000 → `400`) |
| 2026-09-29 | 7.2 | Root README rewritten per P5/P8/P3; API spec v2.1 (§11 phase and `PUT` alias, §13 client integration notes, §14 changelog); requirements v1.2 (§11 with actual test files), architecture v2.3 (§3 real code layout, §9 Solid Cache prerequisite, changelog), database design v2.2 (changelog); `CLAUDE.md` Commands; plan "Future work" with the frontend prerequisites. Phase 7 gate passed | Clean clone of `707ff61` (`.env` copied unread): `bundle check`, `db:test:prepare`, 245 runs 0 failures, health 200, signed-out 401, clone deleted. Final regression: `bin/rails test` ×5 seeds 245 runs, 1,040 assertions, 0 failures; RuboCop 130 clean; Brakeman 0 warnings; live smoke on :3113. README links checked | Open: F1 (owner decision, documented as a known limitation); P10 owner git hygiene before the handoff commit |
| 2026-09-29 | 7.1 F1 fix | Owner approved F1. `Api::QueryParams::MAX_PAGE = 1_000_000`: a larger `page` now returns `400` (was `500` from an overflowing MySQL `OFFSET`). A `QueryParams` unit test and endpoint cases in `employees_test` and `salary_report_test`. API spec §2.3 and §14; README (limitation removed, test count) and requirements §11 test count updated | Mutation check (without the cap, the endpoint tests error); `bin/rails test` ×5 seeds: 246 runs, 1,054 assertions, 0 failures; RuboCop 130 files clean; Brakeman 0 warnings | Open: P10 owner git hygiene |

## Current progress
- **Phase 1** — Backend requirements and design — **Done (gate passed 2026-09-28)**
- **Phase 2** — Repository and Rails foundation — **Done (gate passed 2026-09-28)**. 2.1, 2.2, 2.3 Done. Carried-over follow-ups: README health line; `db:prepare` (owner).
- **Phase 3** — Domain models and persistence — **Done (gate passed 2026-09-28)**. 3.1, 3.2, 3.3 Done.
- **Phase 4** — Employee and salary APIs — **Done (gate passed 2026-09-29)**. 4.1–4.4 Done.
- **Phase 5** — Compensation analytics and report APIs — **Done (gate passed 2026-09-29)**. 5.1, 5.2, 5.3 Done.
- **Phase 6** — Backend quality, performance, and regression — **Done (gate passed 2026-09-29)**. 6.1, 6.2, 6.3 Done. N14 declined (accepted risk R2).
- **Phase 7** — Backend documentation and handoff — **Done (gate passed 2026-09-29)**. 7.1, 7.2 Done; F1 fixed. Open: P10 (owner git hygiene).
- **Next:** owner does P10 and commits; then frontend planning (see "Future work")
- **Overall status:** Backend Phases 1–7 complete

## Future work
Frontend phases will be added after the backend/API scope and implementation are complete or stable. The backend is ready for them (Phase 7). Prerequisites and pointers for the frontend plan:
- **Contract:** `docs/api-specification.md` v2.1, especially §13 (client integration notes) and §10 (error codes).
- **Hosting:** serve the React app same-site with the API, or proxy `/api` to `http://localhost:3000` in development. No CORS is configured, and the session cookie is `SameSite=Lax` (ADR 004); a cross-origin setup needs an ADR 004 amendment.
- **Auth flow:** `GET /session` for the token → `POST /session` → store the **new** `csrf_token` → send `X-CSRF-Token` on every write. Treat `401` as signed out; handle `429` on sign-in.
- **Display rules:** show money strings as given, with `currency_code`, labelled monthly. Never total across currencies. Use the record `status` and `editable` flags rather than computing them from dates.
- **Known limitations** that affect the UI (README): analytics use current country, department, and status; the CSV is capped at 10,000 rows (`422 export_too_large` as JSON); there is one HR user.
- **Tooling already decided:** React functional components with Bootstrap, React Testing Library, Playwright (`CLAUDE.md`, `.claude/rules/frontend.md`). `PROJECT_DEV_PLAN.md` 2.3–2.4 hold the earlier frontend foundation outline.
