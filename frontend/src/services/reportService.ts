import {
  apiDownload,
  apiRequest,
  type ApiDownload,
  type Paginated,
  type QueryParams,
} from "@/services/api";
import type {
  SalaryReportMeta,
  SalaryReportRow,
} from "@/services/report.types";

// Salary report endpoints (API spec §9). The JSON report and the CSV take the same filters, so the rows
// shown and the rows exported are the same set (D19).

export const reportService = {
  /** One page of the report: the analytics filters plus q, sort, page, and per_page. */
  list(
    query: QueryParams,
  ): Promise<Paginated<SalaryReportRow, SalaryReportMeta>> {
    return apiRequest<Paginated<SalaryReportRow, SalaryReportMeta>>(
      "/reports/salaries",
      { query },
    );
  },

  /**
   * The whole filtered report as CSV (§9.2). page and per_page are never sent: the file holds every row.
   * Above 10,000 rows the API answers 422 export_too_large instead of a file (G6).
   */
  downloadCsv(query: QueryParams): Promise<ApiDownload> {
    return apiDownload("/reports/salaries.csv", {
      query: { ...query, page: undefined, per_page: undefined },
    });
  },
};
