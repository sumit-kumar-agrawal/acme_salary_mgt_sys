import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { QueryParams } from "@/services/api";
import { reportService } from "@/services/reportService";

// Salary report query (FRONTEND_PLAN.md V6). The key starts with "reports", so a salary change or
// correction marks it stale (U4). The previous page stays on screen while the next one loads.

export const reportKeys = {
  salaries: (query: QueryParams) => ["reports", "salaries", query] as const,
};

export function useSalaryReport(query: QueryParams) {
  return useQuery({
    queryKey: reportKeys.salaries(query),
    queryFn: () => reportService.list(query),
    placeholderData: keepPreviousData,
  });
}
