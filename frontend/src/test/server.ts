import { setupServer } from "msw/node";
import { defaultHandlers } from "@/test/fixtures/defaultHandlers";

// Network-level API mocks for component tests (FRONTEND_PLAN.md Q8). Default handlers cover app-wide
// reads; tests add or override handlers with server.use(...). Any request without a handler fails the test.
export const server = setupServer(...defaultHandlers);
