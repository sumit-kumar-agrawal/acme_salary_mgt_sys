import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/routes/returnPath";

describe("safeReturnPath (R7)", () => {
  it("returns an internal path with its search string", () => {
    expect(safeReturnPath({ from: "/employees?page=2" })).toBe(
      "/employees?page=2",
    );
  });

  it("falls back to / for anything that is not an internal path (open-redirect guard)", () => {
    for (const from of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "",
    ]) {
      expect(safeReturnPath({ from }), from).toBe("/");
    }
  });

  it("falls back to / for missing or malformed state, and never returns to the sign-in page", () => {
    for (const state of [
      undefined,
      null,
      "/employees",
      { from: 42 },
      { from: "/sign-in" },
      { from: "/sign-in?x=1" },
    ]) {
      expect(safeReturnPath(state)).toBe("/");
    }
  });
});
