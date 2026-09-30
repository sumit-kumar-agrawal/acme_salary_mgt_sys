import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import type { BulkUpload } from "@/services/bulkUpload.types";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/server";

const record: BulkUpload = {
  id: 42,
  status: "completed_with_errors",
  file_format: "csv",
  original_filename: "fix.csv",
  original_file_path: "/api/v1/bulk_salary_corrections/42/original_file",
  response_file_path: "/api/v1/bulk_salary_corrections/42/response_file",
  started_at: "2026-09-30T10:00:00Z",
  finished_at: "2026-09-30T10:00:01Z",
  created_at: "2026-09-30T10:00:00Z",
};
let rows: BulkUpload[];
const saved = vi.fn();

beforeEach(() => {
  rows = [];
  mockSessionBackend({ signedIn: true });
  server.use(
    http.get("*/api/v1/bulk_salary_corrections", () =>
      HttpResponse.json({
        data: rows,
        meta: {
          page: 1,
          per_page: 25,
          total_count: rows.length,
          total_pages: rows.length ? 1 : 0,
        },
      }),
    ),
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:response"),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved(this.download);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  saved.mockClear();
});

it("uploads multipart with CSRF and shows status and a working response download", async () => {
  let headers: Headers | undefined;
  server.use(
    http.get(
      "*/api/v1/bulk_salary_corrections/42/response_file",
      () =>
        new HttpResponse("row_number,errors\n2,invalid\n", {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": 'attachment; filename="fix-response.csv"',
          },
        }),
    ),
  );
  // Vitest's jsdom multipart adapter cannot read jsdom 30 Files. Check the browser
  // request boundary here; the real multipart round trip is covered by Playwright.
  const fetchOriginal = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "POST") {
      headers = new Headers(init.headers);
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("file")).toBeInstanceOf(File);
      rows = [record];
      return Response.json({ data: record }, { status: 201 });
    }
    return fetchOriginal(input, init);
  });
  renderWithProviders(<App />, { route: "/bulk-salary-corrections" });
  const user = userEvent.setup();
  await screen.findByText("No bulk uploads yet.");
  await user.upload(
    screen.getByLabelText("Salary corrections file"),
    new File(["employee_number,amount\nBULK-1,1\n"], "fix.csv", {
      type: "text/csv",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Upload file" }));
  const link = await screen.findByRole("link", {
    name: "Download response CSV",
  });
  expect(headers?.get("content-type")).toBeNull();
  expect(headers?.get("x-csrf-token")).toBeTruthy();
  expect(link).toHaveAttribute("href", record.response_file_path);
  expect(screen.getByRole("status")).toHaveTextContent("Completed with errors");
  await user.click(link);
  await waitFor(() => expect(saved).toHaveBeenCalledWith("fix-response.csv"));
  expect(
    screen.queryByText(/success count|failed count|updated rows/i),
  ).not.toBeInTheDocument();
});

it("shows header errors without creating a history row", async () => {
  const fetchOriginal = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (init?.method === "POST") {
      return Response.json(
        {
          error: {
            code: "invalid_file_header",
            message: "The file header does not match the template.",
            details: { missing_columns: ["currency_code"] },
          },
        },
        { status: 422 },
      );
    }
    return fetchOriginal(input, init);
  });
  renderWithProviders(<App />, { route: "/bulk-salary-corrections" });
  const user = userEvent.setup();
  await screen.findByText("No bulk uploads yet.");
  await user.upload(
    screen.getByLabelText("Salary corrections file"),
    new File(["bad"], "bad.csv", { type: "text/csv" }),
  );
  await user.click(screen.getByRole("button", { name: "Upload file" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The file header does not match the template.",
  );
  expect(screen.getByRole("list", { name: "Header errors" })).toHaveTextContent(
    "missing columns: currency_code",
  );
  expect(
    screen.queryByRole("link", { name: "Download response CSV" }),
  ).not.toBeInTheDocument();
});

it("shows completed and processing statuses without download links when no response exists", async () => {
  rows = [
    { ...record, status: "completed", response_file_path: null },
    { ...record, id: 43, status: "process", response_file_path: null },
  ];
  renderWithProviders(<App />, { route: "/bulk-salary-corrections" });
  expect(await screen.findByText("Processing")).toBeVisible();
  expect(screen.getByText("Completed", { exact: true })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Download response CSV" }),
  ).not.toBeInTheDocument();
});
