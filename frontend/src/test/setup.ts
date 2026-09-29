import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { setScreenSize } from "@/test/screenSize";
import { server } from "@/test/server";

// MSW 3 option (MSW 2 called it onUnhandledRequest): "error" fails any test that hits an unmocked request.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => setScreenSize("large"));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
