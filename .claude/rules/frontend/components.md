---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# Component Rules

- Use shared components for tables, forms, modals, buttons, alerts, and loading/empty/error states.
- Follow the project structure: `src/components/common/` for reusable UI (alerts, loading, pagination, data table, …); `src/components/<feature>/` for each feature's pages and components (`auth`, `employees`, `salaries`, `dashboard`, `reports`); `src/layouts/` for the main layout, header, navbar, and sidebar; `src/routes/` for the app routes; `src/hooks/` for custom hooks; `src/services/` for Rails API integration (`api.ts` HTTP core plus one service object per feature: `authService.ts`, `employeeService.ts`, … with types in `<feature>.types.ts`). Components in `common/` never fetch data.
- Create a folder or file only when a real feature needs it; no empty folders or speculative abstractions.
- Configure components through props and callbacks.
- Every data-driven view handles loading, empty, and error states.
- Forms have accessible labels, only basic client checks (required, format), and show the API's `422` `details` next to each field.
- Use semantic HTML and keyboard-accessible controls.
- Do not create an abstraction for a component used only once unless it improves clarity.
- Write component tests (Vitest + React Testing Library) for important flows.
