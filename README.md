# acme_salary_mgt_sys

A web application for ACME's HR Manager to manage salary information for about 10,000 employees across multiple countries, and to analyse compensation through reports and dashboards. It replaces a manual, Excel-based process.

Salary amounts are **monthly gross base pay**, stored together with their currency. Amounts in different currencies are never summed together. All development and demo data is synthetic.

> **Status:** backend foundation in progress (Phase 2 of [`BACKEND_PLAN.md`](BACKEND_PLAN.md)). The frontend is planned separately.

## Repository layout

| Path | Contents |
|---|---|
| `backend/` | Rails 8 application (JSON API under `/api/v1`) |
| `docs/` | Requirements, architecture, database design, API specification, and ADRs |
| `BACKEND_PLAN.md` | Phased backend plan, decisions, and progress log (the current plan) |
| `PROJECT_DEV_PLAN.md` | Earlier full-stack plan; its backend phases are superseded by `BACKEND_PLAN.md` |
| `CLAUDE.md`, `.claude/` | Project instructions, rules, and skills for Claude Code |
| `requirements.docx` | Original agreed scope document |

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Ruby | 3.2.0 (see `backend/.ruby-version`) | Managed with [RVM](https://rvm.io). `rvm install 3.2.0` if needed |
| Bundler | 2.x | Ships with Ruby |
| MySQL | 8.0.16 or later (8.4 used in development) | Needed for enforced `CHECK` constraints |

Docker support is planned for a later phase.

## Setup

1. **Install gems**

   ```bash
   cd backend         # RVM switches to the Ruby in backend/.ruby-version
   ruby -v            # should print 3.2.0; otherwise run: rvm use 3.2.0
   bundle install
   ```

2. **Configure the database connection.** Create `backend/.env`. It is git-ignored, so never commit it. Rails loads it through `dotenv-rails`. `config/database.yml` reads these variables:

   | Variable | Example | Purpose |
   |---|---|---|
   | `DB_HOST` | `localhost` | MySQL host |
   | `DB_PORT` | `3306` | MySQL port |
   | `DB_NAME` | `salary_management` | Development database name. The test database is always `salary_management_test` |
   | `DB_USERNAME` | `salary_app` | MySQL user |
   | `DB_PASSWORD` | *(your password)* | MySQL password |
   | `HR_USER_EMAIL` | `hr@example.test` | The HR Manager login, used by `hr:create_user` |
   | `HR_USER_PASSWORD` | *(at least 12 characters)* | Its password, used by `hr:create_user` only |

   A dedicated MySQL user is recommended over `root`. It needs rights on `salary_management` and `salary_management_test`.

3. **Create the databases** (the first time only)

   ```bash
   bin/rails db:prepare
   ```

   See `BACKEND_PLAN.md` task 2.2 (H3) before the first run: development and test are to use only the primary database.

4. **Create the HR login** (there is no sign-up)

   ```bash
   bin/rails hr:create_user                    # reads HR_USER_EMAIL and HR_USER_PASSWORD from backend/.env
   RESET_PASSWORD=1 bin/rails hr:create_user   # change the password of the existing user
   ```

   The API uses a session cookie with CSRF protection: call `GET /api/v1/session` for a `csrf_token`, then `POST /api/v1/session` with `{"email", "password"}` and an `X-CSRF-Token` header. Sessions end after 30 minutes idle or 8 hours. Login is limited to 5 attempts per minute per IP.

## Sample data

Run from `backend/`:

```bash
bin/rails db:seed        # reference data (countries, departments, currencies); idempotent, safe anywhere
bin/rails demo:seed      # development only: 10,000 synthetic employees with salary histories (~2 s)
bin/rails demo:reset     # development only: delete employees and salaries, then demo:seed again
bin/rails demo:verify    # read-only counts and integrity checks (overlaps, open records, scale, hire date)
```

Demo data is synthetic and deterministic (fixed seed, as-of date 2026-09-28): every run produces the same rows. `demo:seed` refuses if employees already exist. Both demo tasks refuse to run outside development.

## Running

```bash
cd backend
bin/rails server
```

The app listens on `http://localhost:3000`. The documented health endpoint `GET /api/v1/health` arrives in task 2.2; until then, Rails' built-in `GET /up` responds.

## Testing and quality

```bash
cd backend
bin/rails test                                          # full Minitest suite
bin/rails test test/integration/api/v1/health_test.rb   # a single file
bin/rails test test/integration/api/v1/health_test.rb:13  # a single test (by line)
bin/rubocop                                             # style (rubocop-rails-omakase)
bin/brakeman --no-pager                                 # static security scan
```

- Tests use the `salary_management_test` database, which must exist first (`bin/rails db:test:prepare`).
- Tests run in a single process (`parallelize(workers: 1)` in `test/test_helper.rb`). Rails 8.0's parallel workers are incompatible with minitest 6 and hang (see `BACKEND_PLAN.md` K1). The whole suite takes about a second.
- Integration tests live in `test/integration/`, and model, service, and query tests in `test/models`, `test/services`, and `test/queries`.
- The latest baseline results (test counts, RuboCop offences, Brakeman warnings) are recorded in the `BACKEND_PLAN.md` completion log.

## Documentation

- [Requirements](docs/requirements.md): scope, approved decisions, traceability
- [Architecture](docs/architecture.md): modules, request flows, auth boundary, error contract
- [Database design](docs/database-design.md): schema, integrity rules, query shapes, seed plan
- [API specification](docs/api-specification.md): endpoints, payloads, status codes
- Architecture decision records: [001 monorepo](docs/decisions/001-monorepo.md), [002 currency](docs/decisions/002-currency-handling.md), [003 salary history](docs/decisions/003-salary-history.md), [004 authentication](docs/decisions/004-authentication.md), [005 versions and libraries](docs/decisions/005-runtime-versions-and-libraries.md)

## Out of scope

Payroll processing, tax and statutory calculations, salary disbursement, banking/HRMS integrations, advanced role-based access and approval workflows, currency conversion, and AI/LLM features. See `docs/requirements.md` §6.
