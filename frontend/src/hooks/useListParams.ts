import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { QueryParams } from "@/services/api";
import { isEmploymentStatus } from "@/services/reference.types";

// List state for paginated, filterable pages (FRONTEND_PLAN.md S4, FD6b).
// - page, per_page, sort, and filters live in the URL, so views can be shared and the back button works;
// - the search text `q` stays in component state only: it is often a name and must not reach URLs or history;
// - values read from the URL are sanitised first, so a tampered or stale URL never causes a 400 loop.

export type FilterName =
  "country_id" | "department_id" | "employment_status" | "as_of";
export type Filters = Partial<Record<FilterName, string>>;

export const PER_PAGE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PER_PAGE = 25;
const MAX_PAGE = 1_000_000; // API limit (backend 7.1 F1)

interface ListParamsConfig {
  /** Sortable fields allowed by the endpoint (without the "-" prefix). */
  sortFields: readonly string[];
  /** Default sort, e.g. "employee_number" or "-hired_on". */
  defaultSort: string;
  /** Filters this list supports; others in the URL are ignored. */
  filters: readonly FilterName[];
}

const ID_FORMAT = /^[1-9]\d{0,17}$/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE_FORMAT.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function sanitiseFilter(
  name: FilterName,
  value: string | null,
): string | undefined {
  if (!value) return undefined;
  switch (name) {
    case "country_id":
    case "department_id":
      return ID_FORMAT.test(value) ? value : undefined;
    case "employment_status":
      return isEmploymentStatus(value) ? value : undefined;
    case "as_of":
      return validDate(value) ? value : undefined;
  }
}

function sanitisePage(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

function sanitisePerPage(value: string | null): number {
  const perPage = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(perPage)
    ? perPage
    : DEFAULT_PER_PAGE;
}

function sanitiseSort(value: string | null, config: ListParamsConfig): string {
  if (!value) return config.defaultSort;
  const field = value.startsWith("-") ? value.slice(1) : value;
  return config.sortFields.includes(field) ? value : config.defaultSort;
}

export function useListParams(config: ListParamsConfig) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQState] = useState("");

  const page = sanitisePage(searchParams.get("page"));
  const perPage = sanitisePerPage(searchParams.get("per_page"));
  const sort = sanitiseSort(searchParams.get("sort"), config);

  const filtersKey = config.filters.join(",");
  const filters = useMemo(() => {
    const result: Filters = {};
    for (const name of filtersKey.split(",") as FilterName[]) {
      const value = sanitiseFilter(name, searchParams.get(name));
      if (value) result[name] = value;
    }
    return result;
  }, [filtersKey, searchParams]);

  /** Applies changes to the URL; defaults are left out so URLs stay short. */
  const update = useCallback(
    (
      changes: Record<string, string | number | null>,
      { resetPage = false, replace = true } = {},
    ) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, String(value));
          }
          if (resetPage) next.delete("page");
          if (next.get("page") === "1") next.delete("page");
          if (next.get("per_page") === String(DEFAULT_PER_PAGE))
            next.delete("per_page");
          if (next.get("sort") === config.defaultSort) next.delete("sort");
          return next;
        },
        { replace },
      );
    },
    [setSearchParams, config.defaultSort],
  );

  const setPage = useCallback(
    (next: number) => update({ page: next }, { replace: false }),
    [update],
  );
  const setPerPage = useCallback(
    (next: number) => update({ per_page: next }, { resetPage: true }),
    [update],
  );
  const setSort = useCallback(
    (next: string) => update({ sort: next }, { resetPage: true }),
    [update],
  );
  const setFilter = useCallback(
    (name: FilterName, value: string | null) =>
      update({ [name]: value }, { resetPage: true }),
    [update],
  );
  /** Clears every filter and the search text in one URL update (two updates in one tick would overwrite each other). */
  const clearFilters = useCallback(() => {
    setQState("");
    update(
      Object.fromEntries(filtersKey.split(",").map((name) => [name, null])),
      { resetPage: true },
    );
  }, [update, filtersKey]);
  const setQ = useCallback(
    (next: string) => {
      setQState(next);
      update({}, { resetPage: true });
    },
    [update],
  );

  /** Parameters for the API request (always explicit, already sanitised). */
  const query: QueryParams = useMemo(
    () => ({ page, per_page: perPage, sort, q: q || undefined, ...filters }),
    [page, perPage, sort, q, filters],
  );

  return {
    page,
    perPage,
    sort,
    filters,
    q,
    query,
    setPage,
    setPerPage,
    setSort,
    setFilter,
    clearFilters,
    setQ,
  };
}
