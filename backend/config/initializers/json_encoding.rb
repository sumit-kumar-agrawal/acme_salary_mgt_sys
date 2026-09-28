# API timestamps without fractional seconds, e.g. "2026-09-28T10:15:00Z" (API spec, BACKEND_PLAN.md L14).
ActiveSupport::JSON::Encoding.time_precision = 0
