# ADR 005: Runtime Versions and Backend Libraries

- **Status:** Accepted (revised 2026-09-28 to match the generated application; amended 2026-09-30 for bulk salary correction)
- **Date:** 2026-09-28
- **Related:** BACKEND_PLAN.md D25, D26 and Phase 2 findings (E and G items); `.claude/rules/backend.md` ("Use JSON builder for API responses", "Do not add dependencies without justification")

## Context

The project owner generated `backend/` with the Rails 8 default generator, not the API-only Rails 7.2 setup this ADR originally proposed. This revision records what was generated, marks what is adopted, and lists what still needs a decision. The earlier version (Ruby 3.1.2 / Rails 7.2, no serializer or pagination gems) is superseded.

## Decision

**Versions**

| Component | Version | Source |
|---|---|---|
| Ruby | 3.2.0 via RVM | `backend/.ruby-version` |
| Rails | 8.0.5.1 (`~> 8.0.5`) | `Gemfile`, `Gemfile.lock` |
| MySQL | 8.4 local (8.0.16+ required for CHECK constraints) | Homebrew service |
| Rails defaults | `config.load_defaults 8.0` | `config/application.rb` |

**Adopted runtime gems**

| Gem | Justification |
|---|---|
| `mysql2`, `puma`, `bootsnap`, `tzinfo-data` | Rails defaults for the database adapter, app server, and boot performance |
| `jbuilder` | JSON response rendering, replacing the planned plain-Ruby serializers; required by `.claude/rules/backend.md` |
| `pagy` (~> 43.0) | Pagination for employee and report listings, replacing the planned hand-rolled concern |
| `dotenv-rails` | Loads the local `.env` file (owner decision E3). Kept in the default group by owner decision (G4) |
| `solid_cache` | MySQL-backed `Rails.cache`. Also serves as the store for login `rate_limit` (ADR 004), so no Redis is needed |
| `solid_queue` | MySQL-backed Active Job adapter. No jobs are planned; kept as the Rails 8 default with no extra infrastructure |
| `bcrypt` (~> 3.1.7) | `has_secure_password` for the HR login (ADR 004); added 2026-09-28 in 4.1 (L3) |
| `csv` (~> 3.2) | Reads bulk upload CSV files and writes the response CSV and template (FR-08). Listed explicitly because `csv` stops being a default gem in Ruby 3.4; added 2026-09-30 |
| `roo` (~> 3.0) | Reads `.xlsx` bulk uploads (first sheet, typed date and number cells). Uses the already-locked `rubyzip` 3 and `nokogiri`; added 2026-09-30 |
| `caxlsx` (~> 4.5) | Writes the `.xlsx` bulk upload template, and `.xlsx` fixtures in tests. Compatible with `rubyzip` 3; added 2026-09-30 |

**Adopted development/test gems:** `debug`, `brakeman` (security scan), `rubocop-rails-omakase` (style), `faker` (synthetic data for factories and development demo seeds; added 2026-09-28, J1), `web-console`. Test-only: `capybara`, `selenium-webdriver`, `factory_bot_rails` (factories for employees and salary records; added 2026-09-28, J1). Reference data in tests comes from Rails fixtures.

**Backend test framework:** Minitest, as generated (`backend/test/`, run with `bin/rails test`). The owner reverted G2 on 2026-09-28. `rspec-rails` is not used.

**Removed on 2026-09-28:** `solid_cable` and `db/cable_schema.rb` (G3: no WebSocket use case; production Action Cable uses the in-process `async` adapter).

**Generated and kept as is by owner decision (2026-09-28)**

| Item | Issue | Decision ID |
|---|---|---|
| `propshaft`, `importmap-rails`, `turbo-rails`, `stimulus-rails`, `app/views` layouts, `app/assets`, `app/javascript` | Full-stack server-rendered frontend. CLAUDE.md specifies a separate React frontend and the architecture is an API-only backend | G1 |
| `kamal`, `thruster`, `Dockerfile`, `.kamal/`, `backend/.github/` | Deployment and CI artefacts, unused until the owner's Docker phase. `.github/` inside `backend/` is ignored by GitHub | G3 |

**Deliberately not added:** Devise, JWT, Pundit (ADR 004); Redis and Sidekiq (Solid Cache and Solid Queue cover the needs); `rack-cors` (same-site frontend, ADR 004).

## Consequences

- **Ruby 3.2 is past its end of life.** Ruby 3.2's security maintenance was scheduled to end on 2026-03-31, and `3.2.0` is its first patch release. This is acceptable only for an assessment with synthetic data. The owner kept 3.2.0 (G6); move to a supported Ruby before any real data is used.
- **Brakeman support warnings accepted (owner, 2026-09-28):** "Ruby 3.2.0 support ended 2026-03-31" (High) and "Rails 8.0.5.1 support ends 2026-11-07" (Weak). Both are recorded with notes in `backend/config/brakeman.ignore`, so `bin/brakeman` still reports any new warning. Plan a Ruby and Rails upgrade before real data is used or before 2026-11-07 if the project continues.
- `json` is constrained to `< 3` in the Gemfile: json 3.x removed the `quirks_mode` option that ActiveSupport 8.0 still passes, which breaks JSON rendering. Remove the constraint once Rails supports json 3.
- Rails 8's built-in `rate_limit` and Solid Cache replace the in-process cache concern noted in the architecture.
- JSON shapes live in `app/views/api/v1/**/*.json.jbuilder`, and the rounding of monetary aggregates happens there.
- The CSV export (BACKEND_PLAN.md 5.3) and bulk uploads use Ruby's `csv` library. It is now listed in the Gemfile (2026-09-30), so the Ruby 3.4 change from default gem to bundled gem needs no further action.
- **Active Storage** (part of `rails/all`, no new gem) stores bulk upload files on the `local` disk service. Its tables were installed on 2026-09-30 (`active_storage:install`). Its built-in `/rails/active_storage/*` routes serve files only for signed IDs, which the API never returns; downloads go through the authenticated bulk endpoints.
- Legacy `.xls` files are not supported: that would need `roo-xls` and the older `spreadsheet` gem.
- Any further gem needs an amendment to this ADR with a justification.
