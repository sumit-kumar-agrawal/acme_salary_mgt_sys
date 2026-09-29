import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/services/api";
import ErrorAlert from "@/components/common/ErrorAlert";
import EmploymentStatusBadge from "@/components/common/EmploymentStatusBadge";
import EmptyState from "@/components/common/EmptyState";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import { formatCount } from "@/components/common/format";
import LoadingState from "@/components/common/LoadingState";
import NotFoundPage from "@/components/common/NotFoundPage";
import { reportRenderError } from "@/components/common/reportRenderError";

describe("LoadingState", () => {
  it("announces what is loading", () => {
    render(<LoadingState label="Loading employees…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading employees…");
  });
});

describe("ErrorAlert", () => {
  it("shows the API's generic message for a 4xx error", () => {
    render(<ErrorAlert error={new ApiError("Not found.", 404, "not_found")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Not found.");
  });

  it("shows a generic message for server errors and unknown errors, never technical detail", () => {
    const { rerender } = render(
      <ErrorAlert
        error={new ApiError("stack trace here", 500, "internal_error")}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("stack trace");

    rerender(<ErrorAlert error={new TypeError("x is undefined")} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("offers Retry when a handler is given", async () => {
    const onRetry = vi.fn();
    render(
      <ErrorAlert
        error={new ApiError("Could not reach the server.", 0, "network_error")}
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("NotFoundPage", () => {
  it("shows a generic message with a link to the employee list and sets the title", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to employees" }),
    ).toHaveAttribute("href", "/employees");
    expect(document.title).toBe("Page not found · Salary Management");
  });
});

describe("ErrorBoundary", () => {
  function Broken(): never {
    throw new Error("secret salary 123456.78 in a message");
  }

  it("replaces a crashed page with a generic message and a Reload button, never the error text", () => {
    // Same root option as main.tsx, so React's default console logging of the error is not used.
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
      { onCaughtError: () => undefined },
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("123456.78");
  });

  it("the root's error reporter logs only the error name, never its message", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    reportRenderError(new TypeError("secret salary 123456.78 in a message"));

    expect(consoleError).toHaveBeenCalledWith(
      "Unexpected TypeError while rendering",
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("123456.78");
  });
});

describe("EmptyState", () => {
  it("announces the message and shows an optional action", () => {
    render(
      <EmptyState
        message="No employees match these filters."
        action={<button type="button">Clear filters</button>}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "No employees match these filters.",
    );
    expect(
      screen.getByRole("button", { name: "Clear filters" }),
    ).toBeInTheDocument();
  });
});

describe("formatCount", () => {
  it("groups thousands for record counts", () => {
    expect([
      formatCount(0),
      formatCount(999),
      formatCount(9429),
      formatCount(1_000_000),
    ]).toEqual(["0", "999", "9,429", "1,000,000"]);
  });
});

describe("EmploymentStatusBadge", () => {
  it("always shows a readable label, not colour alone", () => {
    render(
      <>
        <EmploymentStatusBadge status="active" />
        <EmploymentStatusBadge status="on_leave" />
        <EmploymentStatusBadge status="terminated" />
      </>,
    );

    expect(screen.getByText("Active")).toHaveClass("bg-success");
    expect(screen.getByText("On leave")).toHaveClass("bg-warning", "text-dark");
    expect(screen.getByText("Terminated")).toHaveClass("bg-secondary");
  });
});
