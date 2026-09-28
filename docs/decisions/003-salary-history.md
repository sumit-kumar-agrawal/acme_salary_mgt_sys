# ADR 003: Preserve Effective-Dated Salary History

- **Status:** Proposed
- **Date:** 2026-09-28

## Context

Salary information changes over time. Overwriting a salary value would remove the ability to inspect prior compensation, which is useful for management and reporting.

## Decision

Represent salary changes as effective-dated salary records. A change must preserve the previous record and create a new record according to the agreed effective-date and overlap rules.

## Rationale

- Retains a useful history of compensation changes.
- Supports viewing salary at a point in time, subject to finalized date semantics.
- Avoids destructive updates.

## Consequences

- Salary changes need transactional handling.
- The team must define whether periods may overlap and how a current record is identified.
- Audit metadata or change reasons can be added if required, but are not assumed as mandatory in the initial assessment.

## Alternatives considered

- Store only the latest salary on the employee row: simpler, but loses salary history; not selected for the proposed design.
