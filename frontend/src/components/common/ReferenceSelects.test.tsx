import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CountrySelect,
  CurrencySelect,
  DepartmentSelect,
  EmploymentStatusSelect,
} from "@/components/common/ReferenceSelects";
import { mockReferenceData } from "@/test/fixtures/referenceData";
import { renderWithQueryClient } from "@/test/render";

// Reference-data selects (FRONTEND_PLAN.md S7).

function optionLabels(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("ReferenceSelects", () => {
  it("filter mode offers 'All …' plus the API's countries, and reports the chosen id", async () => {
    mockReferenceData();
    const onChange = vi.fn();
    renderWithQueryClient(<CountrySelect value="" onChange={onChange} />);

    const select = screen.getByLabelText("Country");
    await screen.findByRole("option", { name: "Germany" });
    expect(optionLabels(select)).toEqual(["All countries", "Germany", "India"]);

    await userEvent.selectOptions(select, "India");
    expect(onChange).toHaveBeenCalledWith("5");
  });

  it("is disabled with 'Loading…' until the list arrives", async () => {
    mockReferenceData();
    renderWithQueryClient(
      <DepartmentSelect value="" onChange={() => undefined} />,
    );

    expect(screen.getByLabelText("Department")).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Loading…" }),
    ).toBeInTheDocument();
    await screen.findByRole("option", { name: "Engineering" });
    expect(screen.getByLabelText("Department")).toBeEnabled();
  });

  it("is disabled with a short message when the list cannot be loaded", async () => {
    mockReferenceData({ fail: true });
    renderWithQueryClient(
      <CurrencySelect value="" onChange={() => undefined} />,
    );

    expect(
      await screen.findByText("Currencies could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Currency")).toBeDisabled();
  });

  it("form mode is required, uses a 'Choose …' placeholder, and shows an error accessibly", async () => {
    mockReferenceData();
    renderWithQueryClient(
      <CurrencySelect
        value=""
        onChange={() => undefined}
        mode="form"
        error="can't be blank"
      />,
    );

    const select = screen.getByLabelText("Currency");
    await screen.findByRole("option", { name: "INR — Indian Rupee" });
    expect(select).toBeRequired();
    expect(optionLabels(select)).toEqual([
      "Choose a currency",
      "INR — Indian Rupee",
      "JPY — Japanese Yen",
      "KWD — Kuwaiti Dinar",
    ]);
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("can't be blank");
  });

  it("employment statuses come from the API contract with readable labels (no request)", () => {
    renderWithQueryClient(
      <EmploymentStatusSelect value="on_leave" onChange={() => undefined} />,
    );

    const select = screen.getByLabelText("Employment status");
    expect(optionLabels(select)).toEqual([
      "All statuses",
      "Active",
      "On leave",
      "Terminated",
    ]);
    expect(select).toHaveValue("on_leave");
  });
});
