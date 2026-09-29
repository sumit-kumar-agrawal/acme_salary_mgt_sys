# acme_salary_mgt_sys

A web application for ACME's HR Manager to manage salary information for about 10,000 employees across multiple countries, and to analyse compensation through reports and dashboards. It replaces a manual, Excel-based process.

Salary amounts are **monthly gross base pay**, stored together with their currency. Amounts in different currencies are never summed together. All development and demo data is synthetic.

> **Status:** the backend (Rails JSON API) is complete through Phase 7 of [`BACKEND_PLAN.md`](BACKEND_PLAN.md): employees, salary history, analytics, reports, and CSV export, with 246 automated tests. The React frontend is planned separately (see "Future work" in the plan).

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
| Ruby | 3.2.0 (see `backend/.ruby-version`) | Managed with [RVM](https://rvm.io) (or another Ruby manager). `rvm install 3.2.0` if needed |
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

2. **Create a MySQL user** (recommended over `root`). As a MySQL administrator, choose your own password:

   ```sql
   CREATE USER 'salary_app'@'localhost' IDENTIFIED BY '<choose-a-password>';
   GRANT ALL PRIVILEGES ON salary_management.*      TO 'salary_app'@'localhost';
   GRANT ALL PRIVILEGES ON salary_management_test.* TO 'salary_app'@'localhost';
   ```

   These grants let `bin/rails db:prepare` create both databases in step 4. If you prefer to create them yourself, use `CREATE DATABASE <name> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;` for each.

3. **Configure the connection.** Copy `backend/.env.example` to `backend/.env` and fill it in. The `.env` file is git-ignored, so never commit it. Rails loads it through `dotenv-rails`, and `config/database.yml` reads these variables:

   | Variable | Example | Purpose |
   |---|---|---|
   | `DB_HOST` | `localhost` | MySQL host |
   | `DB_PORT` | `3306` | MySQL port |
   | `DB_NAME` | `salary_management` | Development database name. The test database is always `salary_management_test` |
   | `DB_USERNAME` | `salary_app` | MySQL user |
   | `DB_PASSWORD` | *(your password)* | MySQL password |
   | `HR_USER_EMAIL` | `hr@example.test` | The HR Manager login, used by `hr:create_user` |
   | `HR_USER_PASSWORD` | *(at least 12 characters)* | Its password, used by `hr:create_user` only |

4. **Create the databases and load the schema** (the first time only). `db:prepare` also loads the reference data (countries, departments, currencies) when it creates the development database.

   ```bash
   bin/rails db:prepare
   bin/rails db:test:prepare
   ```

5. **Create the HR login** (there is no sign-up)

   ```bash
   bin/rails hr:create_user                    # reads HR_USER_EMAIL and HR_USER_PASSWORD from backend/.env
   RESET_PASSWORD=1 bin/rails hr:create_user   # change the password of the existing user
   ```

### Updating an existing checkout

After pulling new commits, apply any new migrations (for example, the Phase 6.2 indexes) to both databases:

```bash
cd backend
bundle install
bin/rails db:migrate
bin/rails db:test:prepare
```

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

The API listens on `http://localhost:3000/api/v1`. `GET /api/v1/health` returns `200 {"data":{"status":"ok","database":"ok"}}`, or `503` when the database is unreachable. It needs no login.

## Using the API

The full contract is in [docs/api-specification.md](docs/api-specification.md). §13 there has client integration notes for the frontend.

| Area | Endpoints (under `/api/v1`) |
|---|---|
| Health | `GET /health` (public) |
| Session | `GET /session` (public; login state and CSRF token), `POST /session` (public; sign in), `DELETE /session` |
| Reference data | `GET /countries`, `GET /departments`, `GET /currencies` |
| Employees | `GET /employees` (search, filters, sort, pagination; no salary or email), `POST /employees` (optional initial salary), `GET /employees/:id`, `PATCH /employees/:id` |
| Salary history | `GET /employees/:id/salary_records`, `POST …/salary_records` (salary change), `GET …/salary_records/:rid`, `PATCH …/salary_records/:rid` (correct a current or scheduled record) |
| Analytics | `GET /analytics/summary`, `GET /analytics/distribution`, `GET /analytics/breakdown?by=country\|department` |
| Reports | `GET /reports/salaries` (paginated JSON), `GET /reports/salaries.csv` (download, up to 10,000 rows) |

Conventions:
- JSON bodies are wrapped in a resource key (`employee`, `salary_record`).
- Errors use one envelope, `{"error": {"code", "message", "details"}}`.
- Lists return `meta` with the page (maximum 1,000,000), `per_page` (default 25, maximum 100), and totals.
- Money is a decimal string always paired with `currency_code`, and totals are per currency.
- Dates are `YYYY-MM-DD`, and "today" is UTC.

**Sign in with curl** (the API uses a session cookie plus a CSRF token for writes):

```bash
BASE=http://localhost:3000/api/v1
JAR=cookies.txt

# 1. Get a CSRF token (and a session cookie)
TOKEN=$(curl -s -c $JAR -b $JAR $BASE/session | ruby -rjson -e 'puts JSON.parse($stdin.read)["data"]["csrf_token"]')

# 2. Sign in; the response carries a new token for later writes (the session is reset at sign-in)
TOKEN=$(curl -s -c $JAR -b $JAR -H "X-CSRF-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"hr@example.test","password":"<your password>"}' $BASE/session \
  | ruby -rjson -e 'puts JSON.parse($stdin.read)["data"]["csrf_token"]')

# 3. Read data
curl -s -b $JAR "$BASE/employees?country_id=1&per_page=5"
curl -s -b $JAR "$BASE/analytics/summary"
curl -s -b $JAR -o salary-report.csv "$BASE/reports/salaries.csv?employment_status=active"

# 4. Write data (always send the token)
curl -s -b $JAR -X PATCH -H "X-CSRF-Token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"employee":{"employment_status":"on_leave"}}' $BASE/employees/1

# 5. Sign out
curl -s -b $JAR -X DELETE -H "X-CSRF-Token: $TOKEN" $BASE/session
```

Sessions end after 30 minutes idle or 8 hours in total. Sign-in is limited to 5 attempts per minute per IP (`429`).

## Testing and quality

```bash
cd backend
bin/rails test                                          # full Minitest suite (246 runs)
bin/rails test test/integration/api/v1/health_test.rb   # a single file
bin/rails test test/integration/api/v1/health_test.rb:13  # a single test (by line)
bin/rubocop                                             # style (rubocop-rails-omakase)
bin/brakeman --no-pager                                 # static security scan
```

- Tests use the `salary_management_test` database (`bin/rails db:test:prepare`).
- Tests run in a single process (`parallelize(workers: 1)` in `test/test_helper.rb`). Rails 8.0's parallel workers are incompatible with minitest 6 and hang (`BACKEND_PLAN.md` K1). The suite takes a few seconds.
- Where tests live:
  - `test/integration/api/v1/` — endpoint tests, route protection, log redaction;
  - `test/models`, `test/services`, `test/queries` — model, service, and query tests;
  - `test/config` — production security settings;
  - `test/lib` — seed and rake tasks.
- The latest results and the requirement → test coverage matrix are in `BACKEND_PLAN.md` (6.1, completion log).

## Troubleshooting

- **Wrong Ruby or missing gems:** run `rvm use 3.2.0` (or your manager's equivalent) in `backend/`, then `bundle install`. Ruby 3.2.0 is past end of life, so on recent macOS `rvm install 3.2.0` may need OpenSSL build flags (e.g. `--with-openssl-dir=$(brew --prefix openssl@3)`).
- **`unknown keyword: quirks_mode` when rendering JSON:** the `json` gem must stay below 3.0 on Rails 8.0. The Gemfile pins `json < 3` (ADR 005); don't update it on its own.
- **Tests hang:** keep `parallelize(workers: 1)`; see K1 above.
- **`Access denied` or unknown database:** check `backend/.env` and the MySQL grants from setup step 2.
- **Login returns `422 invalid_csrf_token`:** send the `X-CSRF-Token` from `GET /session` (and use the new token returned by sign-in for later writes).

## Known limitations

Full details and reasons are in `BACKEND_PLAN.md` (accepted risks R1–R6 under 6.3; findings under 7.1).

- **Runtime support (R1):** Ruby 3.2.0 is past end of life, and Rails 8.0.x support ends on 2026-11-07. Upgrade before using real data.
- **No dependency vulnerability scan (R2):** run `bundle-audit` or enable Dependabot before using real data.
- **Logging (R3):** keep production at `RAILS_LOG_LEVEL=info`. At `debug`, SQL is logged with values (salaries, names).
- **Deployment prerequisites (R4):** set `config.hosts` and make sure the Solid Cache tables exist in production (used by the sign-in rate limit). See architecture §9.
- **CI (R5):** `backend/.github/workflows/ci.yml` is not at the repo root, so it never runs; run the quality commands above manually.
- **No real concurrency tests (R6):** row locks and unique indexes are tested, but not two concurrent requests.
- **Currency:** no conversion; every monetary figure is per currency.
- **History:**
  - country, department, and employment status are current values only, so analytics for a past `as_of` use today's values;
  - salary changes can't be inserted into the middle of a history, and a scheduled record's start date can't be corrected;
  - salary history plus timestamps is the only audit trail.
- **Users:** one HR Manager, no roles, no sign-up or password reset.
- **Reports:**
  - the CSV export is synchronous and capped at 10,000 rows (larger results return `422 export_too_large`);
  - paging uses OFFSET;
  - descending sorts on `hired_on`/`created_at` use a filesort (about 7 ms at 10k rows).
- **Performance figures** in database design §13 are observations on a laptop, not SLAs. The single-column `employment_status` index is redundant after 6.2 and can be dropped (optional).
- **Tests:** single process only (K1). The `json < 3` pin stays until Rails supports json 3.
- **Generated files not used by the API:** the Rails generator's HTML/asset stack (Propshaft, importmap, Turbo, Stimulus, `app/javascript`, HTML layouts, PWA views), mailers, jobs and Solid Queue, Kamal, Thruster, the `Dockerfile`, and `backend/.github/` are kept as generated (G1, G3).

## Documentation

- [Requirements](docs/requirements.md): scope, approved decisions, traceability
- [Architecture](docs/architecture.md): modules, request flows, auth boundary, error contract, deployment prerequisites
- [Database design](docs/database-design.md): schema, integrity rules, query shapes, seed plan, measured performance
- [API specification](docs/api-specification.md): endpoints, payloads, status codes, client integration notes
- Architecture decision records: [001 monorepo](docs/decisions/001-monorepo.md), [002 currency](docs/decisions/002-currency-handling.md), [003 salary history](docs/decisions/003-salary-history.md), [004 authentication](docs/decisions/004-authentication.md), [005 versions and libraries](docs/decisions/005-runtime-versions-and-libraries.md)

## Out of scope

Payroll processing, tax and statutory calculations, salary disbursement, banking/HRMS integrations, advanced role-based access and approval workflows, currency conversion, and AI/LLM features. See `docs/requirements.md` §6.
