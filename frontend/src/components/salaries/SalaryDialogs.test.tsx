import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { mockEmployeeDetail } from "@/test/fixtures/employeeDetail";
import { validationFailed } from "@/test/fixtures/employeeWrites";
import {
  mockSalaryRecords,
  mockSalaryWrites,
  salaryRecordNotEditable,
} from "@/test/fixtures/salaryRecords";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { renderWithProviders } from "@/test/render";

// Salary change and correction dialogs (FRONTEND_PLAN.md U4–U8; API §7.3, §7.5; D4 + O1).

afterEach(() => setCsrfToken(null));

async function renderPage({
  records,
  writes = {},
}: {
  records?: NonNullable<Parameters<typeof mockSalaryRecords>[0]>["records"];
  writes?: Parameters<typeof mockSalaryWrites>[0];
} = {}) {
  mockSessionBackend({ signedIn: true });
  const detail = mockEmployeeDetail();
  const history = mockSalaryRecords(records ? { records } : {});
  const { requests } = mockSalaryWrites(writes);
  renderWithProviders(<App />, { route: "/employees/101" });
  const section = await screen.findByRole("region", { name: "Salary history" });
  // History loaded (a table, or the empty state): the change button is enabled.
  await waitFor(() =>
    expect(
      within(section).getByRole("button", { name: "Record salary change" }),
    ).toBeEnabled(),
  );
  return { section, detail, history, requests, user: userEvent.setup() };
}

async function openChangeDialog(
  user: ReturnType<typeof userEvent.setup>,
  section: HTMLElement,
) {
  const opener = within(section).getByRole("button", {
    name: "Record salary change",
  });
  await user.click(opener);
  const dialog = await screen.findByRole("dialog", {
    name: "Record salary change",
  });
  return { opener, dialog };
}

describe("Record salary change", () => {
  it("opens with focus inside, the current salary's currency, and the date rule as help", async () => {
    const { section, user } = await renderPage();

    const { dialog } = await openChangeDialog(user, section);

    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement),
    );
    expect(within(dialog).getByLabelText("Monthly amount")).toHaveValue("");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Currency")).toHaveValue("INR"),
    );
    expect(
      within(dialog).getByLabelText("Effective from"),
    ).toHaveAccessibleDescription(
      "The previous period ends the day before. History is kept. Must be after 2027-04-01.",
    );
  });

  it("checks required fields without sending anything", async () => {
    const { section, requests, user } = await renderPage();
    const { dialog } = await openChangeDialog(user, section);

    await user.click(
      within(dialog).getByRole("button", { name: "Record change" }),
    );

    expect(
      within(dialog).getByLabelText("Monthly amount"),
    ).toHaveAccessibleDescription(/is required/);
    expect(
      within(dialog).getByLabelText("Effective from"),
    ).toHaveAccessibleDescription(/is required/);
    expect(requests).toEqual([]);
  });

  it("sends the amount as typed, then closes with a notice and refreshes history and the current salary", async () => {
    const { section, detail, history, requests, user } = await renderPage();
    const { opener, dialog } = await openChangeDialog(user, section);
    const historyBefore = history.count;
    const detailBefore = detail.requestedIds.length;

    await user.type(
      within(dialog).getByLabelText("Monthly amount"),
      " 1500.125 ",
    );
    await user.selectOptions(within(dialog).getByLabelText("Currency"), "KWD");
    await user.type(
      within(dialog).getByLabelText("Effective from"),
      "2027-10-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Record change" }),
    );

    expect(await within(section).findByRole("status")).toHaveTextContent(
      "Salary change recorded.",
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
    expect(requests.map((request) => request.body)).toEqual([
      {
        salary_record: {
          amount: "1500.125",
          currency_code: "KWD",
          effective_from: "2027-10-01",
        },
      },
    ]);
    expect(history.count).toBeGreaterThan(historyBefore);
    expect(detail.requestedIds.length).toBeGreaterThan(detailBefore);
  });

  it("shows the API's date error on the field and stays open", async () => {
    const { section, user } = await renderPage({
      writes: {
        changeResponse: () =>
          validationFailed({
            effective_from: [
              "must be after the latest salary record's start date",
            ],
          }),
      },
    });
    const { dialog } = await openChangeDialog(user, section);

    await user.type(within(dialog).getByLabelText("Monthly amount"), "90000");
    await user.type(
      within(dialog).getByLabelText("Effective from"),
      "2026-01-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Record change" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Please correct the highlighted fields.",
    );
    expect(
      within(dialog).getByLabelText("Effective from"),
    ).toHaveAccessibleDescription(
      /must be after the latest salary record's start date/,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows only a generic message for a server error, keeping the dialog and what was typed", async () => {
    const { section, user } = await renderPage({
      writes: {
        changeResponse: () =>
          HttpResponse.json(
            {
              error: {
                code: "internal_error",
                message: "PG::Error at salary_records.rb:42",
              },
            },
            { status: 500 },
          ),
      },
    });
    const { dialog } = await openChangeDialog(user, section);

    await user.type(within(dialog).getByLabelText("Monthly amount"), "90000");
    await user.type(
      within(dialog).getByLabelText("Effective from"),
      "2026-01-01",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Record change" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(dialog).not.toHaveTextContent(/PG::|salary_records\.rb/);
    expect(within(dialog).getByLabelText("Monthly amount")).toHaveValue(
      "90000",
    );
    expect(
      within(dialog).getByRole("button", { name: "Record change" }),
    ).toBeEnabled();
  });

  it("closes on Esc and on Cancel, returning focus to the button, and reopens empty", async () => {
    const { section, requests, user } = await renderPage();
    const first = await openChangeDialog(user, section);
    await user.type(within(first.dialog).getByLabelText("Monthly amount"), "1");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(first.opener).toHaveFocus());

    const second = await openChangeDialog(user, section);
    expect(within(second.dialog).getByLabelText("Monthly amount")).toHaveValue(
      "",
    );
    await user.click(
      within(second.dialog).getByRole("button", { name: "Cancel" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(second.opener).toHaveFocus());
    expect(requests).toEqual([]);
  });

  it("is available with no history yet, with no currency chosen and no date rule (U8)", async () => {
    const { section, user } = await renderPage({ records: [] });
    expect(
      within(section).getByText("No salary records yet."),
    ).toBeInTheDocument();

    const { dialog } = await openChangeDialog(user, section);

    await waitFor(() =>
      expect(within(dialog).getByLabelText("Currency")).toHaveDisplayValue(
        "Choose a currency",
      ),
    );
    expect(
      within(dialog).getByLabelText("Effective from"),
    ).toHaveAccessibleDescription(
      "The previous period ends the day before. History is kept.",
    );
  });
});

describe("Correct salary record", () => {
  async function openCorrection(
    user: ReturnType<typeof userEvent.setup>,
    section: HTMLElement,
    from = "2027-04-01",
  ) {
    await user.click(
      within(section).getByRole("button", {
        name: `Correct salary effective from ${from}`,
      }),
    );
    return screen.findByRole("dialog", { name: "Correct salary record" });
  }

  it("is offered only on records the API marks editable", async () => {
    const { section } = await renderPage();

    const buttons = within(section).getAllByRole("button", {
      name: /^Correct salary/,
    });
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Correct salary effective from 2027-04-01",
      "Correct salary effective from 2026-04-01",
    ]);
  });

  it("is pre-filled, shows the dates read-only, and saves only the changed amount", async () => {
    const { section, detail, history, requests, user } = await renderPage();
    const dialog = await openCorrection(user, section);
    const historyBefore = history.count;
    const detailBefore = detail.requestedIds.length;

    expect(dialog).toHaveTextContent(
      "To record a raise, use Record salary change.",
    );
    expect(dialog).toHaveTextContent(/Effective from\s*2027-04-01/);
    expect(dialog).toHaveTextContent(/Effective to\s*—/);
    expect(
      within(dialog).queryByLabelText(/Effective/),
    ).not.toBeInTheDocument();
    const amount = within(dialog).getByLabelText("Monthly amount");
    expect(amount).toHaveValue("92000.00");
    await waitFor(() =>
      expect(within(dialog).getByLabelText("Currency")).toHaveValue("INR"),
    );
    const save = within(dialog).getByRole("button", {
      name: "Save correction",
    });
    expect(save).toBeDisabled();

    await user.clear(amount);
    await user.type(amount, "93000.00");
    await user.click(save);

    expect(await within(section).findByRole("status")).toHaveTextContent(
      "Salary record corrected.",
    );
    expect(requests).toEqual([
      {
        method: "PATCH",
        path: "/api/v1/employees/101/salary_records/4",
        body: { salary_record: { amount: "93000.00" } },
      },
    ]);
    expect(history.count).toBeGreaterThan(historyBefore);
    expect(detail.requestedIds.length).toBeGreaterThan(detailBefore);
  });

  it("sends only the currency when only the currency changes", async () => {
    const { section, requests, user } = await renderPage();
    const dialog = await openCorrection(user, section, "2026-04-01");

    await user.selectOptions(
      await within(dialog).findByLabelText("Currency"),
      "JPY",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save correction" }),
    );

    await waitFor(() =>
      expect(requests.map((request) => request.body)).toEqual([
        { salary_record: { currency_code: "JPY" } },
      ]),
    );
    expect(requests[0]!.path).toBe("/api/v1/employees/101/salary_records/3");
  });

  it("requires an amount and shows the API's amount error on the field", async () => {
    const { section, requests, user } = await renderPage({
      writes: {
        correctResponse: () =>
          validationFailed({ amount: ["has too many decimal places for INR"] }),
      },
    });
    const dialog = await openCorrection(user, section);
    const amount = within(dialog).getByLabelText("Monthly amount");
    const save = within(dialog).getByRole("button", {
      name: "Save correction",
    });

    await user.clear(amount);
    await user.click(save);
    expect(amount).toHaveAccessibleDescription(/is required/);
    expect(requests).toEqual([]);

    await user.type(amount, "92000.005");
    await user.click(save);
    await waitFor(() =>
      expect(amount).toHaveAccessibleDescription(
        /has too many decimal places for INR/,
      ),
    );
  });

  it("explains when the record can no longer be corrected and refreshes the history", async () => {
    const { section, history, user } = await renderPage({
      writes: { correctResponse: salaryRecordNotEditable },
    });
    const dialog = await openCorrection(user, section, "2026-04-01");
    const before = history.count;

    await user.clear(within(dialog).getByLabelText("Monthly amount"));
    await user.type(
      within(dialog).getByLabelText("Monthly amount"),
      "86000.00",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Save correction" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This record can no longer be corrected because its period has ended.",
    );
    expect(
      within(dialog).getByRole("button", { name: "Save correction" }),
    ).toBeDisabled();
    await waitFor(() => expect(history.count).toBeGreaterThan(before));
  });

  it("lists API messages the dialog has no field for", async () => {
    const { section, user } = await renderPage({
      writes: {
        correctResponse: () =>
          validationFailed({ effective_to: ["cannot be changed"] }),
      },
    });
    const dialog = await openCorrection(user, section);

    await user.clear(within(dialog).getByLabelText("Monthly amount"));
    await user.type(within(dialog).getByLabelText("Monthly amount"), "1");
    await user.click(
      within(dialog).getByRole("button", { name: "Save correction" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "effective_to cannot be changed",
    );
  });
});
