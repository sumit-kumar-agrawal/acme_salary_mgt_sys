import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FormField from "@/components/common/FormField";

// Accessible form fields (FRONTEND_PLAN.md S10).

describe("FormField", () => {
  it("labels the control and passes input props through", async () => {
    const onChange = vi.fn();
    render(
      <FormField
        label="Employee number"
        value=""
        onChange={onChange}
        maxLength={20}
        autoComplete="off"
        required
      />,
    );

    const input = screen.getByLabelText("Employee number");
    expect(input).toHaveAttribute("maxLength", "20");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute("aria-invalid");

    await userEvent.type(input, "E");
    expect(onChange).toHaveBeenCalled();
  });

  it("marks an error for assistive technology and describes the field with it", () => {
    render(
      <FormField
        label="Email"
        value="x"
        onChange={() => undefined}
        error="has already been taken"
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("is-invalid");
    expect(input).toHaveAccessibleDescription("has already been taken");
  });

  it("combines the error and a hint in the description", () => {
    render(
      <FormField
        label="Hired on"
        type="date"
        value=""
        onChange={() => undefined}
        hint="The first salary cannot start before this date."
        error="must not be after the first salary start date"
      />,
    );

    expect(screen.getByLabelText("Hired on")).toHaveAccessibleDescription(
      "must not be after the first salary start date The first salary cannot start before this date.",
    );
  });
});
