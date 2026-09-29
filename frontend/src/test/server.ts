import { setupServer } from "msw/node";

// Network-level API mocks for component tests (FRONTEND_PLAN.md Q8). Modules add handlers and synthetic
// fixtures as they are built; any request without a handler fails the test.
export const server = setupServer();
