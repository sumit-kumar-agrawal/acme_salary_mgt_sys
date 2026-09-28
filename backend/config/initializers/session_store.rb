# Cookie session for the single HR user (ADR 004, BACKEND_PLAN.md L6).
# Idle (30 min) and absolute (8 h) expiry are enforced by Api::Authentication.
Rails.application.config.session_store :cookie_store,
  key: "_acme_salary_session",
  httponly: true,
  same_site: :lax,
  secure: Rails.env.production?
