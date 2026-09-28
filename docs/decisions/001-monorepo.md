# ADR 001: Use a Monorepo for the Assessment

- **Status:** Accepted
- **Date:** 2026-09-28 (accepted in BACKEND_PLAN.md task 1.5; `backend/` is built first, `frontend/` follows under a separate plan)
- **Decision owners:** Project team

## Context

The assessment requires a Rails REST API and a React frontend. Both are part of one product and need coordinated changes to API contracts, user flows, and tests.

## Decision

Keep the Rails backend and React frontend in one repository, in separate `backend/` and `frontend/` directories, with shared project documentation at the root.

## Rationale

- One place to review the complete solution.
- Easier to keep API contracts and frontend usage aligned.
- Simpler setup for an interview reviewer.
- Avoids repository coordination overhead for a small assessment.

## Consequences

- Backend and frontend can still have independent dependency management and test commands.
- CI may run separate jobs for each application.
- If teams or release lifecycles diverge substantially later, repository separation can be reconsidered.

## Alternatives considered

- Separate repositories: viable, but adds coordination and setup overhead for this assessment.
