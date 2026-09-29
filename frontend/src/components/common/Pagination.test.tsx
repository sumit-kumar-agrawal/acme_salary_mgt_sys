import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Pagination from "@/components/common/Pagination";
import type { PaginationMeta } from "@/services/api";

// Page navigation (FRONTEND_PLAN.md S3).

function renderPagination(meta: PaginationMeta) {
  const onPageChange = vi.fn();
  const onPerPageChange = vi.fn();
  render(
    <Pagination
      meta={meta}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
    />,
  );
  return { onPageChange, onPerPageChange };
}

describe("Pagination", () => {
  it("shows the range and page position with grouped numbers", () => {
    renderPagination({
      page: 2,
      per_page: 25,
      total_count: 9429,
      total_pages: 378,
    });

    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Showing 26–50 of 9,429")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 378")).toBeInTheDocument();
  });

  it("moves between pages and disables buttons at the ends", async () => {
    const { onPageChange } = renderPagination({
      page: 1,
      per_page: 25,
      total_count: 60,
      total_pages: 3,
    });

    expect(screen.getByRole("button", { name: "First" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Last" }));

    expect(onPageChange.mock.calls).toEqual([[2], [3]]);
  });

  it("shows the last partial page correctly", () => {
    renderPagination({
      page: 3,
      per_page: 25,
      total_count: 60,
      total_pages: 3,
    });

    expect(screen.getByText("Showing 51–60 of 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last" })).toBeDisabled();
  });

  it("hides page buttons when everything fits on one page, and says so when there are no results", () => {
    renderPagination({ page: 1, per_page: 25, total_count: 0, total_pages: 0 });

    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Next" }),
    ).not.toBeInTheDocument();
  });

  it("offers the first page when the page is past the end (e.g. after filtering)", async () => {
    const { onPageChange } = renderPagination({
      page: 9,
      per_page: 25,
      total_count: 30,
      total_pages: 2,
    });

    expect(screen.getByText("No results on this page")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to first page" }),
    );

    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("changes the page size to one of 25, 50, or 100", async () => {
    const { onPerPageChange } = renderPagination({
      page: 1,
      per_page: 25,
      total_count: 60,
      total_pages: 3,
    });

    const select = screen.getByLabelText("Rows per page");
    expect(
      [...select.querySelectorAll("option")].map((option) => option.value),
    ).toEqual(["25", "50", "100"]);
    await userEvent.selectOptions(select, "100");

    expect(onPerPageChange).toHaveBeenCalledWith(100);
  });
});
