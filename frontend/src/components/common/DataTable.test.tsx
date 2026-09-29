import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable, { type Column } from "@/components/common/DataTable";
import { ApiError } from "@/services/api";

// Column-driven table with server-side sorting and explicit states (FRONTEND_PLAN.md S2).

interface Person {
  id: number;
  number: string;
  name: string;
}

const COLUMNS: Column<Person>[] = [
  {
    key: "number",
    header: "Employee number",
    sortField: "employee_number",
    cell: (row) => row.number,
  },
  {
    key: "name",
    header: "Name",
    sortField: "last_name",
    cell: (row) => row.name,
  },
  {
    key: "actions",
    header: "Actions",
    cell: (row) => <a href={`/employees/${row.id}`}>Open</a>,
  },
];
const ROWS: Person[] = [
  { id: 1, number: "EMP-00001", name: "Ada Lovelace" },
  { id: 2, number: "EMP-00002", name: "Alan Turing" },
];

function renderTable(
  overrides: Partial<Parameters<typeof DataTable<Person>>[0]> = {},
) {
  const onSortChange = vi.fn();
  render(
    <DataTable<Person>
      caption="Employees"
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(row) => row.id}
      sort="employee_number"
      onSortChange={onSortChange}
      emptyMessage="No employees match these filters."
      {...overrides}
    />,
  );
  return { onSortChange };
}

describe("DataTable", () => {
  it("renders a named table with column headers and one row per item", () => {
    renderTable();

    const table = screen.getByRole("table", { name: "Employees" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent),
    ).toEqual(["Employee number▲", "Name↕", "Actions"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(
      within(table).getByRole("cell", { name: "Alan Turing" }),
    ).toBeInTheDocument();
    for (const header of within(table).getAllByRole("columnheader"))
      expect(header).toHaveAttribute("scope", "col");
  });

  it("marks only the sorted column with aria-sort and cycles ascending → descending", async () => {
    const { onSortChange } = renderTable({ sort: "-last_name" });

    const [numberHeader, nameHeader, actionsHeader] =
      screen.getAllByRole("columnheader");
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    expect(numberHeader).not.toHaveAttribute("aria-sort");
    expect(
      within(actionsHeader!).queryByRole("button"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(nameHeader!).getByRole("button", { name: "Name" }),
    );
    await userEvent.click(
      within(numberHeader!).getByRole("button", { name: "Employee number" }),
    );

    expect(onSortChange.mock.calls).toEqual([
      ["last_name"],
      ["employee_number"],
    ]);
  });

  it("an ascending column switches to descending", async () => {
    const { onSortChange } = renderTable({ sort: "employee_number" });

    expect(screen.getAllByRole("columnheader")[0]).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Employee number" }),
    );

    expect(onSortChange).toHaveBeenCalledWith("-employee_number");
  });

  it("shows loading, error with Retry, and empty states instead of the table", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable<Person>
        caption="Employees"
        columns={COLUMNS}
        rows={undefined}
        rowKey={(r) => r.id}
        isLoading
        emptyMessage="None."
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    rerender(
      <DataTable<Person>
        caption="Employees"
        columns={COLUMNS}
        rows={undefined}
        rowKey={(r) => r.id}
        error={new ApiError("The request is malformed.", 400, "bad_request")}
        onRetry={onRetry}
        emptyMessage="None."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The request is malformed.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <DataTable<Person>
        caption="Employees"
        columns={COLUMNS}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="No employees match these filters."
        emptyAction={<button type="button">Clear filters</button>}
      />,
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "No employees match these filters.",
    );
    expect(
      screen.getByRole("button", { name: "Clear filters" }),
    ).toBeInTheDocument();
  });

  it("keeps showing rows while refreshing and marks the table busy", () => {
    renderTable({ isFetching: true });

    expect(screen.getByRole("table", { name: "Employees" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
