# Backend

The Rails application for the Salary Management System.

Setup and testing instructions are in the [root README](../README.md). See [BACKEND_PLAN.md](../BACKEND_PLAN.md) and [API specification §9A](../docs/api-specification.md#9a-bulk-salary-correction).

## Bulk uploads

`BulkUploadService` contains the complete upload flow: parse CSV/XLSX → validate headers → map rows → validate and save each row → attach a response CSV → finish the upload. There are no separate bulk parser, validator, processor, controller concern, or model concern files.

The controller handles HTTP responses and authenticated downloads. An existing employee/date pair is corrected through `Salaries::CorrectionService`. A missing pair creates a scheduled salary through `Salaries::ChangeService`: its date must be after today (UTC) and after the employee’s latest salary start date. The change service closes the previous period on the day before the new start and preserves history. Both services recheck rules under the employee lock. Rows are processed in file order; list multiple new dates for one employee in ascending order. Duplicate targets fail before saving. Valid rows remain saved when other rows fail.

An invalid file or header returns `422` with an error and creates no history. A processed upload returns its history record with `process`, `completed`, or `completed_with_errors` status. Every-row failure also uses `completed_with_errors`. Row counts are neither stored nor returned.

`BulkSalaryCorrection` attaches `original_file` and `response_file` through Active Storage. Their metadata is in `active_storage_attachments` and `active_storage_blobs`, rather than file columns on the history table. The API provides `response_file_path` only when a response attachment exists. The response CSV contains only error rows, the template columns, `row_number`, and `errors`. Correct it and upload it again. It is always CSV, even for XLSX input.

Unexpected errors return a generic `500`. Recovery records `completed_with_errors` and attempts to write error rows plus unconfirmed rows to the response CSV. Review current records before retrying unconfirmed rows. Storage failure can prevent a response file; a process crash or database outage can leave `process`. There is no automatic retry.

## Reusing the service for another module

Subclass `BulkUploadService` and replace `REQUIRED_HEADERS`, `OPTIONAL_HEADERS`, `MAPPER`, and `FILE_PREFIX`. Mappers receive a hash keyed by normalized file headers:

```ruby
MAPPER = {
  employee_number: ->(row) { row["number"].to_s.strip.upcase },
  email: ->(row) { row["email"].to_s.strip.presence }
}.freeze
```

Override `preload(attributes)`, `duplicate_key(attributes)`, `duplicate_description`, and `process_row(attributes, context)` for that module. Return `nil` from `duplicate_key` when duplicate checks do not apply. Return `[]` from `process_row` on success, or an array of safe error messages on failure. Keep amount strings intact for decimal validation; avoid echoing sensitive submitted values in errors.

Call the subclass with `file:`, `user:`, and its own `record_class:`. That history model needs the same fields, statuses, and attachment names as `BulkSalaryCorrection`. Add the module's controller, views, and routes when its endpoint is needed. `max_rows:` defaults to 2,000. The service tests demonstrate employee creation with renamed headers, optional email, and `Employees::CreateService`; only the salary bulk endpoint is implemented today.
