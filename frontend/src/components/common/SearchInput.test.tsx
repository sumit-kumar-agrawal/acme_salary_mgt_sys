import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SearchInput from "@/components/common/SearchInput";

// Debounced search (FRONTEND_PLAN.md S5). Fake timers make the 300 ms debounce exact.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function type(value: string) {
  fireEvent.change(screen.getByLabelText("Search employees"), {
    target: { value },
  });
}

describe("SearchInput", () => {
  it("emits the trimmed text once, 300 ms after typing stops", () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Search employees" onSearch={onSearch} />);

    type("Gar");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    type("  Garcia ");
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("Garcia");
  });

  it("searches at once on Enter, without a second call after the debounce", () => {
    const onSearch = vi.fn();
    render(<SearchInput label="Search employees" onSearch={onSearch} />);

    type("Rao");
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledWith("Rao");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it("Clear empties the box and ends the search", () => {
    const onSearch = vi.fn();
    render(
      <SearchInput
        label="Search employees"
        initialValue="Rao"
        onSearch={onSearch}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Clear search employees" }),
    );

    expect(screen.getByLabelText("Search employees")).toHaveValue("");
    expect(onSearch).toHaveBeenCalledWith("");
    expect(
      screen.getByRole("button", { name: "Clear search employees" }),
    ).toBeDisabled();
  });

  it("limits input to the API's 100 characters and has a visible label", () => {
    render(<SearchInput label="Search employees" onSearch={() => undefined} />);

    expect(screen.getByLabelText("Search employees")).toHaveAttribute(
      "maxLength",
      "100",
    );
    expect(screen.getByText("Search employees")).toBeVisible();
  });
});
