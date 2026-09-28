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
1. Migration: `salary_records` (amount `DECIMAL(18,4)` with `CHECK > 0`; `currency_code` FK to `currencies.code`; `CHECK effective_to >= effective_from`; virtual stored `open_flag`; unique `(employee_id, effective_from)` and `(employee_id, open_flag)`).
2. `SalaryRecord` model: validations I4–I7 plus scale versus `minor_units` (J9), overlap (I10), and `effective_from >= hired_on` (I13); `attr_readonly` (J8); `in_effect_on(date)` scope (D7); `status_on(date)` returning `current`, `scheduled`, or `historical`; `editable?` (D4 + O1).
3. `Employee`: `has_many :salary_records` (restrict); `current_salary`; the I13 employee-side validation (J10).
4. `Salaries::ChangeService` (design §6: lock the employee, check the latest record, close it, insert the new one), `Salaries::CorrectionService` (lock; editable only; `amount`/`currency_code` only), and `Employees::CreateService` (employee plus optional initial salary in one transaction).
5. Tests (J11, J12): scale per currency (JPY 0, USD 2, KWD 3); boundary dates; future-dated records are `scheduled`; the database guards fire; change closes the prior period exactly one day earlier; backdating and same-date changes are rejected; rollback leaves no partial state; correction allowed for current and scheduled records and rejected for historical ones; dates are immutable; create with a bad initial salary creates nothing.
6. Update the database design §3 types (J3) and note that the schema round-trip was verified (J13).

**Deliverables:** Migration, `SalaryRecord` model, three services, a salary factory, model and service tests, and an updated `schema.rb`.
**Acceptance:** `bin/rails test` passes with every rule I4–I13 and O1 covered; `db:test:prepare` from `schema.rb` keeps the generated column and CHECKs (asserted by tests); RuboCop and Brakeman are clean.
**Status:** Not Started (all decisions approved; ready on instruction)

### 3.3 Reference seeds, demo data, and integrity review
**Prompt:** `Split seeds per J6: idempotent reference-data seeds in db/seeds.rb, and a development-only demo:seed task generating about 10,000 deterministic synthetic employees with salary histories per docs/database-design.md §9. Review every integrity rule against the implemented schema. Document seed and reset commands.`
**Tasks:**
1. `db/seeds.rb`: `upsert_all` of countries, departments, and currencies from design §8. Safe to rerun and safe in production.
2. `lib/tasks/demo.rake` (`demo:seed`, `demo:reset`): refuses unless `Rails.env.development?`; fixed random seed (42); 10,000 employees across all countries and statuses; about 5% paid in USD; about 60% with one record, 38% with 2–4, 2% future-dated, 1% with none; history rows built already closed; `insert_all` in batches of 1,000 inside one transaction; refuses if employees exist unless reset.
3. Integrity review: a table of I1–I13 → where it is enforced → which test proves it; any gaps fixed or recorded.
4. Verify after seeding: counts per country, currency, and status; zero overlapping periods (SQL check); at most one open record per employee; scale matches `minor_units`; runtime recorded.
5. README "Sample data" section with the seed, demo, and reset commands.

**Deliverables:** Reference seeds, demo seed task, integrity checklist, and README instructions.
**Acceptance:** `db:seed` is idempotent (a second run changes 0 rows); `demo:seed` produces the same counts on every run; the SQL integrity checks return zero violations; `demo:seed` refuses to run in production.
**Status:** Not Started

**Phase gate:** Schema and domain behaviour are verified by model and service tests, the constraints survive the `schema.rb` round-trip, reference seeds are idempotent, and demo data loads deterministically with zero integrity violations.

---

## Phase 4 — Employee and salary APIs
**Goal:** Deliver secure, documented REST APIs for core salary management.

### 4.1 Authentication and authorization foundation
**Prompt:** `Implement proportionate secure authentication for the HR Manager per the approved auth decision (D16) and server-side protection applied by default to every API controller. Keep secrets in environment configuration. Add integration tests for login/logout, invalid credentials, rate limiting, and unauthenticated access. Do not build advanced RBAC or approval workflows.`
**Deliverables:** `users` migration and model (docs/database-design.md §3.1), `hr:create_user` rake task, session endpoints (API spec §4), default-deny base controller, and access-control tests.
**Acceptance:** Every non-public endpoint rejects unauthenticated requests by default; credentials come only from environment configuration; no salary data is exposed on auth failure.
**Status:** Not Started
**Note:** Moved ahead of the domain endpoints (previously 4.4) so that no employee or salary endpoint ever exists unprotected (finding C7).

### 4.2 API foundation and response conventions
**Prompt:** `Implement shared API conventions based on docs/api-specification.md: JSON response shape, error handling, parameter validation, and appropriate HTTP status codes. Add integration tests. Avoid unnecessary abstraction.`
**Deliverables:** API response/error conventions and integration tests.
**Acceptance:** Success and error responses are consistent and tested.
**Status:** Not Started

### 4.3 Employee endpoints
**Prompt:** `Implement employee endpoints (docs/api-specification.md §6), including list/detail, create with optional initial_salary in one transaction, and update, plus the read-only reference-data endpoints (§5). Support search, filters, sorting, and pagination. Prevent unnecessary sensitive-field exposure, avoid N+1 queries, and add integration tests.`
**Deliverables:** Employee and reference-data API endpoints and integration tests.
**Acceptance:** Contract, validation, filtering, pagination, and authorization behavior are tested.
**Status:** Not Started

### 4.4 Salary and history endpoints
**Prompt:** `Implement salary record and salary-history endpoints per the API contract: create (salary change that closes the prior period), list, show, and PATCH correction of current or scheduled (future-dated) records only (D4 + O1). Validate amount, currency, and effective dates; preserve historical records; use transactions where needed. Add integration tests for success and failure cases. Do not implement payroll calculations or disbursement.`
**Deliverables:** Salary/history endpoints and integration tests.
**Acceptance:** Current and historical records behave as documented; a salary change preserves the prior record; PATCH corrects current and scheduled records and returns `422 salary_record_not_editable` for historical ones; invalid changes are rejected.
**Status:** Not Started

**Phase gate:** Employee and salary APIs satisfy the contract and pass relevant integration tests.

---

## Phase 5 — Compensation analytics and report APIs
**Goal:** Provide accurate, currency-aware answers to organizational compensation questions.

### 5.1 Metric definitions and query layer
**Prompt:** `Implement the agreed compensation metrics and query layer from the requirements. Define how filters and effective dates apply. Group totals by currency and never combine unlike currencies without an approved conversion policy. Add unit/service tests.`
**Deliverables:** Analytics query/service layer and tests.
**Acceptance:** Metric definitions are explicit and calculations are tested against representative data.
**Status:** Not Started

### 5.2 Analytics and salary report endpoints
**Prompt:** `Expose approved compensation analytics (docs/api-specification.md §8) through Rails endpoints with documented filters and clear currency context. Return aggregates where possible rather than unnecessary individual salary details. Also implement the paginated JSON salary report GET /reports/salaries (§9.1, D19) on a SalaryReportQuery that 5.3 will reuse. Add integration tests and authorization checks.`
**Deliverables:** Analytics endpoints, JSON salary report endpoint, and integration tests.
**Acceptance:** Filtered and unfiltered responses are correct, documented, and access-controlled.
**Status:** Not Started

### 5.3 CSV/report export endpoint
**Prompt:** `Implement the backend CSV export endpoint for filtered salary reports (FR-06, D24). Share the filter/query object with the JSON report, apply authorization, enforce the row cap, and protect against CSV formula injection. Add integration tests.`
**Deliverables:** Export endpoint and tests.
**Acceptance:** Exported rows match the JSON report for the same filters; only allowlisted columns appear; formula cells are escaped; over 10,000 rows returns `422 export_too_large`.
**Status:** Not Started

**Phase gate:** Analytics, report, and export endpoints pass correctness and access-control tests.

---

## Phase 6 — Backend quality, performance, and regression
**Goal:** Validate backend behavior against the target data volume without inventing unspecified SLAs.

### 6.1 Backend test coverage review
**Prompt:** `Review model, service, and integration tests against docs/requirements.md and docs/api-specification.md. Add missing tests for salary history, currency-safe analytics, validation, pagination, and authorization. Run the relevant Minitest suite (`bin/rails test`) and report actual results.`
**Deliverables:** Coverage review, additional tests, and test results.
**Acceptance:** Critical backend acceptance criteria have automated coverage; gaps are documented.
**Status:** Not Started

### 6.2 Performance and query review
**Prompt:** `Evaluate employee listing, filters, salary history, and analytics using approximately 10,000 synthetic employees. Inspect query behavior, indexes, pagination, and N+1 queries. Apply only measured, justified optimizations. Do not claim an unspecified latency or concurrency SLA.`
**Deliverables:** Performance findings and targeted improvements.
**Acceptance:** No known avoidable N+1 or unbounded listing remains; findings and limitations are documented.
**Status:** Not Started

### 6.3 API regression and security review
**Prompt:** `Run backend regression tests and review API security: authentication, authorization, permitted parameters, sensitive data exposure, error responses, and CSV safety if applicable. Fix verified issues and report exact commands and outcomes.`
**Deliverables:** Regression/security findings and test results.
**Acceptance:** Critical API workflows pass; unresolved risks and skipped checks are documented.
**Status:** Not Started

**Phase gate:** Backend test suite and critical API workflows are verified with synthetic target-volume data.

---

## Phase 7 — Backend documentation and handoff
**Goal:** Make the backend easy to run, inspect, and extend when frontend work begins.

### 7.1 Code and scope review
**Prompt:** `Review the Rails backend against CLAUDE.md, docs/requirements.md, architecture, database design, and API specification. Check correctness, security, currency handling, salary history, query behavior, tests, and scope discipline. Report findings by severity with file references before making nontrivial changes.`
**Deliverables:** Review findings and resolutions.
**Acceptance:** No known critical issue remains; deviations and limitations are documented.
**Status:** Not Started

### 7.2 Backend setup and API documentation
**Prompt:** `Finalize backend README and docs with Ruby/Rails prerequisites, environment setup, database creation/migrations, seed loading, test commands, health endpoint, authentication approach, API overview, and known limitations. Ensure the API contract is ready for a future frontend phase. Do not implement frontend code.`
**Deliverables:** Backend setup guide and handoff-ready API documentation.
**Acceptance:** A reviewer can run the backend, load synthetic data, execute tests, and understand the API without frontend code.
**Status:** Not Started

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

## Current progress
- **Phase 1** — Backend requirements and design — **Done (gate passed 2026-09-28)**
- **Phase 2** — Repository and Rails foundation — **Done (gate passed 2026-09-28)**. 2.1, 2.2, 2.3 Done. Carried-over follow-ups: README health line; `db:prepare` (owner).
- **Phase 3** — Domain models and persistence — reviewed 2026-09-28; tasks 3.1–3.3 proposed.
- **Current subphases:** 3.1 Done (2026-09-28); 3.2 and 3.3 Not Started.
- **Next subphase:** 3.2 — Salary records, history services, and employee creation (awaiting instruction)
- **Overall status:** Phases 1–2 complete

## Future work
Frontend phases will be added after the backend/API scope and implementation are complete or stable.
