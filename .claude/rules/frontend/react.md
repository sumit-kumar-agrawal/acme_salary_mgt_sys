---
paths:
  - "frontend/src/**/*.{js,jsx,ts,tsx}"
---

# React Rules

- Use functional components and hooks, in strict TypeScript.
- Keep components small and focused on one responsibility; keep business logic separate from presentation.
- Avoid unnecessary `useEffect`, duplicated or derived state, and prop drilling. Server data comes from the query layer (TanStack Query), not component state.
- Use descriptive component, function, and variable names; avoid direct DOM manipulation.
- Use Bootstrap (react-bootstrap) for layout and styling; do not add another CSS framework.
- Follow the folder structure in FRONTEND_PLAN.md and docs/decisions/006-frontend-architecture.md.
