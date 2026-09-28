# Salary Management System — Database Design

**Status:** Approved design for migrations (BACKEND_PLAN.md task 1.3)  
**Version:** 2.0 (2026-09-28)  
**Engine:** MySQL 8.0.16+ (8.4 locally), InnoDB, `utf8mb4` / `utf8mb4_0900_ai_ci`

Decision IDs (Dn) refer to `BACKEND_PLAN.md` Phase 1 findings and are summarised in `docs/requirements.md` §10.

## 1. Design goals

- A relational source of truth for employees and effective-dated salary history.
- Amount and currency are always stored together; there are no cross-currency aggregates (ADR 002).
- Salary history is preserved: changes add rows, and only the current record can be corrected (ADR 003, D4).
- Integrity is enforced in the database wherever MySQL can express it, and in a locked transaction where it cannot.
- Schema and indexes sized for about 10,000 employees and about 20,000 salary rows. No speculative denormalisation.
- No payroll, tax, or net-pay data.

## 2. Entity relationship

```mermaid
erDiagram
    COUNTRIES   ||--o{ EMPLOYEES      : "located in"
    DEPARTMENTS ||--o{ EMPLOYEES      : "belongs to"
    EMPLOYEES   ||--o{ SALARY_RECORDS : "has history"
    CURRENCIES  ||--o{ SALARY_RECORDS : denominates

    USERS {
      bigint id PK
      varchar email UK
      varchar password_digest
    }
    COUNTRIES {
      bigint id PK
      char2 code UK
      varchar name UK
    }
    DEPARTMENTS {
      bigint id PK
      varchar name UK
    }
    CURRENCIES {
      char3 code PK
      varchar name
      tinyint minor_units
    }
    EMPLOYEES {
      bigint id PK
      varchar employee_number UK
      varchar first_name
      varchar last_name
      varchar email UK "nullable"
      bigint country_id FK
      bigint department_id FK
      varchar employment_status
      date hired_on "nullable"
    }
    SALARY_RECORDS {
      bigint id PK
      bigint employee_id FK
      decimal amount "18,4 monthly gross base"
      char3 currency_code FK
      date effective_from
      date effective_to "nullable = open-ended"
      tinyint open_flag "generated: 1 or NULL"
    }
```

`USERS` has no relationships; it holds the single HR login (ADR 004). Every table also has `created_at` and `updated_at` (`DATETIME(6)`, NOT NULL), which serve as the audit timestamps (D5).

## 3. Tables

### 3.1 `users`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `id` | BIGINT | no | PK |
| `email` | VARCHAR(255) | no | UNIQUE; stored lower-case |
| `password_digest` | VARCHAR(255) | no | bcrypt hash via `has_secure_password` |

Provisioned only by `rails hr:create_user`, never by seeds.

### 3.2 `countries`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `id` | BIGINT | no | PK |
| `code` | CHAR(2) | no | UNIQUE; ISO 3166-1 alpha-2, upper-case |
| `name` | VARCHAR(100) | no | UNIQUE |

### 3.3 `departments`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `id` | BIGINT | no | PK |
| `name` | VARCHAR(100) | no | UNIQUE |

A flat list with no hierarchy.

### 3.4 `currencies`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `code` | CHAR(3) | no | **PK**; ISO 4217, upper-case (a natural key, so `salary_records.currency_code` is readable without a join) |
| `name` | VARCHAR(64) | no | |
| `minor_units` | TINYINT UNSIGNED | no | `CHECK (minor_units BETWEEN 0 AND 4)`; e.g. JPY 0, USD 2, KWD 3 |

Rails: `create_table :currencies, primary_key: :code, id: { type: :string, limit: 3 }`; the model sets `self.primary_key = "code"`.

### 3.5 `employees`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `id` | BIGINT | no | PK |
| `employee_number` | VARCHAR(20) | no | UNIQUE; upper-case letters, digits, and `-` (e.g. `EMP-00123`) |
| `first_name` | VARCHAR(100) | no | |
| `last_name` | VARCHAR(100) | no | |
| `email` | VARCHAR(255) | yes | UNIQUE (MySQL allows multiple NULLs); stored lower-case (D12) |
| `country_id` | BIGINT | no | FK → `countries.id`, ON DELETE RESTRICT |
| `department_id` | BIGINT | no | FK → `departments.id`, ON DELETE RESTRICT |
| `employment_status` | VARCHAR(20) | no | DEFAULT `'active'`; `CHECK (employment_status IN ('active','on_leave','terminated'))` (D12) |
| `hired_on` | DATE | yes | |

Employees are never deleted; termination is a status change (D13). Country and department are current values only, with no history.

### 3.6 `salary_records`

| Column | Type | Null | Constraints / notes |
|---|---|---|---|
| `id` | BIGINT | no | PK |
| `employee_id` | BIGINT | no | FK → `employees.id`, ON DELETE RESTRICT; read-only after create |
| `amount` | DECIMAL(18,4) | no | `CHECK (amount > 0)`; **monthly gross base** (D3); decimal places ≤ `currencies.minor_units` (model validation, D10) |
| `currency_code` | CHAR(3) | no | FK → `currencies.code`, ON DELETE RESTRICT |
| `effective_from` | DATE | no | Read-only after create |
| `effective_to` | DATE | yes | NULL = open-ended; `CHECK (effective_to IS NULL OR effective_to >= effective_from)`; set only by `Salaries::ChangeService` when closing a period |
| `open_flag` | TINYINT | yes | `GENERATED ALWAYS AS (IF(effective_to IS NULL, 1, NULL)) STORED`; supports the one-open-record index |

Rails: `t.virtual :open_flag, type: :integer, as: "IF(effective_to IS NULL, 1, NULL)", stored: true`; `attr_readonly :employee_id, :effective_from`.

## 4. Indexes

Each index is justified by a query or constraint. MySQL creates an index for every FK automatically, unless an existing index already starts with that column.

| Table | Index | Type | Serves |
|---|---|---|---|
| `users` | `(email)` | UNIQUE | Login lookup |
| `countries` | `(code)`, `(name)` | UNIQUE | Integrity, seed upsert |
| `departments` | `(name)` | UNIQUE | Integrity, seed upsert |
| `employees` | `(employee_number)` | UNIQUE | Identity; `q` match on number; sort |
| `employees` | `(email)` | UNIQUE | Integrity |
| `employees` | `(country_id)` | FK | Country filter, breakdown join |
| `employees` | `(department_id)` | FK | Department filter, breakdown join |
| `employees` | `(employment_status)` | secondary | Status filter; analytics exclude terminated |
| `employees` | `(last_name, first_name)` | secondary | Sort by name |
| `salary_records` | `(employee_id, effective_from)` | UNIQUE | One record per start date; history listing in order; latest-record lookup under lock; FK index for `employee_id` |
| `salary_records` | `(employee_id, open_flag)` | UNIQUE | **At most one open-ended record per employee** (NULLs do not collide) |
| `salary_records` | `(currency_code)` | FK | Currency FK, currency filter |

Not added up front: composite filter indexes on `employees`, sort indexes for `hired_on` and `created_at` (a filesort over about 10k rows is cheap), and an `(effective_from, effective_to)` index. At this scale, as-of scans over about 20k salary rows are cheap. Phase 6.2 will measure with `EXPLAIN ANALYZE` on seeded data and add indexes only where the plans show a need.

## 5. Integrity rules and where they are enforced

| # | Rule | Database | Model validation | Service (locked transaction) |
|---|---|---|---|---|
| I1 | Employee number present and unique | NOT NULL, UNIQUE | presence, format, uniqueness | — |
| I2 | Employee references a valid country and department | FK, NOT NULL | presence | — |
| I3 | Status is one of the allowed values | CHECK | inclusion | — |
| I4 | Amount > 0 | CHECK | numericality | — |
| I5 | Amount scale ≤ currency minor units | — | custom validation | — |
| I6 | Currency exists | FK | presence | — |
| I7 | `effective_to` ≥ `effective_from` | CHECK | comparison | — |
| I8 | One record per employee per start date | UNIQUE | uniqueness | — |
| I9 | At most one open-ended record per employee | UNIQUE on `open_flag` | — | — |
| I10 | No overlapping periods; a new record starts after the latest one | — (MySQL has no exclusion constraints) | overlap check (defence in depth) | `ChangeService`: lock employee row → verify → close prior → insert |
| I11 | Historical records are immutable. Only the amount and currency of the record in effect today, or of a future-dated record, can change (D4 + O1) | `attr_readonly` columns | — | `CorrectionService`: lock → verify editable → update |
| I12 | No hard deletes of employees or salary records | ON DELETE RESTRICT | no destroy routes | — |
| I13 | `effective_from` ≥ `hired_on` when `hired_on` is present. This is enforced both ways: a salary can't start before hire, and an employee update can't move `hired_on` after that employee's earliest salary `effective_from` | — | custom validation on SalaryRecord and Employee | — |

I10 relies on every write going through the services. Direct SQL or console writes could bypass it; the model-level overlap validation catches most of these cases.

## 6. Transactions and concurrency

- **Salary change** (`Salaries::ChangeService`):
  1. `BEGIN`
  2. `SELECT … FROM employees WHERE id = ? FOR UPDATE`
  3. Read the latest record (by `effective_from DESC`).
  4. Reject if `new.effective_from <= latest.effective_from` (D8).
  5. `UPDATE latest SET effective_to = new.effective_from - 1 day`
  6. `INSERT` the new record.
  7. `COMMIT`

  If there is no prior record, only the insert runs.
- **Correction** (`Salaries::CorrectionService`): the same employee-row lock. Verify the record is **editable**, then update `amount` and/or `currency_code`. A record is editable when it is in effect on `Date.current`, or when its `effective_from` is after `Date.current` (future-dated, O1). Records whose period ended before today are historical and rejected.
- **Employee create with an initial salary** (`Employees::CreateService`): both inserts run in one transaction.
- **Isolation:** InnoDB's default `REPEATABLE READ`. The employee-row lock serialises all salary writes for one employee, and the unique indexes (I8, I9) are the backstop if the lock is bypassed.
- Any failure rolls back the whole operation. Constraint violations (`ActiveRecord::RecordNotUnique`, `ActiveRecord::StatementInvalid` from a CHECK) are mapped to `422` with a generic message.

## 7. Query shapes

Every salary read that needs "current salary" uses one shared scope (D7). `:as_of` defaults to `Date.current` (UTC, D9):

```sql
-- SalaryRecord.in_effect_on(as_of)
sr.effective_from <= :as_of AND (sr.effective_to IS NULL OR sr.effective_to >= :as_of)
```

Because periods never overlap (I10), this yields at most one row per employee. Analytics population (D20): join to `employees` with `employment_status IN ('active','on_leave')` by default, plus the optional `country_id`, `department_id`, and `employment_status` filters.

### 7.1 Summary per currency

```sql
SELECT sr.currency_code,
       COUNT(*)       AS employee_count,
       SUM(sr.amount) AS total_monthly,
       AVG(sr.amount) AS average_monthly,
       MIN(sr.amount) AS min_monthly,
       MAX(sr.amount) AS max_monthly
FROM salary_records sr
JOIN employees e ON e.id = sr.employee_id
WHERE <in_effect_on> AND <employee filters>
GROUP BY sr.currency_code;
```

The response's `employees_in_scope` is a `COUNT(*)` of `employees` with the same filters. `employees_without_salary` is that count minus the employees with a salary in effect on the date. Both are `employees`-only counts with no monetary values.

### 7.2 Median per currency (D21)

MySQL has no `MEDIAN()` or `PERCENTILE_CONT`, so the median uses window functions:

```sql
WITH cur AS (
  SELECT sr.currency_code, sr.amount
  FROM salary_records sr JOIN employees e ON e.id = sr.employee_id
  WHERE <in_effect_on> AND <employee filters>
), ranked AS (
  SELECT currency_code, amount,
         ROW_NUMBER() OVER (PARTITION BY currency_code ORDER BY amount) AS rn,
         COUNT(*)     OVER (PARTITION BY currency_code)                 AS cnt
  FROM cur
)
SELECT currency_code, AVG(amount) AS median_monthly
FROM ranked
WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
GROUP BY currency_code;
```

With an odd count this picks the middle row; with an even count it averages the two middle rows. The breakdown uses the same pattern, partitioned by `(dimension, currency_code)`.

### 7.3 Distribution bands per currency (D22)

There are 10 fixed-width bands between each currency's MIN and MAX. A row's band is `LEAST(FLOOR((amount - min) / ((max - min) / 10)), 9)`. The minimum falls in band 0 and the maximum in band 9. If `max = min`, all rows go in a single band. The response returns `lower`, `upper`, and `count` for each band. Bands are lower-inclusive and upper-exclusive, except the last band, which includes its upper edge.

### 7.4 Breakdown (by country or department)

Group by `(e.country_id | e.department_id, sr.currency_code)` and compute the count, total, average, and median (§7.2 pattern). The dimension name comes from joining `countries` or `departments`. The rows are keyed by dimension *and* currency, so an employee paid in USD in Germany appears in the Germany/USD row, not in Germany/EUR.

### 7.5 Salary report (JSON and CSV, D19/D24)

Employees joined to their in-effect salary as of `:as_of` (INNER JOIN, so employees with no salary on that date are excluded), plus the country and department names. It uses the same employee filters as analytics plus `q`. Sorting is by `employee_number` by default, or by `last_name` or `(currency_code, amount)` from the API allowlist, always with `id` as the tie-breaker. The JSON form is paginated. The CSV is read in batches of 1,000 and capped at 10,000 rows.

### 7.6 Employee search

`q` is matched with `LIKE` against `employee_number`, `first_name`, and `last_name`. The input is escaped with `sanitize_sql_like`, and the `_ai_ci` collation makes the match case- and accent-insensitive. The match is a contains match (`%q%`), which scans the table; that is acceptable at about 10k rows (D27) and will be re-checked in Phase 6.2.

### 7.7 Rounding

SQL returns exact `DECIMAL` values. Serializers round each monetary aggregate to the currency's `minor_units` with half-up rounding and return it as a string. Rounding is display-only; stored amounts are never rounded.

## 8. Reference data

The seeded set supports the demo and tests. Adding to it later is a seed change, not a schema change.

| Country | Code | Currency (minor units) |
|---|---|---|
| United States | US | USD (2) |
| United Kingdom | GB | GBP (2) |
| Germany | DE | EUR (2) |
| France | FR | EUR (2) |
| India | IN | INR (2) |
| Japan | JP | JPY (0) |
| Singapore | SG | SGD (2) |
| Kuwait | KW | KWD (3) |

JPY and KWD are included on purpose, to exercise 0- and 3-decimal precision (D10).

Departments: Engineering, Finance, Human Resources, Marketing, Operations, Sales, Legal, Customer Support.

## 9. Synthetic seed strategy

- **Deterministic:** a fixed random seed for Faker and Ruby's `Random` (42), so every run produces the same data.
- **Volume:** 10,000 employees; about 18,000 salary records.
- **Distribution:**
  - Employees are spread across all 8 countries.
  - About 95% are paid in their country's currency and about 5% in USD (D11: the salary currency is not tied to the employee's country).
  - Statuses: about 90% active, 4% on leave, 6% terminated.
  - About 60% of employees have one salary record, about 38% have two to four, about 2% have a future-dated raise (D6), and about 1% have no salary (D14).
  - Monthly amounts fall in plausible ranges per currency and respect each currency's minor units.
- **Loading:** reference data via `upsert_all` keyed on `code`/`name`. Employees and salaries via `insert_all` in batches of 1,000, all in one transaction. History rows are generated already closed, so they satisfy I7–I10 without going through the service.
- **Re-runs:** `db:seed` stops with a clear message if employees already exist. `SEED_RESET=1 bin/rails db:seed` truncates the domain tables first (development only; it refuses to run in production). `users` is never touched.
- **Tests:** tests use FactoryBot factories, never the seed file.

## 10. Trade-offs

| Choice | Alternative | Reason |
|---|---|---|
| Currency code as the natural PK | Surrogate `id` | Readable FK, and the value is immutable |
| Generated `open_flag` + UNIQUE | Partial unique index (PostgreSQL only) | MySQL has no partial indexes; a generated column gives the same guarantee |
| Overlap checked in a locked service | Triggers | Triggers hide logic and are hard to test; one service owns the rule |
| `DECIMAL(18,4)` | `DECIMAL(15,2)` | Supports 3-decimal currencies; 14 integer digits is ample for monthly pay |
| Median via window functions | Median computed in Ruby | Stays in SQL and scales with filters; covered by known-data specs |
| No country or department history | Effective-dated org tables | Not required (docs/requirements.md §7) |

## 11. Rules added during design (approved 2026-09-28)

- **I13 (approved):** `effective_from` must not precede `hired_on` when `hired_on` is present.
- **O1 (approved):** besides the record in effect today, a **future-dated** record (with `effective_from` after today) can have its `amount` and `currency_code` corrected, because it has not taken effect yet and is not history. Dates remain read-only. A future record with a wrong start date cannot be fixed in v1; this limitation is documented.
- **Termination:** setting an employee to `terminated` does not close their open salary record. They drop out of analytics through the status filter instead.
