---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# API Integration Rules

- The Rails API is the source of truth: follow docs/api-specification.md (v2.1, especially §13). Do not invent endpoints or fields.
- All HTTP goes through `src/services/`: `src/services/api.ts` is the HTTP core (`apiRequest(path, options)` owns the base path, `credentials`, JSON handling, the `X-CSRF-Token` header on writes, and error parsing), and one service object per feature (`authService`, `employeeService`, …) calls it with short paths such as `"/session"` (never repeating `/api/v1`). Request and response types live in `<feature>.types.ts` next to the service. Components never call `fetch` directly.
- The base path comes from configuration (`VITE_API_BASE_URL`, default `/api/v1`) and must stay same-site: the API uses a session cookie and has no CORS (ADR 004). Never use bearer tokens.
- Handle the error envelope by `code`:
  - `401` → signed out;
  - `422 validation_failed` → field errors;
  - `422 invalid_csrf_token` → refresh the token;
  - `429`, `400`, `404`;
  - `500` → generic message.
- Do not duplicate business logic from Rails; rely on the API's validation and computed fields.
- Mock data only in tests (MSW), never in production code paths.
- If the API lacks something a requirement needs, record the gap in FRONTEND_PLAN.md instead of working around it silently.
