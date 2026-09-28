# ADR 004: Session-Cookie Authentication for a Single HR Manager

- **Status:** Accepted
- **Date:** 2026-09-28
- **Related:** BACKEND_PLAN.md D16, D17; FR-07; docs/architecture.md §5

## Context

The system has one user role: a single HR Manager who handles sensitive salary data. The requirements ask for secure authentication and server-side authorization, but not advanced RBAC. The only client will be a future React app served from the same site (or through a development proxy). No third-party API consumers are planned.

## Decision

- Store one HR user in a `users` table with `has_secure_password` (bcrypt).
- Provision that user with a rake task (`hr:create_user`) that reads `HR_USER_EMAIL` and `HR_USER_PASSWORD` from the environment. There are no sign-up or password-reset endpoints.
- Authenticate with the standard Rails cookie session. The generated full-stack app already includes the cookie and session middleware. API controllers inherit from `Api::V1::BaseController < ActionController::Base` (JSON-only, without `ApplicationController`'s `allow_browser` check; BACKEND_PLAN.md H1). The session is configured as follows:
  - Cookie flags: `HttpOnly`, `SameSite=Lax`, and `Secure` outside development.
  - Call `reset_session` on login.
  - Expire sessions after 30 minutes idle or 8 hours absolute.
- Protect state-changing requests with CSRF. The token comes from `GET /session`, and the client sends it back in the `X-CSRF-Token` header.
- Rate-limit login with the Rails built-in `rate_limit` (5 attempts per minute per IP). Excess attempts get `429`. Counters are stored in Solid Cache (MySQL); tests use `:memory_store` (ADR 005).
- Default deny: `Api::V1::BaseController` requires a logged-in user. Only `GET /session` and `POST /session` opt out. `GET /health` is served by a separate `ActionController::API` controller with no session or authentication.
- Unauthenticated requests get `401`. `403` is unused while there is a single role.

## Rationale

- An HttpOnly cookie keeps the credential away from JavaScript. A bearer token in browser storage would be exposed to any XSS.
- Rails has built-in, well-tested support for sessions, CSRF, and rate limiting, so bcrypt is the only extra dependency.
- One role means a policy layer (such as Pundit) would add code without adding protection.

## Consequences

- No middleware changes are needed: the full-stack Rails app already provides cookies, sessions, and `protect_from_forgery`. API controllers must still avoid `ApplicationController`, so HTML-only behaviour such as `allow_browser` never applies to JSON clients.
- Clients must fetch and send the CSRF token. Integration tests need a login helper.
- A cross-origin frontend would need CORS configured with credentials and `SameSite=None; Secure` cookies. That would be an amendment to this ADR.
- Adding roles later means adding a policy layer and a `role` column.

## Alternatives considered

- **JWT in an Authorization header:** stateless, but the token has to live somewhere JavaScript can read it, and revocation and expiry are harder. It is not needed without third-party clients.
- **Devise:** full-featured, but most of it (registration, recovery, confirmable) is unused for one seeded user, and it adds a large dependency.
- **HTTP Basic auth:** simple, but has no logout or session expiry and sends credentials on every request.
