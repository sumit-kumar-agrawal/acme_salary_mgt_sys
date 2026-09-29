---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# Frontend Security Rules

The root `.claude/rules/security.md` also applies.

- Keep the session state and CSRF token in memory only: never in `localStorage`, `sessionStorage`, or cookies set by JavaScript.
- Do not put salary or personal data in browser storage or in URLs; search text (`q`) stays out of the URL.
- Never log API payloads, salaries, or personal data to the console or an error reporter.
- Never render API or user content as HTML (no `dangerouslySetInnerHTML`).
