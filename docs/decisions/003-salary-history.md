# ADR 003: Preserve Effective-Dated Salary History

- **Status:** Accepted
- **Date:** 2026-09-28 (accepted in BACKEND_PLAN.md task 1.3)

## Context

Salary information changes over time. Overwriting a salary value would remove the ability to inspect prior compensation, which is useful for management and reporting.

## Decision

Represent salary changes as effective-dated salary records. A change must preserve the previous record and create a new record according to the agreed effective-date and overlap rules.

Agreed semantics (D4, D6–D9; see docs/database-design.md §5–§7):

- **Dates:** `effective_from` and `effective_to` are `DATE` columns. `effective_to` is inclusive; NULL means open-ended. "Today" is `Date.current` in UTC.
- **Current salary:** the record where `effective_from <= as_of` and (`effective_to IS NULL` or `effective_to >= as_of`). Future-dated records are allowed, so an open-ended record is not necessarily current.
- **Salary change:** a new record must start after the latest record's `effective_from`. Inside one transaction, with the employee row locked, the latest record is closed at `new.effective_from - 1 day` and the new record is inserted. Inserts into the middle of history are rejected.
- **Correction:** the record in effect today, or a future-dated record (O1), may have its `amount` or `currency_code` corrected. Records whose period has ended are immutable. `employee_id` and `effective_from` are read-only. Records are never deleted.
- **Hire date:** `effective_from` must not precede the employee's `hired_on` when it is present (I13).
- **Database guards:** a unique index on `(employee_id, effective_from)`, and a unique index on `(employee_id, open_flag)` using a generated column, allowing at most one open-ended record. Also `CHECK (effective_to >= effective_from)` and `CHECK (amount > 0)`.

## Rationale

- Retains a useful history of compensation changes.
- Supports viewing salary at a point in time, subject to finalized date semantics.
- Avoids destructive updates.

## Consequences

- Salary changes need transactional handling.
- Overlap is prevented by the locked service plus model validation; MySQL cannot express an exclusion constraint.
- A future-dated record with a wrong **start date** cannot be fixed in v1, because dates are read-only; its amount and currency can be corrected (O1).
- Audit history is satisfied by the preserved records plus `created_at`/`updated_at` (D5). Change reasons are not stored.

## Alternatives considered

- Store only the latest salary on the employee row: simpler, but loses salary history; not selected for the proposed design.
