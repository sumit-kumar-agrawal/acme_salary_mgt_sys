---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# Component Rules

- Use shared components for tables, forms, modals, buttons, alerts, and loading/empty/error states.
- Put page-level components in `src/features/<area>/` and shared UI in `src/components/`. Shared components never fetch data.
- Configure components through props and callbacks.
- Every data-driven view handles loading, empty, and error states.
- Forms have accessible labels, only basic client checks (required, format), and show the API's `422` `details` next to each field.
- Use semantic HTML and keyboard-accessible controls.
- Do not create an abstraction for a component used only once unless it improves clarity.
- Write component tests (Vitest + React Testing Library) for important flows.
