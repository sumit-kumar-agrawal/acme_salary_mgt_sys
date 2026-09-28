# Salary Management System — Backend Development Plan

**Purpose:** Phased implementation plan for the Rails backend and REST API only. Frontend work will be planned separately later.

**Stack:** Ruby on Rails API, MySql, RSpec. Target data volume: approximately 10,000 employees across multiple countries.

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
| D25 | Ruby/Rails versions | Local Ruby 3.1.2 is end-of-life and limits us to Rails 7.2. Proposed: stay on Rails 7.2 / Ruby 3.1 for the assessment, or upgrade to Ruby 3.3 with Rails 8. Record the choice either way. | 1.2 |
| D26 | Serialization and pagination libraries | Plain serializer POROs and a hand-rolled pagination concern, so no extra gems. | 1.2 |
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
| Median/distribution queries are slow or incorrect on MySQL | Medium / Medium | Query objects with fixture-verified specs; measure with 10k seed rows in Phase 6 |
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

### Phase 2 review findings (2026-09-28)

Inputs: Phase 1 documents (requirements v1.1, architecture v2.0, database design v2.0, API spec v2.0, ADRs 001–005), `CLAUDE.md`, `.claude/rules/*`, the current repository state, and the local toolchain. No application code exists yet.

#### Current state (observed)

| Item | Observation |
|---|---|
| Ruby | 3.1.2 via **RVM** (`~/.rvm/rubies/ruby-3.1.2`). A `~/.rbenv` directory also exists. No `.ruby-version` in the repo. |
| Rails / gems | Rails 7.2.3.1, 7.2.3, 7.2.2.x installed; `mysql2` 0.5.7 already builds; Bundler 2.6.2. RubyGems warns about unresolved `tsort`/`stringio` specs, which is harmless. |
| MySQL | Homebrew `mysql@8.4` service running on `127.0.0.1:3306`. The root login requires a password Claude does not have. `mysql-client` 9.7 is also installed. |
| Docker | Docker 27 CLI installed; **daemon not running**. |
| Repository | No `.gitignore`. `backend/.env.example` is empty. `docker-compose.yml` contains only `services:` and is not valid for use. `README.md` has one paragraph. `.idea/` files are **staged**. `.DS_Store` files are untracked. |
| Git | On `main`. All Phase 1 work (plan, docs, ADRs 004–005) is **uncommitted**. The last commit is `b7e865f`. `.claude/commands/*` have staged and further unstaged edits. |

#### A. Missing decisions

| ID | Decision | Proposed default | Needed by |
|---|---|---|---|
| E1 | How MySQL is provided for development and test | **Local Homebrew MySQL 8.4**, which is already running. `docker-compose.yml` becomes an *optional* MySQL-only service on host port **3307** for reviewers without MySQL, so it can't clash with the local 3306. | 2.1 |
| E2 | Database account | A dedicated `salary_app` user with rights only on `acme_salary_development` and `acme_salary_test`; never root. The project owner creates it once with a documented SQL snippet (Claude cannot use the root password). | 2.2 |
| E3 | Environment-variable loading | **No dotenv gem.** `database.yml` reads `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` via `ENV.fetch`, with local-dev defaults (`127.0.0.1`, `3306`, `salary_app`, and a password with no default). The developer exports variables from their shell or uses `direnv`, as documented. This avoids amending ADR 005. | 2.2 |
| E4 | Production secrets | Environment variables only (`SECRET_KEY_BASE`, `DB_*`). The generated `credentials.yml.enc` is left unused, and `config/master.key` is git-ignored. | 2.1 / 2.2 |
| E5 | `rails new` options | `rails _7.2.3.1_ new backend --api --database=mysql --skip-git --skip-test --skip-action-mailer --skip-action-mailbox --skip-action-text --skip-active-storage --skip-action-cable --skip-jbuilder --skip-docker --skip-ci`. Keep Active Job (Rails default, no infrastructure), RuboCop omakase, and Brakeman (ADR 005). | 2.2 |
| E6 | Generated `/up` health route | **Remove it** and keep the single documented `GET /api/v1/health`, which also checks the database. Fewer public endpoints is better. | 2.2 |
| E7 | Health controller base class | Inherit from `ActionController::API` directly. `Api::V1::BaseController` with default-deny auth only arrives in 4.1, where health must remain public (API §11). | 2.2 |
| E8 | Foundation configuration in 2.2 | `config.time_zone = "UTC"`; `filter_parameters` extended per architecture §7; `utf8mb4` / `utf8mb4_0900_ai_ci` in `database.yml`; Rails' default strict SQL mode kept. Session, cookie, and CSRF middleware are **not** added until 4.1. | 2.2 |
| E9 | When each gem is added | `rspec-rails` in 2.3; `factory_bot_rails` and `faker` in 3.1, when factories first exist; `bcrypt` in 4.1. Each gem is added in the subphase that first needs it. | 2.3 |
| E10 | Ruby version pinning | Add `.ruby-version` (`3.1.2`) at the repo root and in `backend/`. The `Gemfile` declares `ruby "3.1.2"` and `gem "rails", "~> 7.2.3"`. RVM is documented as the reference manager; rbenv also honours `.ruby-version`. | 2.1 |
| E11 | README layout | A single root `README.md` covering overview, prerequisites, database setup, running, testing, and links to `docs/` and this plan. No separate `backend/README.md` (Rails' generated stub is removed), to avoid two diverging guides. | 2.1 |
| E12 | CLAUDE.md changes (the 2.1 prompt says "add or update") | Minimal: add a "Current plan" pointer to `BACKEND_PLAN.md` and a "Commands" section (test and lint commands) once they exist. Scope, rules, and stack text stay unchanged. | 2.1 / 2.3 |
| E13 | Continuous integration | **Deferred.** Rails' generated workflow would land in `backend/.github/`, where GitHub ignores it. A root-level workflow can be added later as a separate, justified task. Not required by the requirements. | 2.2 |
| E14 | Housekeeping of unrelated staged files | Unstage `.idea/` (`git rm -r --cached .idea`, files kept on disk) and ignore it together with `.DS_Store`. Leave `.claude/commands/*` edits to the owner. **Requires owner approval** (index change). | 2.1 |
| E15 | Committing Phase 1 before scaffolding | Commit the Phase 1 documents first, on a feature branch (e.g. `phase-2-foundation`, with Phase 1 docs as its first commit), so `rails new` output is reviewable separately. **Requires owner approval**; Claude does not commit unless asked. | Before 2.1 |

#### B. Assumptions
- The project owner can run one SQL snippet as MySQL root (E2). Claude never handles the root password.
- Development and test run on the same local MySQL 8.4 instance, in separate databases.
- The reviewer's machine has Ruby 3.1.2 (any manager) and either MySQL 8.0.16+ or Docker. The README states both paths.
- Backend-only: no Node, frontend tooling, or CORS configuration in Phase 2 (ADR 004, E8).
- There are no deployment targets. Production configuration is limited to env-var secrets and `force_ssl` defaults; no deployment artefacts.

#### C. Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| Approval of E1–E15 | All of Phase 2 | Project owner |
| Phase 1 docs committed (E15) | 2.1 (clean diff for scaffold review) | Project owner |
| `salary_app` user and grants created (E2) | 2.2 `db:prepare`, 2.3 spec run | Project owner (root password) |
| Root `.gitignore` in place **before** `rails new` | 2.2. With `--skip-git`, Rails creates **no** `.gitignore`, so `backend/config/master.key`, `log/`, and `tmp/` would otherwise be untracked and easy to commit | 2.1 |
| Docker daemon running | Only the optional compose path (E1) | Reviewer |

#### D. Risks

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| `rails new` inside the repo runs `git init`, creating a nested repository | High / Medium | `--skip-git` (E5) |
| `master.key` or logs committed because `--skip-git` also skips `.gitignore` | Medium / High | Root `.gitignore` with backend paths, created in 2.1 before scaffolding; verify with `git status` after 2.2 |
| Two Ruby managers (RVM and rbenv) resolve different Rubies in different shells | Medium / Medium | `.ruby-version` plus the README note; run `ruby -v` inside `backend/` in 2.2 validation |
| `mysql2` native build fails on another arm64 Mac (OpenSSL/zstd paths) | Medium / Low | Document `bundle config build.mysql2 --with-opt-dir=$(brew --prefix openssl@3)` as a fallback. It already builds here. |
| Port 3306 clash if a reviewer runs Docker MySQL alongside a local MySQL | Medium / Low | Compose maps to 3307 (E1) |
| Test runs wipe development data if the database names collide | Low / High | Distinct names (`_development`, `_test`); `rails_helper` aborts unless `Rails.env.test?` (RSpec default) |
| Generated Rails stubs drift from the documented design (e.g. `/up`, README) | Medium / Low | E6, E11; review the generated file list in 2.2 |
| Ruby 3.1 end-of-life | Certain / Low for an assessment | Accepted in ADR 005 |
| Uncommitted Phase 1 docs lost or tangled with scaffold output | Medium / High | E15 |

### 2.1 Repository and backend structure
**Prompt:** `Set up the repository skeleton for the backend-first project per the Phase 2 findings (E1, E4, E10–E12, E14). Add .gitignore, .env.example, .ruby-version, the optional MySQL-only docker-compose.yml, and README setup documentation. Keep frontend implementation out of this phase and never commit secrets. Do not run rails new.`
**Tasks:**
1. Get owner decisions on E1–E15. If approved, the owner commits the Phase 1 docs (E15) and unstages `.idea/` (E14).
2. Root `.gitignore`: OS/IDE files (`.DS_Store`, `.idea/`), `.env` and `.env.*` except `backend/.env.example`, and the Rails backend paths (`backend/config/master.key`, `backend/log/*`, `backend/tmp/*`, `backend/storage/*`, `backend/.bundle`, `backend/vendor/bundle`), keeping the `.keep` files.
3. `backend/.env.example`: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` (compose only), `SECRET_KEY_BASE` (production only), and placeholders for `HR_USER_EMAIL` / `HR_USER_PASSWORD` (used in 4.1). Placeholder values only.
4. `docker-compose.yml`: an optional `mysql:8.4` service on host port 3307 with a named volume, utf8mb4 settings, a healthcheck, and an init script creating `salary_app` and the two databases. Credentials come from `.env`.
5. `db/setup-local-mysql.sql` (or a README snippet): `CREATE USER salary_app`, `CREATE DATABASE` ×2 with utf8mb4, and `GRANT` on those databases only.
6. `.ruby-version` = `3.1.2` (E10).
7. `README.md`: overview; repository layout (`backend/`, `docs/`, plans); prerequisites (Ruby 3.1.2, MySQL 8.0.16+ *or* Docker); database setup (local or compose); placeholders for run/test commands (filled in 2.2/2.3); links to requirements, architecture, database design, API spec, ADRs, and this plan.
8. `CLAUDE.md`: add a "Current plan: BACKEND_PLAN.md" pointer only (E12).

**Deliverables:** `.gitignore`, `backend/.env.example`, `.ruby-version`, `docker-compose.yml` (optional path), local MySQL setup SQL, and updated `README.md` / `CLAUDE.md`.
**Acceptance:** `git status` shows no IDE/OS noise; `git check-ignore` confirms `.env`, `backend/config/master.key`, and `backend/log/x.log` are ignored and `backend/.env.example` is not; `docker compose config` validates (Docker not needed to be running); no real secrets in any tracked file; README instructions match E1–E3.
**Status:** Not Started

### 2.2 Rails API initialization
**Prompt:** `Generate the Rails 7.2.3.1 API app in backend/ with the E5 options. Configure database.yml from environment variables (E3, utf8mb4), UTC time zone and filter_parameters (E8), remove /up (E6), and add GET /api/v1/health with a database check (API spec §3, E7). Do not add domain models, auth, sessions, or other gems.`
**Tasks:**
1. Confirm prerequisites: `ruby -v` = 3.1.2 inside the repo; the `salary_app` user exists (E2).
2. Run `rails _7.2.3.1_ new backend …` (E5) and review the generated file list; remove `backend/README.md` (E11) and any leftover `.github/` or `Dockerfile`.
3. `Gemfile`: `ruby "3.1.2"`, `gem "rails", "~> 7.2.3"`. No new gems.
4. `config/database.yml`: `ENV.fetch` for host, port, username, and password; `encoding: utf8mb4`; `collation: utf8mb4_0900_ai_ci`; database names `acme_salary_development` and `acme_salary_test`; production reads everything from env vars.
5. `config/application.rb`: `config.time_zone = "UTC"`. `config/initializers/filter_parameter_logging.rb`: add `password`, `amount`, `salary`, `email`, `first_name`, `last_name`, `csrf_token` (architecture §7).
6. Routes: delete `/up`; add a `namespace :api { namespace :v1 { get "health" } }` route.
7. `Api::V1::HealthController < ActionController::API`: run `SELECT 1`; return `200 {"data":{"status":"ok","database":"ok"}}`, or `503 {"data":{"status":"error","database":"unavailable"}}` when a database error is rescued. No version or environment details.
8. `bin/rails db:prepare` for development and test.
9. Update README run instructions.

**Deliverables:** Bootable Rails API in `backend/` with environment-driven database configuration and the health endpoint.
**Acceptance:**
- `bin/rails db:prepare` succeeds for development and test.
- `bin/rails server` boots, and `curl localhost:3000/api/v1/health` returns `200` with the documented body.
- With MySQL stopped or a wrong `DB_PASSWORD`, health returns `503`.
- `/up` returns `404`.
- `git status` shows no `master.key`, `log/`, or `tmp/` files.

**Status:** Not Started

### 2.3 RSpec and quality baseline
**Prompt:** `Add rspec-rails (only), configure RSpec, write request specs for the health endpoint (200 and 503 paths), and establish lint and security baselines with the generated RuboCop omakase and Brakeman. Run everything and record exact commands and results in the README and completion log.`
**Tasks:**
1. Add `rspec-rails` to the `:development, :test` group; run `rails generate rspec:install`; `.rspec` with `--require rails_helper`. Keep `use_transactional_fixtures = true`.
2. `spec/requests/api/v1/health_spec.rb`:
   - `200` and the exact JSON body when the database is up.
   - `503` and the exact body when the connection raises (stub `ActiveRecord::Base.connection` to raise `ActiveRecord::ConnectionNotEstablished`).
   - The response exposes no version or environment keys.
   - `/up` returns 404 (routing spec).
3. Run `bundle exec rspec`, `bin/rubocop`, and `bin/brakeman --no-pager`. Fix any offences in generated code rather than disabling cops, unless a cop conflicts with Rails defaults (document any exception).
4. README "Testing and quality" section with the exact commands. `CLAUDE.md` "Commands" section (E12).

**Deliverables:** RSpec configuration, health request specs, and clean RuboCop and Brakeman baselines with documented commands.
**Acceptance:** All three commands exit 0; the actual output summary (example count, offences, warnings) is recorded in the completion log; the commands are documented in README and CLAUDE.md.
**Status:** Not Started

**Phase gate:** Rails API boots, database connectivity works, health returns 200/503 correctly, `bundle exec rspec`, `bin/rubocop` and `bin/brakeman` pass, and no secrets or generated artefacts are tracked.

---

## Phase 3 — Domain models and persistence
**Goal:** Implement the core backend data model with reliable data integrity.

### 3.1 Reference data and employee models
**Prompt:** `Implement the approved country, currency, department, and employee schema from docs/database-design.md. Add migrations, associations, validations, indexes, and model specs. Use synthetic data only; do not add unrelated entities.`
**Deliverables:** Migrations, models, factories, and model specs. (The `users` table is created in 4.1 with authentication.)
**Acceptance:** Migrations run; associations and validations are covered by tests.
**Status:** Not Started

### 3.2 Salary records and history
**Prompt:** `Implement salary records using the approved effective-date and history design. Store monetary amounts with decimal precision and currency separately. Preserve previous salary records when compensation changes. Add appropriate constraints, indexes, factories, and model specs. Do not calculate payroll, tax, or net pay.`
**Deliverables:** Salary model, migrations/constraints, factories, and specs.
**Acceptance:** Salary history is retained; invalid amounts, currencies, and date ranges are rejected according to documented rules.
**Status:** Not Started

### 3.3 Database integrity and seed data
**Prompt:** `Review database constraints and create repeatable synthetic seed data for representative employees, countries, departments, currencies, and salary histories. Ensure seeds are safe to rerun or document reset behavior.`
**Deliverables:** Constraints review, seed generator, and seed instructions.
**Acceptance:** Seed data loads predictably and covers multi-country, multi-currency, and salary-history scenarios.
**Status:** Not Started

**Phase gate:** Schema and domain behavior are verified by model specs and repeatable seeds.

---

## Phase 4 — Employee and salary APIs
**Goal:** Deliver secure, documented REST APIs for core salary management.

### 4.1 Authentication and authorization foundation
**Prompt:** `Implement proportionate secure authentication for the HR Manager per the approved auth decision (D16) and server-side protection applied by default to every API controller. Keep secrets in environment configuration. Add request specs for login/logout, invalid credentials, rate limiting, and unauthenticated access. Do not build advanced RBAC or approval workflows.`
**Deliverables:** `users` migration and model (docs/database-design.md §3.1), `hr:create_user` rake task, session endpoints (API spec §4), default-deny base controller, and access-control specs.
**Acceptance:** Every non-public endpoint rejects unauthenticated requests by default; credentials come only from environment configuration; no salary data is exposed on auth failure.
**Status:** Not Started
**Note:** Moved ahead of the domain endpoints (previously 4.4) so that no employee or salary endpoint ever exists unprotected (finding C7).

### 4.2 API foundation and response conventions
**Prompt:** `Implement shared API conventions based on docs/api-specification.md: JSON response shape, error handling, parameter validation, and appropriate HTTP status codes. Add request specs. Avoid unnecessary abstraction.`
**Deliverables:** API response/error conventions and request specs.
**Acceptance:** Success and error responses are consistent and tested.
**Status:** Not Started

### 4.3 Employee endpoints
**Prompt:** `Implement employee endpoints (docs/api-specification.md §6), including list/detail, create with optional initial_salary in one transaction, and update, plus the read-only reference-data endpoints (§5). Support search, filters, sorting, and pagination. Prevent unnecessary sensitive-field exposure, avoid N+1 queries, and add request specs.`
**Deliverables:** Employee and reference-data API endpoints and request specs.
**Acceptance:** Contract, validation, filtering, pagination, and authorization behavior are tested.
**Status:** Not Started

### 4.4 Salary and history endpoints
**Prompt:** `Implement salary record and salary-history endpoints per the API contract: create (salary change that closes the prior period), list, show, and PATCH correction of current or scheduled (future-dated) records only (D4 + O1). Validate amount, currency, and effective dates; preserve historical records; use transactions where needed. Add request specs for success and failure cases. Do not implement payroll calculations or disbursement.`
**Deliverables:** Salary/history endpoints and request specs.
**Acceptance:** Current and historical records behave as documented; a salary change preserves the prior record; PATCH corrects current and scheduled records and returns `422 salary_record_not_editable` for historical ones; invalid changes are rejected.
**Status:** Not Started

**Phase gate:** Employee and salary APIs satisfy the contract and pass relevant request specs.

---

## Phase 5 — Compensation analytics and report APIs
**Goal:** Provide accurate, currency-aware answers to organizational compensation questions.

### 5.1 Metric definitions and query layer
**Prompt:** `Implement the agreed compensation metrics and query layer from the requirements. Define how filters and effective dates apply. Group totals by currency and never combine unlike currencies without an approved conversion policy. Add unit/service specs.`
**Deliverables:** Analytics query/service layer and tests.
**Acceptance:** Metric definitions are explicit and calculations are tested against representative data.
**Status:** Not Started

### 5.2 Analytics and salary report endpoints
**Prompt:** `Expose approved compensation analytics (docs/api-specification.md §8) through Rails endpoints with documented filters and clear currency context. Return aggregates where possible rather than unnecessary individual salary details. Also implement the paginated JSON salary report GET /reports/salaries (§9.1, D19) on a SalaryReportQuery that 5.3 will reuse. Add request specs and authorization checks.`
**Deliverables:** Analytics endpoints, JSON salary report endpoint, and request specs.
**Acceptance:** Filtered and unfiltered responses are correct, documented, and access-controlled.
**Status:** Not Started

### 5.3 CSV/report export endpoint
**Prompt:** `Implement the backend CSV export endpoint for filtered salary reports (FR-06, D24). Share the filter/query object with the JSON report, apply authorization, enforce the row cap, and protect against CSV formula injection. Add request specs.`
**Deliverables:** Export endpoint and tests.
**Acceptance:** Exported rows match the JSON report for the same filters; only allowlisted columns appear; formula cells are escaped; over 10,000 rows returns `422 export_too_large`.
**Status:** Not Started

**Phase gate:** Analytics, report, and export endpoints pass correctness and access-control tests.

---

## Phase 6 — Backend quality, performance, and regression
**Goal:** Validate backend behavior against the target data volume without inventing unspecified SLAs.

### 6.1 Backend test coverage review
**Prompt:** `Review model, service, and request specs against docs/requirements.md and docs/api-specification.md. Add missing tests for salary history, currency-safe analytics, validation, pagination, and authorization. Run the relevant RSpec suite and report actual results.`
**Deliverables:** Coverage review, additional specs, and test results.
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

## Current progress
- **Current phase:** Phase 1 — Backend requirements and design — **Done (gate passed 2026-09-28)**
- **Next phase:** Phase 2 — Repository and Rails foundation. Review findings recorded; tasks 2.1–2.3 proposed.
- **Next subphase:** 2.1 — Repository and backend structure (Not Started; awaiting decisions E1–E15)
- **Overall status:** Phase 1 complete; Phase 2 planned, not started

## Future work
Frontend phases will be added after the backend/API scope and implementation are complete or stable.
