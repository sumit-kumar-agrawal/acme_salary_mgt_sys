import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/components/common/format";
import MoneyAmount from "@/components/common/MoneyAmount";

// Money display (FRONTEND_PLAN.md S8; .claude/rules/frontend/data-display.md).

describe("formatMoney", () => {
  it("adds thousands separators and keeps the API's decimals exactly", () => {
    expect(formatMoney("85000.00")).toBe("85,000.00");
    expect(formatMoney("250000")).toBe("250,000");
    expect(formatMoney("1500.125")).toBe("1,500.125");
    expect(formatMoney("999.50")).toBe("999.50");
    expect(formatMoney("0.001")).toBe("0.001");
  });

  it("never converts to a number: values beyond floating-point precision stay exact", () => {
    // As a JavaScript number this would round to 12345678901234568.
    expect(formatMoney("12345678901234567.8901")).toBe(
      "12,345,678,901,234,567.8901",
    );
  });

  it("returns unexpected strings unchanged", () => {
    expect(formatMoney("n/a")).toBe("n/a");
    expect(formatMoney("1,000.00")).toBe("1,000.00");
  });
});

describe("MoneyAmount", () => {
  it("shows the amount with its currency code, not a symbol", () => {
    render(<MoneyAmount amount="85000.00" currencyCode="INR" />);

    expect(screen.getByText("85,000.00 INR")).toBeInTheDocument();
  });

  it("formats each currency by the API's own minor units (JPY 0, KWD 3)", () => {
    render(
      <>
        <MoneyAmount amount="250000" currencyCode="JPY" />
        <MoneyAmount amount="1500.125" currencyCode="KWD" />
      </>,
    );

    expect(screen.getByText("250,000 JPY")).toBeInTheDocument();
    expect(screen.getByText("1,500.125 KWD")).toBeInTheDocument();
  });

  it("labels the amount monthly when asked", () => {
    render(<MoneyAmount amount="6500.00" currencyCode="USD" monthly />);

    expect(screen.getByText(/6,500\.00 USD/)).toHaveTextContent(
      "6,500.00 USD / month",
    );
  });
});
