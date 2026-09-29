import { describe, expect, it } from "vitest";
import { reportService } from "@/services/reportService";
import {
  REPORT_ROWS,
  mockCsvExport,
  mockSalaryReport,
} from "@/test/fixtures/salaryReport";

describe("reportService", () => {
  it("lists a report page with the given query", async () => {
    const api = mockSalaryReport({ total: 60 });

    const result = await reportService.list({
      page: 2,
      per_page: 25,
      sort: "-amount",
      country_id: "5",
      q: "Rao",
    });

    expect(result.data).toEqual(REPORT_ROWS);
    expect(result.meta).toMatchObject({ total_count: 60, as_of: "2026-09-28" });
    expect(api.lastQuery()).toEqual({
      page: "2",
      per_page: "25",
      sort: "-amount",
      country_id: "5",
      q: "Rao",
    });
  });

  it("exports the same filters, search, and sort as CSV, never page or per_page", async () => {
    const api = mockCsvExport();

    const file = await reportService.downloadCsv({
      page: 3,
      per_page: 50,
      sort: "-amount",
      as_of: "2026-01-31",
      employment_status: "terminated",
      q: "Rao",
    });

    expect(file.filename).toBe("salary-report-2026-09-28.csv");
    expect(api.lastQuery()).toEqual({
      sort: "-amount",
      as_of: "2026-01-31",
      employment_status: "terminated",
      q: "Rao",
    });
  });
});
