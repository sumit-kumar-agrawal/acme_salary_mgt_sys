# Salary Management System — API Specification

**Status:** Proposed contract; finalize alongside implementation  
**Version:** 1.0  
**Base path:** `/api/v1`

## 1. API conventions

- JSON request and response bodies.
- RESTful resource naming.
- Authentication required for employee, salary, and analytics endpoints.
- Use standard HTTP status codes.
- Use pagination for collection endpoints.
- Validate all input server-side.
- Do not return fields not needed by the client.
- Exact authentication mechanism and token/session transport must be selected for the deployment context.

## 2. Common response patterns

### Successful resource response

```json
{
  "data": {
    "id": 123,
    "employee_number": "EMP-00123"
  }
}
```

### Validation error

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Please correct the highlighted fields.",
    "details": {
      "employee_number": ["has already been taken"]
    }
  }
}
```

### Paginated collection

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total_count": 0,
    "total_pages": 0
  }
}
```

These are illustrative contract examples; field lists should match the implemented schema.

## 3. Employee endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/employees` | List employees with pagination, search, and filters |
| `POST` | `/employees` | Create an employee |
| `GET` | `/employees/:id` | View employee details |
| `PATCH` | `/employees/:id` | Update permitted employee fields |

Suggested list query parameters:

- `page`, `per_page`
- `q` for employee number/name search
- `country_id`
- `department_id`
- `employment_status`
- Optional sorting from an allowlist

Do not accept arbitrary SQL sort expressions or unbounded page sizes.

## 4. Salary endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/employees/:employee_id/salary_records` | List salary history |
| `POST` | `/employees/:employee_id/salary_records` | Add a salary record |
| `GET` | `/employees/:employee_id/salary_records/:id` | View one salary record |

A salary update should follow the approved history rule. If a new salary is effective from a date, the API must preserve the previous record and apply the documented period-closing/overlap behavior.

Illustrative request:

```json
{
  "salary_record": {
    "amount": "85000.00",
    "currency_code": "INR",
    "effective_from": "2026-10-01"
  }
}
```

Illustrative response:

```json
{
  "data": {
    "id": 456,
    "employee_id": 123,
    "amount": "85000.00",
    "currency_code": "INR",
    "effective_from": "2026-10-01",
    "effective_to": null
  }
}
```

Represent money as a decimal string in JSON to avoid client-side floating-point ambiguity.

## 5. Analytics endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/analytics/summary` | Summary metrics grouped by currency |
| `GET` | `/analytics/distribution` | Salary distribution by configured buckets or bands |
| `GET` | `/analytics/breakdown` | Country/department breakdown |

Common filters may include `country_id`, `department_id`, `employment_status`, and an effective-date/as-of parameter if approved.

Analytics response must identify:

- Metric name and definition.
- Currency code for monetary values.
- Filters or period applied where practical.
- Whether the result is an aggregate or a record-level report.

Never return a single combined total across unlike currencies without an explicitly approved conversion policy.

## 6. Report export

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/reports/salaries.csv` | Export authorized salary data matching supported filters |

The export must apply the same authorization and filters as the corresponding report. Protect CSV output against formula injection. If exports become too large or slow, evaluate background processing as a separate justified design decision.

## 7. Status codes

- `200 OK`: successful read/update.
- `201 Created`: resource created.
- `204 No Content`: successful operation with no response body, if used.
- `400 Bad Request`: malformed request.
- `401 Unauthorized`: authentication missing or invalid.
- `403 Forbidden`: authenticated user lacks permission.
- `404 Not Found`: resource not found or not visible to the user.
- `422 Unprocessable Entity`: validation failure.

## 8. API test expectations

- Authentication and authorization for protected routes.
- Required fields, invalid values, and unknown identifiers.
- Pagination and filter combinations.
- Salary history and effective-date behavior.
- Currency-safe analytics.
- Export filters, authorization, and CSV safety.

## 9. Contract decisions to finalize

- Authentication/session strategy.
- Maximum `per_page` and allowed sort fields.
- Exact analytics metric definitions and salary bands.
- Whether the report export is synchronous in the initial version.
- Effective-date query semantics.
