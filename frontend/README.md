# Frontend

The React frontend for the Salary Management System (Vite, React, TypeScript, Bootstrap). It is a single-page app that talks to the Rails API in `../backend` through the Vite dev proxy.

Setup, running both apps together, end-to-end tests, and known limitations are in the [root README](../README.md). Decisions and progress are in [`FRONTEND_PLAN.md`](../FRONTEND_PLAN.md) and [ADR 006](../docs/decisions/006-frontend-architecture.md).

Everyday commands (Node 22: run `nvm use` here first):

```bash
npm run dev          # http://localhost:5173 (needs the Rails server on :3000)
npm test             # unit and component tests
npm run lint         # also: npm run typecheck, npm run format
npm run build        # production build into dist/
```
