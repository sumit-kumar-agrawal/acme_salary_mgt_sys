import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";
import { describe, expect, it } from "vitest";
import { useListParams } from "@/hooks/useListParams";

// URL list state (FRONTEND_PLAN.md S4, FD6b).

const CONFIG = {
  sortFields: ["employee_number", "last_name", "hired_on"],
  defaultSort: "employee_number",
  filters: ["country_id", "department_id", "employment_status", "as_of"],
} as const;

function setup(url = "/employees") {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      list: useListParams(CONFIG),
      location: useLocation(),
      navigationType: useNavigationType(),
    }),
    { wrapper },
  );
}

describe("useListParams", () => {
  it("uses defaults when the URL has no list parameters", () => {
    const { result } = setup();

    expect(result.current.list.query).toEqual({
      page: 1,
      per_page: 25,
      sort: "employee_number",
      q: undefined,
    });
  });

  it("reads valid values from the URL", () => {
    const { result } = setup(
      "/employees?page=3&per_page=50&sort=-hired_on&country_id=5&department_id=2&employment_status=on_leave&as_of=2026-09-28",
    );

    expect(result.current.list.query).toEqual({
      page: 3,
      per_page: 50,
      sort: "-hired_on",
      q: undefined,
      country_id: "5",
      department_id: "2",
      employment_status: "on_leave",
      as_of: "2026-09-28",
    });
  });

  it("replaces tampered or invalid values with defaults, so they never reach the API", () => {
    const { result } = setup(
      "/employees?page=abc&per_page=500&sort=salary&country_id=x1&department_id=0&employment_status=retired&as_of=2026-13-45&email=a%40b.c",
    );

    expect(result.current.list.query).toEqual({
      page: 1,
      per_page: 25,
      sort: "employee_number",
      q: undefined,
    });
  });

  it("rejects pages beyond the API limit and dates that do not exist", () => {
    const { result } = setup("/employees?page=1000001&as_of=2026-02-30");

    expect(result.current.list.page).toBe(1);
    expect(result.current.list.filters).toEqual({});
  });

  it("changing a filter resets the page and keeps the other parameters", () => {
    const { result } = setup("/employees?page=4&sort=last_name&country_id=5");

    act(() => result.current.list.setFilter("employment_status", "active"));

    expect(result.current.location.search).toBe(
      "?sort=last_name&country_id=5&employment_status=active",
    );
    expect(result.current.navigationType).toBe("REPLACE");
  });

  it("clearing a filter removes it from the URL", () => {
    const { result } = setup("/employees?country_id=5&department_id=2");

    act(() => result.current.list.setFilter("country_id", null));
    expect(result.current.location.search).toBe("?department_id=2");

    act(() => result.current.list.setQ("Rao"));
    act(() => result.current.list.clearFilters());
    expect(result.current.location.search).toBe("");
    expect(result.current.list.q).toBe("");
  });

  it("moving between pages adds a history entry; defaults are left out of the URL", () => {
    const { result } = setup("/employees");

    act(() => result.current.list.setPage(2));
    expect(result.current.location.search).toBe("?page=2");
    expect(result.current.navigationType).toBe("PUSH");

    act(() => result.current.list.setPage(1));
    expect(result.current.location.search).toBe("");
  });

  it("changing the sort or page size resets the page", () => {
    const { result } = setup("/employees?page=3");

    act(() => result.current.list.setSort("-last_name"));
    expect(result.current.location.search).toBe("?sort=-last_name");

    act(() => result.current.list.setPage(2));
    act(() => result.current.list.setPerPage(100));
    expect(result.current.location.search).toBe(
      "?sort=-last_name&per_page=100",
    );
  });

  it("keeps the search text out of the URL, but sends it to the API and resets the page", () => {
    const { result } = setup("/employees?page=3");

    act(() => result.current.list.setQ("Garcia"));

    expect(result.current.list.query.q).toBe("Garcia");
    expect(result.current.list.page).toBe(1);
    expect(result.current.location.search).not.toContain("Garcia");
    expect(result.current.location.search).toBe("");
  });
});
