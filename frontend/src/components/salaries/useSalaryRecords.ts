import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { employeeKeys } from "@/components/employees/useEmployees";
import { isApiError } from "@/services/api";
import type {
  SalaryChangeInput,
  SalaryCorrectionInput,
} from "@/services/salary.types";
import { salaryService } from "@/services/salaryService";

// Salary history queries and writes (FRONTEND_PLAN.md U4).

export const salaryKeys = {
  history: (employeeId: number) =>
    ["employees", employeeId, "salary-records"] as const,
};

/** Analytics and report queries (F7) read salaries; invalidating these prefixes is harmless before then. */
const SALARY_DEPENDENT_KEYS = [["analytics"], ["reports"]] as const;

export function useSalaryRecords(employeeId: number) {
  return useQuery({
    queryKey: salaryKeys.history(employeeId),
    queryFn: () => salaryService.list(employeeId),
  });
}

/**
 * After a write: refresh the history and the employee detail (its current salary may change), then mark
 * analytics and reports stale. The employee list shows no salary, so it is not touched.
 */
function useRefreshAfterSalaryWrite(employeeId: number) {
  const queryClient = useQueryClient();
  return async () => {
    for (const queryKey of SALARY_DEPENDENT_KEYS)
      void queryClient.invalidateQueries({ queryKey });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: salaryKeys.history(employeeId),
      }),
      queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(employeeId),
      }),
    ]);
  };
}

export function useSalaryChange(employeeId: number) {
  const refresh = useRefreshAfterSalaryWrite(employeeId);
  return useMutation({
    mutationFn: (input: SalaryChangeInput) =>
      salaryService.change(employeeId, input),
    onSuccess: refresh,
  });
}

export function useSalaryCorrection(employeeId: number) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterSalaryWrite(employeeId);
  return useMutation({
    mutationFn: ({
      recordId,
      changes,
    }: {
      recordId: number;
      changes: SalaryCorrectionInput;
    }) => salaryService.correct(employeeId, recordId, changes),
    onSuccess: refresh,
    onError: (error) => {
      // The record's period ended since the history was loaded (U6): show the up-to-date statuses.
      if (isApiError(error) && error.code === "salary_record_not_editable")
        void queryClient.invalidateQueries({
          queryKey: salaryKeys.history(employeeId),
        });
    },
  });
}
