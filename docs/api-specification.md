# Salary Management System — API Specification

**Status:** Implemented through Phase 6 (2026-09-29), plus bulk salary correction (§9A, 2026-09-30); the contract for the frontend. Changes since v2.0 are listed in §14\
**Version:** 2.6 (2026-09-30)\
**Base path:** `/api/v1`

Decision IDs (Dn, In, O1) refer to `BACKEND_PLAN.md` Phase 1 findings and `docs/database-design.md`. Architecture context is in `docs/architecture.md`, and authentication is covered by ADR 004.

## 1. Conventions

| Topic | Rule |
|---|---|
| Format | JSON request and response bodies (`Content-Type: application/json`). Exceptions: the CSV export (§9.2), and the bulk correction upload (`multipart/form-data`) and its file downloads (§9A). |
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

`details` appears only for `validation_failed`, `bad_request`, and `invalid_file_header` (§9A.3). It maps parameter or attribute names to messages and never includes submitted values.

### 2.3 Pagination

Query parameters: `page` (integer 1–1,000,000, default 1) and `per_page` (integer 1–100, default 25, D23). Values outside these ranges return `400`. The `page` cap keeps the database offset in range and is far beyond any real list.

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

All analytics endpoints are read-only aggregates and never return individual salaries. Responses (and the §9 report) carry `Cache-Control: no-store` because they contain salary data. There is no minimum group size: the single HR Manager may already see individual salaries through the report, so a group of one is not suppressed (revisit if a second role is added).

### 8.1 Common parameters and population (D20)

| Parameter | Type | Rule |
|---|---|---|
| `as_of` | date | Defaults to today. Selects each employee's salary in effect on this date. |
| `country_id` | integer | Optional, must exist |
| `department_id` | integer | Optional, must exist |
| `employment_status` | string | Optional. When omitted, `active` and `on_leave` are included and `terminated` is excluded (D13). When given, only that status is included. |

Population: employees matching the filters who have a salary in effect on `as_of`. Every response echoes the applied `as_of`, `filters`, and `period: "monthly"`. In `filters`, `employment_status` is always an array (`["active", "on_leave"]` by default), and absent IDs are `null`.

Country, department, and employment status are **current** values with no history. For a past `as_of`, the filters apply today's values, so employees terminated since then are excluded by default. Employees whose `hired_on` is after `as_of` are not in scope; an employee with no `hired_on` is.

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

`employees_in_scope` counts employees who match the filters and were hired on or before `as_of`. `employees_without_salary` is the subset with no salary in effect on `as_of`; they are excluded from every monetary metric. `by_currency` is ordered by `currency_code`.

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

Each band includes its `lower` value and excludes its `upper` value, except the last band, which includes both. All ten bands are returned, including bands with `count: 0`. If all amounts are equal, there is a single band. Band membership uses the exact edges; `lower` and `upper` are rounded (half up) to the currency's minor units for display only. A currency with no employees in scope is omitted.

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
- `sort`: `employee_number` (default), `last_name` (then `first_name`), `amount`, each with an optional `-` prefix. Sorting by `amount` groups rows by `currency_code` first (always ascending); the `-` prefix reverses only the amount order. Ties are broken by employee `id`.

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

- **Headers:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="salary-report-<as_of>.csv"` (e.g. `salary-report-2026-09-28.csv`; the date is the applied `as_of`), and `Cache-Control: no-store`.
- **Body:** a UTF-8 byte-order mark, a header row with the column names below, then one row per employee in the same order as the JSON report. `monthly_amount` is rounded to the currency's minor units, with no thousands separator. Dates are `YYYY-MM-DD`. An empty result is a header-only file.
- **Columns (fixed allowlist, no email):** `employee_number, first_name, last_name, country_code, country_name, department, employment_status, monthly_amount, currency_code, effective_from`
- **Formula-injection guard:** any cell beginning with `=`, `+`, `-`, `@`, a tab, or a carriage return is prefixed with `'`.
- **Row cap:** 10,000 rows (D24). If the filtered set is larger, the response is `422` with code `export_too_large` and the message "Narrow the filters to export at most 10,000 rows." Nothing is truncated silently.
- **Errors:** `400`, `401`, and `422` return the JSON error envelope, not a CSV.
- **Formats:** only `/reports/salaries` accepts `.csv`. Other extensions (e.g. `.xml`) return `404`; analytics endpoints always answer JSON.

## 9A. Bulk salary correction

Corrects existing salary records or creates new scheduled salaries from one CSV or Excel (`.xlsx`) upload. An existing employee/date pair follows the single correction rules (§7.5): only `amount` and `currency_code` change, dates never change, and historical records cannot be corrected. A missing pair creates a scheduled salary using the salary change rules (§7.3), with an additional requirement that the start date be after today (UTC). The date must also be after the employee’s latest salary start date. The previous period is closed on the day before the new start; its amount and currency are preserved. Status `scheduled` is derived from the future effective date, as for other salary records (§7.1). Every upload is kept as a history record with the original file and, when rows fail, a file of the failed rows.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/bulk_salary_corrections/template` | Download an empty template (header row only) |
| `POST` | `/bulk_salary_corrections` | Upload a file and process it |
| `GET` | `/bulk_salary_corrections` | Upload history, paginated, newest first |
| `GET` | `/bulk_salary_corrections/:id` | One upload |
| `GET` | `/bulk_salary_corrections/:id/original_file` | Download the uploaded file |
| `GET` | `/bulk_salary_corrections/:id/response_file` | Download the failed rows (`404` when no failed-rows attachment exists) |

All endpoints require sign-in. The upload is a `POST`, so it needs `X-CSRF-Token` (§1).

### 9A.1 Workflow

1. **Get the template.** `GET /bulk_salary_corrections/template` (CSV) or `?file_format=xlsx`.
2. **Fill in one row per salary record to correct.** Use an existing employee number and `effective_from` date to correct a record, or a new future date to schedule a salary. Provide the `amount` and `currency_code`. List multiple new dates for one employee in ascending order; rows are processed in file order.
3. **Upload the file** with `POST /bulk_salary_corrections`.
4. **Read the result.** The response gives the status and download paths. Valid rows are saved even when other rows fail.
5. **Fix failed rows, if a download is available.** Download `response_file_path`, correct the rows using its `errors` column, and upload that same file again. It holds only the failed rows, so rows that were already saved are not applied twice.

### 9A.2 File format

| Rule | Detail |
|---|---|
| File types | `.csv` (UTF-8; a byte-order mark is allowed) or `.xlsx`. Legacy `.xls` is not accepted. The extension must match the content. |
| Size | At most 2 MB and 2,000 data rows. An `.xlsx` file must also unpack to at most 50 MB. |
| Worksheet | Only the first sheet of an `.xlsx` file is read. |
| Header row | The first non-blank row. It must contain exactly these columns, in any order: `employee_number`, `effective_from`, `amount`, `currency_code`. Names are matched ignoring case, with spaces or hyphens read as underscores (`Employee Number` is accepted). The `row_number` and `errors` columns of a response CSV are ignored. Any other column is rejected. |
| Blank rows | Skipped. |
| Row numbers | Counted as a spreadsheet shows them: the header is row 1. |

Column values (all required):

| Column | Rule |
|---|---|
| `employee_number` | An existing employee. Case and surrounding spaces are ignored. |
| `effective_from` | `YYYY-MM-DD`, or a date cell in `.xlsx`. If a salary exists on this date, it must be `current` or `scheduled`. Otherwise the date must be after today and after the latest salary start date. It must not precede the employee’s hire date. |
| `amount` | Monthly amount (D3). Digits with an optional decimal point, e.g. `85000.00`; no thousands separators or currency symbols. Greater than 0, with no more decimal places than the currency allows (JPY 0, KWD 3). |
| `currency_code` | A supported currency (`GET /currencies`). Case is ignored. |

Example CSV:

```csv
employee_number,effective_from,amount,currency_code
EMP-00123,2026-04-01,86000.00,INR
EMP-00456,2027-01-01,5200.00,USD
```

### 9A.3 `POST /bulk_salary_corrections`

Send `multipart/form-data` with the file in a part named `file`. Let the client set the multipart `Content-Type` header (with its boundary).

```bash
curl -b cookies.txt -H "X-CSRF-Token: $TOKEN" \
  -F "file=@june-corrections.xlsx" http://localhost:3000/api/v1/bulk_salary_corrections
```

```ts
const body = new FormData();
body.append("file", fileInput.files[0]);
await fetch("/api/v1/bulk_salary_corrections", {
  method: "POST",
  credentials: "same-origin",
  headers: { "X-CSRF-Token": csrfToken }, // do not set Content-Type
  body,
});
```

Processing happens in two stages.

**Stage 1: file and header.** If the file cannot be read or its header does not match, the upload is rejected with `422` before any row is processed. Nothing is saved and no history record is created.

```json
{
  "error": {
    "code": "invalid_file_header",
    "message": "The file header does not match the template.",
    "details": {
      "missing_columns": ["effective_from"],
      "unknown_columns": ["salary"],
      "duplicate_columns": ["amount"]
    }
  }
}
```

`details` includes only the lists that are not empty. A blank header cell between columns is reported as `"(blank)"` in `unknown_columns`.

| `code` | `message` |
|---|---|
| `invalid_file` | `Upload a .csv or .xlsx file.` |
| `invalid_file` | `The file must be at most 2 MB.` |
| `invalid_file` | `The file is not a valid .xlsx file.` or `The .xlsx file is too large once unpacked.` |
| `invalid_file` | `The CSV file must be UTF-8 text.` or `The CSV file could not be read.` |
| `invalid_file` | `The file is empty.` or `The file has no data rows.` |
| `invalid_file` | `The file has more than 2,000 data rows.` |
| `invalid_file_header` | `The file header does not match the template.` (with `details` as above) |

**Stage 2: rows.** A history record is created with `process` status. Each valid row is saved in its own transaction; errors in one row do not stop the others. Rows targeting the same employee number and effective date all fail. Required-value and duplicate-target failures skip business processing. Existing pairs use the salary correction service, which reloads under its employee lock and rechecks editability and validations. New future dates use the salary change service, which locks the employee, reloads the latest salary, and atomically closes its period and creates the scheduled record. Failed creation leaves the previous period unchanged. Rows are processed in file order; later rows see salary history written by earlier rows when the change service validates the latest record. Unchanged values succeed without changing the record timestamp.

The response is `201`, **even when some or all rows failed**. No row counts are stored or returned:

```json
{
  "data": {
    "id": 42,
    "status": "completed_with_errors",
    "file_format": "xlsx",
    "original_filename": "june-corrections.xlsx",
    "original_file_path": "/api/v1/bulk_salary_corrections/42/original_file",
    "response_file_path": "/api/v1/bulk_salary_corrections/42/response_file",
    "started_at": "2026-09-30T10:15:00.000Z",
    "finished_at": "2026-09-30T10:15:02.000Z",
    "created_at": "2026-09-30T10:15:00.000Z"
  }
}
```

- `process`: processing the upload. The frontend displays **Processing**.
- `completed`: no rows failed; `response_file_path` is `null`.
- `completed_with_errors`: at least one row failed, including when every row failed. Download the response CSV when its path is present.

Files are Active Storage attachments (`original_file` and `response_file`), linked through `active_storage_attachments` and `active_storage_blobs`. There is no file-path column on `bulk_salary_corrections`. JSON never contains submitted row values or amounts.

An unexpected exception after history creation returns generic `500 internal_error`. Recovery attempts to mark `completed_with_errors` and attach a CSV containing known error rows and unconfirmed rows with `Processing stopped. Review current records before retrying this row.` Already committed corrections remain saved. A storage failure can prevent the attachment, so download paths reflect actual attachment presence. A process crash or database outage can leave `process`. Inspect history and current records before retrying; no automatic retry is provided.

Other responses: `400 bad_request` when `file` is missing (`details.file: ["is required"]`) or is not a file (`["must be an uploaded file"]`), `401`, and `422 invalid_csrf_token`.

### 9A.4 Response file

`GET /bulk_salary_corrections/:id/response_file` returns a CSV attachment (`<original name>-response.csv`, `Content-Type: text/csv`), even when the uploaded file was XLSX. It contains only error rows, with:

- the four template columns, holding the original values before mapper normalization (for example, lowercase employee numbers remain lowercase);
- `row_number`: the row's number in the original file;
- `errors`: every problem in the row, as `column: message`, separated by `; `.

Messages never repeat the submitted value:

| Message | Cause |
|---|---|
| `<column>: is required` | Empty cell (other checks are skipped for that row) |
| `employee_number: no employee has this number` | Unknown employee |
| `effective_from: must be a date in YYYY-MM-DD format` | Unparseable date |
| `effective_from: a new salary record must start in the future` | No matching record and the date is today or earlier |
| `effective_from: must be after the latest salary record's start date` | New date is not after the latest record, including one created earlier in the upload |
| `effective_from: must not be before the employee's hire date` | New salary starts before hire |
| `effective_from: historical salary records cannot be changed` | The record has ended |
| `amount: must be a number greater than 0 without separators, e.g. 85000.00` | Not a positive plain number |
| `amount: must have at most N decimal places for this currency` | Too many decimals (I5) |
| `amount: is too large` | 10^14 or more |
| `currency_code: is not a supported currency` | Unknown currency |
| `The same salary record also appears in row N` (or `rows N, M`) | Duplicate target in the file; business processing is skipped |
| `Historical salary records cannot be changed` | The record became historical between checking and saving |

Cells starting with `=`, `+`, `-`, `@`, a tab, or a carriage return are prefixed with `'`, as in §9.2. Remove the prefix when correcting such a cell. A CSV file starts with a UTF-8 byte-order mark.

### 9A.5 History and downloads

- `GET /bulk_salary_corrections` returns the records above, paginated (§2.3), newest first. It has no filters or sorting.
- `GET /bulk_salary_corrections/:id` returns one record (`404` if unknown).
- `GET /bulk_salary_corrections/:id/original_file` returns the file exactly as uploaded.
- Both file downloads are attachments (`Content-Disposition: attachment`) marked `Cache-Control: no-store`, because they contain salary amounts. They are served only through these authenticated endpoints; there are no public file URLs.
- `GET /bulk_salary_corrections/template?file_format=csv|xlsx` (default `csv`) returns `salary-corrections-template.<format>`. Any other `file_format` returns `400`.

## 10. Status and error codes

| Status | `code` | When |
|---|---|---|
| 200 | — | Successful read, update, or login |
| 201 | — | Employee or salary record created; bulk correction upload processed (even if rows failed, §9A.3) |
| 204 | — | Logout |
| 400 | `bad_request` | Missing wrapper key; invalid filter, sort, pagination, `by`, or date parameter; unknown filter ID |
| 401 | `unauthenticated` | No session or expired session |
| 401 | `invalid_credentials` | Login failed |
| 403 | — | Reserved; not used in v1 (D17) |
| 404 | `not_found` | Unknown route or record, or a salary record belonging to another employee. Generic message. |
| 422 | `validation_failed` | Field validation failure, including a date field sent to a correction, or a duplicate `employee_number`/`email` caught by the database after a concurrent request |
| 422 | `salary_record_not_editable` | Correction attempted on a historical record |
| 422 | `export_too_large` | CSV would exceed 10,000 rows |
| 422 | `invalid_file` | Bulk upload cannot be read: wrong type, too large, too many rows, or no data (§9A.3) |
| 422 | `invalid_file_header` | Bulk upload header does not match the template; `details` lists the columns (§9A.3) |
| 422 | `invalid_csrf_token` | CSRF token missing or wrong on a state-changing request |
| 429 | `rate_limited` | Login attempts exceeded |
| 500 | `internal_error` | Unexpected error. Generic message; details are logged only. |
| 503 | — | `GET /health` when the database is unavailable |

## 11. Endpoint summary

| Method | Path | Auth | Phase |
|---|---|---|---|
| GET | `/health` | public | 2.2 |
| GET, POST, DELETE | `/session` | GET/POST public | 4.1 |
| GET | `/countries`, `/departments`, `/currencies` | required | 4.2 |
| GET, POST | `/employees` | required | 4.3 |
| GET, PATCH | `/employees/:id` | required | 4.3 |
| GET, POST | `/employees/:employee_id/salary_records` | required | 4.4 |
| GET, PATCH | `/employees/:employee_id/salary_records/:id` | required | 4.4 |
| GET | `/analytics/summary`, `/analytics/distribution`, `/analytics/breakdown` | required | 5.2 |
| GET | `/reports/salaries`, `/reports/salaries.csv` | required | 5.2, 5.3 |
| GET, POST | `/bulk_salary_corrections` | required | bulk (§9A) |
| GET | `/bulk_salary_corrections/:id`, `/:id/original_file`, `/:id/response_file`, `/template` | required | bulk (§9A) |

`PUT` is accepted as an alias of `PATCH` on `/employees/:id` and `/employees/:employee_id/salary_records/:id` (Rails resource routing) and behaves identically. Clients should use `PATCH`.

No payroll, tax, disbursement, or integration endpoints exist. Bulk salary correction (§9A) is the only bulk endpoint.

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
- **Bulk correction:** only the three documented statuses and no row counters; CSV and XLSX input, including scheduled creation and corrections in the same upload; new dates must be future dates after the latest record, hire-date and currency validations are preserved, failed creation leaves history unchanged; invalid file/header returns `422` without history; valid rows persist when others fail; duplicate targets, historical records, and unknown employees fail safely; response CSV contains only error rows and can be uploaded again; employee-module reuse is covered by a service test; unexpected exceptions return generic `500` and attempt error-file recovery; attachment-aware downloads are authenticated, `no-store`, and `404` when missing; paginated history avoids N+1 attachment queries.
- **Privacy:** error bodies contain no submitted values; salary fields are filtered from logs.

## 13. Client integration notes (frontend)

A summary for client developers. The sections above are the contract.

**Hosting and cookies**
- Serve the frontend from the same site as the API, or proxy `/api` to the Rails server in development (e.g. to `http://localhost:3000`). The session cookie is `SameSite=Lax`, and no CORS is configured (ADR 004).
- Send requests with credentials (`fetch(url, { credentials: "same-origin" })`). The cookie is `HttpOnly`, so scripts never read it.

**Sign-in and CSRF**
1. On load, call `GET /session`. It returns `authenticated`, `user`, and a `csrf_token`.
2. Sign in with `POST /session` and `X-CSRF-Token: <token>`. The session is reset at sign-in, so **store the new `csrf_token` from the sign-in response** and use it from then on.
3. Send `X-CSRF-Token` on every `POST`, `PATCH`, and `DELETE`. A missing or stale token returns `422 invalid_csrf_token`; call `GET /session` again for a fresh one.
4. Sign out with `DELETE /session` (`204`).

**Session lifetime**
- Sessions expire after 30 minutes of inactivity or 8 hours after sign-in.
- **Any** signed-in request refreshes the idle timer, including `GET /session`. A client that polls `/session` keeps the session alive until the 8-hour limit. Poll only if that is intended.
- On any `401 unauthenticated`, treat the user as signed out and show the sign-in screen.

**Errors**
- Every error has `{"error": {"code", "message", "details?"}}`. Branch on `code`, not on `message`.
- `details` appears for `validation_failed` and `bad_request`. It maps request field names (e.g. `employee_number`, `initial_salary.amount`, `country_id`) to messages, so errors can be shown next to form fields. Submitted values are never echoed.
- Codes a client should handle:
  - `401 unauthenticated`, `401 invalid_credentials`;
  - `422 validation_failed`, `salary_record_not_editable`, `export_too_large`, `invalid_file`, `invalid_file_header`, `invalid_csrf_token`;
  - `429 rate_limited`;
  - `400 bad_request` (a client bug or a bad filter);
  - `404 not_found`;
  - `500 internal_error` (show a generic message).

**Lists and filters**
- Paginated lists return `meta` with `page`, `per_page`, `total_count`, and `total_pages`. `per_page` is 1–100 (default 25).
- Invalid filter, sort, or pagination values return `400`; they are never silently corrected. Build filter options from `/countries`, `/departments`, and `/currencies`.
- The employee list defaults to **all** statuses. Analytics and reports default to `active` + `on_leave`; pass `employment_status` to change that.

**Money, currency, and dates**
- Amounts are decimal **strings**, already rounded to the currency's minor units (JPY `"250000"`, KWD `"1500.125"`, USD `"85000.00"`). Display them as given, with `currency_code`, and label them **monthly**.
- Never add amounts across currencies. Analytics return one row per currency, and there is no grand total.
- Dates are `YYYY-MM-DD`, and "today" is UTC. Salary records carry `status` (`current`, `scheduled`, `historical`) and `editable`; use them rather than comparing dates on the client.

**CSV export**
- Link or navigate to `GET /reports/salaries.csv?<same filters as the JSON report>`. The response is an attachment (`salary-report-<as_of>.csv`, UTF-8 with a BOM).
- If the result would exceed 10,000 rows, the response is **JSON** `422 export_too_large`. Check the status or content type before treating the response as a file.

**Bulk salary correction**
- Upload with `FormData` (field `file`) and `X-CSRF-Token`; let the browser set multipart `Content-Type` (§9A.3).
- On `201`, display Processing, Completed, or Completed with errors using `status`. Offer `response_file_path` when present. There are no row counters.
- Response downloads are always CSV; `file_format` describes the original upload.
- On `422 invalid_file_header`, show the nonempty missing, unknown, and duplicate column lists; nothing was saved.
- On `500`, inspect history and current records before retrying; corrections already committed remain saved, and a response file may be unavailable.
- Use returned download paths.

## 14. Changelog

- **2.6 (2026-09-30), scheduled salaries through bulk uploads:** a missing employee/date salary pair now creates a future scheduled record through `Salaries::ChangeService`; existing records still use correction rules. Previous salary periods are closed transactionally, dates must follow the latest salary, and row errors remain in the response CSV. The endpoint and template columns are unchanged.

- **2.5 (2026-09-30), simplified bulk uploads:** removed stored and computed row counters; statuses are `process`, `completed`, and `completed_with_errors`; renamed the error attachment and endpoint to `response_file`; parsing, headers, mapping, and row processing now live in `BulkUploadService`. Added a frontend upload/history page with response CSV downloads. Existing attachment metadata is migrated without moving files.

- **2.4 (2026-09-30), mapper-based bulk uploads:** module services declare required/optional headers and a proc mapper; salary processing moved to `Salaries::BulkCorrectionService`. Added computed `success_count`/`failed_count`, and changed failed-row downloads to CSV for every upload format (§9A). Original uploads and template formats remain available. Extension instructions are in `backend/README.md`.

- **2.3 (2026-09-30), reusable bulk processing:** added `created_rows` (always zero for salary corrections) and `interrupted` history status; clarified partial counts, attachment-aware download paths, unexpected-error recovery, duplicate short-circuiting, and locked unchanged detection (§9A). The internal definition contract and extension steps are documented in `backend/README.md`; no additional bulk endpoints were introduced.

- **2.2 (2026-09-30), bulk salary correction:** new §9A (template, upload, history, and file downloads); `invalid_file` and `invalid_file_header` codes (§10); endpoint summary (§11), test expectations (§12), and client notes (§13) updated.

- **2.1 (2026-09-29), Phases 4–7 clarifications:**
  - `details` keys use request field names (§6.3);
  - an invalid `hired_on` returns `422`;
  - a duplicate `employee_number`/`email` caught by the database after a concurrent request returns `422 validation_failed` (§10);
  - analytics population: employees hired after `as_of` are out of scope; the filter echo shape; all ten bands with exact edges; `Cache-Control: no-store`; no minimum group size (§8);
  - report sort rules (§9);
  - CSV body, BOM, filename, error format, and allowed formats (§9.2);
  - `PUT` alias and reference-data phase (§11);
  - `page` capped at 1,000,000 (§2.3; 7.1 F1: a larger value previously returned `500`);
  - client integration notes (§13).
- **2.0 (2026-09-28):** approved contract (Phase 1).
