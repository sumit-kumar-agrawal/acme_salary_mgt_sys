# Salary Management System — API Specification

**Status:** Approved contract for implementation (BACKEND_PLAN.md task 1.4)  
**Version:** 2.0 (2026-09-28)  
**Base path:** `/api/v1`

Decision IDs (Dn, In, O1) refer to `BACKEND_PLAN.md` Phase 1 findings and `docs/database-design.md`. Architecture context is in `docs/architecture.md`, and authentication is covered by ADR 004.

## 1. Conventions

| Topic | Rule |
|---|---|
| Format | JSON request and response bodies (`Content-Type: application/json`). The CSV export is the only exception. |
| Authentication | Session cookie (ADR 004). Every endpoint requires login except `GET /health`, `GET /session`, and `POST /session`. |
| CSRF | Every `POST`, `PATCH`, and `DELETE` must send the `X-CSRF-Token` header, using the token from `GET /session` or from the login response. |
| Dates | ISO 8601 `YYYY-MM-DD`. "Today" is the current date in UTC (D9). |
| Money | A decimal **string** paired with `currency_code`, e.g. `"amount": "85000.00", "currency_code": "INR"`. Every amount is **monthly gross base pay** (D3). Aggregates are rounded to the currency's minor units. |
| Currencies | Monetary aggregates are always per currency. There is never a combined cross-currency total (ADR 002). |
| Parameters | Request bodies are wrapped in a resource key (`employee`, `salary_record`). Unknown keys are ignored. Invalid filter, sort, or pagination values return `400`, never a silent default. |
| IDs | Numeric `id`s, except currencies, which are identified by `code`. |
| Collections | Resource collections are paginated (§2.3). Reference lists and one employee's salary history are small and bounded, so they are returned unpaginated. |
| Privacy | Employee lists exclude salary and email (D18). Salary appears only in employee detail, salary, analytics, and report endpoints. Errors never echo submitted values or record data. |

## 2. Common response shapes

### 2.1 Single resource

```json
{ "data": { "id": 123, "employee_number": "EMP-00123" } }
```

### 2.2 Error envelope

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Please correct the highlighted fields.",
    "details": { "employee_number": ["has already been taken"] }
  }
}
```

`details` appears only for `validation_failed` and `bad_request`. It maps parameter or attribute names to messages and never includes submitted values.

### 2.3 Pagination

Query parameters: `page` (integer ≥ 1, default 1) and `per_page` (integer 1–100, default 25, D23). Values outside these ranges return `400`.

```json
{
  "data": [],
  "meta": { "page": 1, "per_page": 25, "total_count": 0, "total_pages": 0 }
}
```

A `page` past the last page returns an empty `data` array with correct `meta`.

### 2.4 Sorting

`sort=<field>` sorts ascending; `sort=-<field>` sorts descending. Only the fields each endpoint allows are accepted; anything else returns `400` with `details.sort`. Ties are always broken by `id` so pagination stays stable.

## 3. Health

### `GET /health` (public)

`200`:

```json
{ "data": { "status": "ok", "database": "ok" } }
```

Returns `503` with `{"data":{"status":"error","database":"unavailable"}}` if the database cannot be reached. No version or environment details are exposed.

## 4. Session (authentication)

### `GET /session` (public)

Returns the login state and a CSRF token.

```json
{ "data": { "authenticated": false, "user": null, "csrf_token": "…" } }
```

When logged in: `"authenticated": true, "user": { "email": "hr@example.test" }`.

### `POST /session` (public, CSRF required)

```json
{ "email": "hr@example.test", "password": "••••••••" }
```

| Result | Status | Body |
|---|---|---|
| Success | 200 | `{"data":{"authenticated":true,"user":{"email":"hr@example.test"},"csrf_token":"…"}}` plus a new session cookie. The session is reset first to prevent fixation. |
| Wrong email or password | 401 | `invalid_credentials`. The message is the same for both, so it does not reveal which one was wrong. |
| More than 5 attempts per minute from one IP | 429 | `rate_limited` |

### `DELETE /session`

Ends the session. `204`, no body.

**Session expiry:** after 30 minutes idle or 8 hours total, the next request returns `401 unauthenticated`.

## 5. Reference data (read-only, D15)

| Method | Path | Response `data` items | Order |
|---|---|---|---|
| `GET` | `/countries` | `{ "id": 1, "code": "IN", "name": "India" }` | name |
| `GET` | `/departments` | `{ "id": 3, "name": "Engineering" }` | name |
| `GET` | `/currencies` | `{ "code": "INR", "name": "Indian Rupee", "minor_units": 2 }` | code |

These lists are unpaginated because they are small, fixed, and seeded. There are no write endpoints.

## 6. Employees

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/employees` | Search, filter, sort, and paginate employees |
| `POST` | `/employees` | Create an employee, optionally with an initial salary |
| `GET` | `/employees/:id` | Employee detail, including the current salary |
| `PATCH` | `/employees/:id` | Update employee fields |

There is no `DELETE`: to remove an employee, set `employment_status` to `terminated` (D13).

### 6.1 `GET /employees`

| Parameter | Type | Rule |
|---|---|---|
| `q` | string | 1–100 characters. Case-insensitive *contains* match on `employee_number`, `first_name`, and `last_name`. |
| `country_id` | integer | Must be an existing country, otherwise `400` |
| `department_id` | integer | Must be an existing department, otherwise `400` |
| `employment_status` | string | `active`, `on_leave`, or `terminated`. When omitted, all statuses are returned. |
| `sort` | string | `employee_number` (default), `last_name`, `hired_on`, `created_at`, each with an optional `-` prefix |
| `page`, `per_page` | integer | §2.3 |

`200`. Items contain no salary and no email (D18):

```json
{
  "data": [
    {
      "id": 123,
      "employee_number": "EMP-00123",
      "first_name": "Asha",
      "last_name": "Rao",
      "country": { "id": 5, "code": "IN", "name": "India" },
      "department": { "id": 3, "name": "Engineering" },
      "employment_status": "active",
      "hired_on": "2021-04-12"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total_count": 1, "total_pages": 1 }
}
```

### 6.2 `GET /employees/:id`

`200`. Adds `email`, `current_salary`, and timestamps. `current_salary` is the record in effect today (D7), or `null` if there isn't one.

```json
{
  "data": {
    "id": 123,
    "employee_number": "EMP-00123",
    "first_name": "Asha",
    "last_name": "Rao",
    "email": "asha.rao@example.test",
    "country": { "id": 5, "code": "IN", "name": "India" },
    "department": { "id": 3, "name": "Engineering" },
    "employment_status": "active",
    "hired_on": "2021-04-12",
    "current_salary": {
      "id": 456,
      "amount": "85000.00",
      "currency_code": "INR",
      "period": "monthly",
      "effective_from": "2026-04-01",
      "effective_to": null
    },
    "created_at": "2026-09-28T10:15:00Z",
    "updated_at": "2026-09-28T10:15:00Z"
  }
}
```

### 6.3 `POST /employees`

```json
{
  "employee": {
    "employee_number": "EMP-10001",
    "first_name": "Asha",
    "last_name": "Rao",
    "email": "asha.rao@example.test",
    "country_id": 5,
    "department_id": 3,
    "employment_status": "active",
    "hired_on": "2026-10-01",
    "initial_salary": {
      "amount": "85000.00",
      "currency_code": "INR",
      "effective_from": "2026-10-01"
    }
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `employee_number` | yes | Unique. 1–20 characters: `A–Z`, `0–9`, and `-`. Upper-cased on save. |
| `first_name`, `last_name` | yes | 1–100 characters |
| `email` | no | Valid format, unique, lower-cased on save |
| `country_id`, `department_id` | yes | Must exist |
| `employment_status` | no | Defaults to `active`; must be one of the allowed values |
| `hired_on` | no | Date |
| `initial_salary` | no | If present, it is validated like §7.3 and created in the **same transaction** as the employee (D14) |

Responses: `201` with the §6.2 body. `422 validation_failed` returns field errors; errors on the salary use the prefix `initial_salary.` (e.g. `"initial_salary.amount": ["must be greater than 0"]`). If anything fails, nothing is created.

Error `details` use the request's field names: a missing or unknown country or department is reported under `country_id` / `department_id`, and an unknown salary currency under `initial_salary.currency_code`. An unparseable `hired_on` is `422` (`"must be a date in YYYY-MM-DD format"`), not silently ignored. A body without the `employee` key is `400` with `"details": {"employee": ["is required"]}`. Unknown fields (e.g. `id`, `created_at`) are ignored.

### 6.4 `PATCH /employees/:id`

The permitted fields are those in §6.3 except `initial_salary`, and any subset may be sent. Salary is never changed through this endpoint; use §7.

Responses: `200` with the §6.2 body, `404`, or `422`. Changing `hired_on` to a date after the employee's earliest salary `effective_from` returns `422` (`"hired_on": ["must not be after the first salary start date"]`, rule I13).

## 7. Salary records

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/employees/:employee_id/salary_records` | Full salary history |
| `POST` | `/employees/:employee_id/salary_records` | Salary change: add a record and close the previous period |
| `GET` | `/employees/:employee_id/salary_records/:id` | One record |
| `PATCH` | `/employees/:employee_id/salary_records/:id` | Correct `amount` or `currency_code` of an editable record |

There is no `DELETE`. A record belonging to a different employee returns `404`.

### 7.1 Record representation

```json
{
  "id": 456,
  "employee_id": 123,
  "amount": "85000.00",
  "currency_code": "INR",
  "period": "monthly",
  "effective_from": "2026-04-01",
  "effective_to": null,
  "status": "current",
  "editable": true,
  "created_at": "2026-03-20T09:00:00Z",
  "updated_at": "2026-03-20T09:00:00Z"
}
```

| `status` | Meaning (relative to today) | `editable` |
|---|---|---|
| `current` | In effect today | `true` |
| `scheduled` | `effective_from` is after today | `true` (O1) |
| `historical` | `effective_to` is before today | `false` |

### 7.2 `GET /employees/:employee_id/salary_records`

`200`, `{"data":[record, …]}`, ordered by `effective_from` descending. The list is unpaginated because one employee's history is bounded.

### 7.3 `POST /employees/:employee_id/salary_records` (salary change)

```json
{ "salary_record": { "amount": "92000.00", "currency_code": "INR", "effective_from": "2027-04-01" } }
```

| Field | Rules |
|---|---|
| `amount` | Required. Decimal string or number, greater than 0, with no more decimal places than the currency's `minor_units` (D10). |
| `currency_code` | Required. Must be an existing currency code. |
| `effective_from` | Required date. Must be **after** the employee's latest record's `effective_from` (D8), and not before `hired_on` if set (I13). |

In one transaction, the latest record is closed at `effective_from − 1 day` and the new record is created open-ended.

Responses:
- `201` with the new record.
- `404` if the employee is unknown.
- `422 validation_failed`, e.g. `"effective_from": ["must be after the latest salary record's start date"]`.

Future-dated changes are allowed (D6) and appear with `status: "scheduled"`.

### 7.4 `GET /employees/:employee_id/salary_records/:id`

`200` with the record, or `404`.

### 7.5 `PATCH /employees/:employee_id/salary_records/:id` (correction)

```json
{ "salary_record": { "amount": "86000.00" } }
```

- Permitted fields are `amount` and/or `currency_code`, validated as in §7.3.
- Sending `effective_from` or `effective_to` returns `422` with `details` such as `"effective_from": ["cannot be changed"]`.
- Allowed only for records with `status` `current` or `scheduled` (D4 + O1).

Responses:
- `200` with the updated record.
- `404`.
- `422 validation_failed`.
- `422 salary_record_not_editable` for a historical record.

## 8. Analytics

All analytics endpoints are read-only aggregates and never return individual salaries.

### 8.1 Common parameters and population (D20)

| Parameter | Type | Rule |
|---|---|---|
| `as_of` | date | Defaults to today. Selects each employee's salary in effect on this date. |
| `country_id` | integer | Optional, must exist |
| `department_id` | integer | Optional, must exist |
| `employment_status` | string | Optional. When omitted, `active` and `on_leave` are included and `terminated` is excluded (D13). When given, only that status is included. |

Population: employees matching the filters who have a salary in effect on `as_of`. Every response echoes the applied `as_of`, `filters`, and `period: "monthly"`.

### 8.2 `GET /analytics/summary`

```json
{
  "data": {
    "as_of": "2026-09-28",
    "period": "monthly",
    "filters": { "country_id": null, "department_id": null, "employment_status": ["active", "on_leave"] },
    "employees_in_scope": 9400,
    "employees_without_salary": 94,
    "by_currency": [
      {
        "currency_code": "INR",
        "employee_count": 1180,
        "total": "105020000.00",
        "average": "89000.00",
        "median": "84500.00",
        "min": "30000.00",
        "max": "450000.00"
      }
    ]
  }
}
```

`employees_in_scope` counts employees who match the filters. `employees_without_salary` is the subset with no salary in effect on `as_of`; they are excluded from every monetary metric. `by_currency` is ordered by `currency_code`.

Metric definitions:
- `total` is the sum of the monthly amounts.
- `average` is the arithmetic mean.
- `median` is the middle value, or the mean of the two middle values when the count is even (D21).
- `min` and `max` are the lowest and highest amounts.
- All metrics are computed within one currency.

### 8.3 `GET /analytics/distribution`

Ten fixed-width bands per currency, between that currency's min and max (D22).

```json
{
  "data": {
    "as_of": "2026-09-28",
    "period": "monthly",
    "filters": { "country_id": null, "department_id": null, "employment_status": ["active", "on_leave"] },
    "by_currency": [
      {
        "currency_code": "INR",
        "employee_count": 1180,
        "bands": [
          { "lower": "30000.00", "upper": "72000.00", "count": 410 },
          { "lower": "72000.00", "upper": "114000.00", "count": 388 }
        ]
      }
    ]
  }
}
```

Each band includes its `lower` value and excludes its `upper` value, except the last band, which includes both. If all amounts are equal, there is a single band. A currency with no employees in scope is omitted.

### 8.4 `GET /analytics/breakdown`

Additional required parameter: `by`, either `country` or `department`. If missing or invalid, the response is `400`.

```json
{
  "data": {
    "as_of": "2026-09-28",
    "period": "monthly",
    "by": "country",
    "filters": { "country_id": null, "department_id": null, "employment_status": ["active", "on_leave"] },
    "rows": [
      {
        "dimension": { "id": 3, "code": "DE", "name": "Germany" },
        "currency_code": "EUR",
        "employee_count": 1100,
        "total": "6050000.00",
        "average": "5500.00",
        "median": "5300.00"
      },
      {
        "dimension": { "id": 3, "code": "DE", "name": "Germany" },
        "currency_code": "USD",
        "employee_count": 52,
        "total": "338000.00",
        "average": "6500.00",
        "median": "6400.00"
      }
    ]
  }
}
```

Rows are keyed by **dimension and currency**, so an employee paid in USD in Germany is counted in Germany/USD (D11). `dimension.code` is present for countries only. Rows are ordered by dimension name, then currency code.

## 9. Salary report and CSV export (FR-04, FR-06)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/reports/salaries` | Paginated record-level salary report (JSON) |
| `GET` | `/reports/salaries.csv` | The same report as a CSV download |

Both endpoints accept identical filters and share one query object, so the displayed rows and the exported rows are always the same set (D19):

- the parameters in §8.1 (`as_of`, `country_id`, `department_id`, `employment_status`, with the same default population);
- `q` as in §6.1;
- `sort`: `employee_number` (default), `last_name`, `amount`, each with an optional `-` prefix. Sorting by `amount` groups rows by `currency_code` first.

Rows include only employees with a salary in effect on `as_of`.

### 9.1 JSON

`GET /reports/salaries?country_id=5&page=1&per_page=25` returns `200`:

```json
{
  "data": [
    {
      "employee_id": 123,
      "employee_number": "EMP-00123",
      "first_name": "Asha",
      "last_name": "Rao",
      "country": { "code": "IN", "name": "India" },
      "department": { "name": "Engineering" },
      "employment_status": "active",
      "amount": "85000.00",
      "currency_code": "INR",
      "period": "monthly",
      "effective_from": "2026-04-01"
    }
  ],
  "meta": {
    "page": 1, "per_page": 25, "total_count": 1180, "total_pages": 48,
    "as_of": "2026-09-28",
    "filters": { "country_id": 5, "department_id": null, "employment_status": ["active", "on_leave"], "q": null }
  }
}
```

### 9.2 CSV

The CSV takes the same parameters, except `page` and `per_page`, which are ignored.

- **Headers:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="salary-report-2026-09-28.csv"`, and `Cache-Control: no-store`.
- **Columns (fixed allowlist, no email):** `employee_number, first_name, last_name, country_code, country_name, department, employment_status, monthly_amount, currency_code, effective_from`
- **Formula-injection guard:** any cell beginning with `=`, `+`, `-`, `@`, a tab, or a carriage return is prefixed with `'`.
- **Row cap:** 10,000 rows (D24). If the filtered set is larger, the response is `422` with code `export_too_large` and the message "Narrow the filters to export at most 10,000 rows." Nothing is truncated silently.
- **No login:** `401` returns the JSON error envelope, not a CSV.

## 10. Status and error codes

| Status | `code` | When |
|---|---|---|
| 200 | — | Successful read, update, or login |
| 201 | — | Employee or salary record created |
| 204 | — | Logout |
| 400 | `bad_request` | Missing wrapper key; invalid filter, sort, pagination, `by`, or date parameter; unknown filter ID |
| 401 | `unauthenticated` | No session or expired session |
| 401 | `invalid_credentials` | Login failed |
| 403 | — | Reserved; not used in v1 (D17) |
| 404 | `not_found` | Unknown route or record, or a salary record belonging to another employee. Generic message. |
| 422 | `validation_failed` | Field validation failure, including a date field sent to a correction |
| 422 | `salary_record_not_editable` | Correction attempted on a historical record |
| 422 | `export_too_large` | CSV would exceed 10,000 rows |
| 422 | `invalid_csrf_token` | CSRF token missing or wrong on a state-changing request |
| 429 | `rate_limited` | Login attempts exceeded |
| 500 | `internal_error` | Unexpected error. Generic message; details are logged only. |
| 503 | — | `GET /health` when the database is unavailable |

## 11. Endpoint summary

| Method | Path | Auth | Phase |
|---|---|---|---|
| GET | `/health` | public | 2.2 |
| GET, POST, DELETE | `/session` | GET/POST public | 4.1 |
| GET | `/countries`, `/departments`, `/currencies` | required | 4.3 |
| GET, POST | `/employees` | required | 4.3 |
| GET, PATCH | `/employees/:id` | required | 4.3 |
| GET, POST | `/employees/:employee_id/salary_records` | required | 4.4 |
| GET, PATCH | `/employees/:employee_id/salary_records/:id` | required | 4.4 |
| GET | `/analytics/summary`, `/analytics/distribution`, `/analytics/breakdown` | required | 5.2 |
| GET | `/reports/salaries`, `/reports/salaries.csv` | required | 5.2, 5.3 |

No payroll, tax, disbursement, integration, or bulk-import endpoints exist.

## 12. Integration test expectations (Minitest)

- **Auth:** every protected route returns `401` without a session. Login succeeds and fails with a generic message. Rate limiting returns `429`. Missing CSRF returns `422`. Logout ends the session. Session expiry returns `401`.
- **Employees:** required fields and formats; unique number and email; filter combinations; sort allowlist (`400` otherwise); `per_page` cap; list payload has no salary and no email; transactional create with `initial_salary` (a failed salary means no employee is created); no delete route.
- **Salary:**
  - A change closes the prior period at `effective_from − 1`.
  - Backdated or same-date changes return `422`; a date before `hired_on` returns `422`.
  - Scale must match `minor_units` (JPY 0, KWD 3).
  - Future-dated records show as `scheduled`.
  - Current and scheduled records can be corrected. A historical record returns `422 salary_record_not_editable`, and a date field returns `422`.
  - A salary record of another employee returns `404`.
- **Analytics:** per-currency totals are correct on known data; no cross-currency total appears; median is correct for odd and even counts; `as_of` handling; terminated employees are excluded by default; band edges and counts; breakdown is keyed by dimension and currency; `by` is validated.
- **Reports:** JSON and CSV return the same rows for the same filters; CSV columns follow the allowlist; formula cells are escaped; a result over 10,000 rows returns `422`; unauthenticated CSV requests return a JSON `401`.
- **Privacy:** error bodies contain no submitted values; salary fields are filtered from logs.
