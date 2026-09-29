---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# Data Display Rules (money, currency, dates)

- Show money exactly as the API's decimal string, always with its `currency_code`, and label it monthly.
- Never add, average, or compare amounts across currencies; show one row or card per currency.
- Never use floating-point arithmetic on money. Converting to `Number` is allowed only to size chart elements.
- Show dates as the API's `YYYY-MM-DD` values; "today" is the server's UTC date.
- Use the API's salary-record `status`/`editable` and `employment_status`; do not recompute them from dates.
