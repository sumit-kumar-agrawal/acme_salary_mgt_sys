import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router";
import EmployeeForm from "@/components/employees/EmployeeForm";
import {
  EMPTY_EMPLOYEE,
  toCreateInput,
} from "@/components/employees/employeeFormValues";
import {
  employeeKeys,
  employeeListReturnPath,
} from "@/components/employees/useEmployees";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { EmployeeInput } from "@/services/employee.types";
import { employeeService } from "@/services/employeeService";
import { invalidateAnalyticsAndReports } from "@/services/queryClient";

// New employee, with an optional initial salary in the same request (FRONTEND_PLAN.md T7, T8, T10; D14).
export default function EmployeeCreatePage() {
  useDocumentTitle("New employee");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const backTo = employeeListReturnPath(location.state);

  const create = useMutation({
    mutationFn: (input: EmployeeInput) => employeeService.create(input),
    onSuccess: async (employee) => {
      queryClient.setQueryData(employeeKeys.detail(employee.id), employee);
      await queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      // A new employee may bring an initial salary (F9.1 R1).
      invalidateAnalyticsAndReports(queryClient);
      void navigate(`/employees/${employee.id}`, {
        state: { notice: "Employee created.", from: backTo },
      });
    },
  });

  return (
    <>
      <Link to={backTo} className="d-inline-block mb-3">
        ← Back to employees
      </Link>
      <h1 className="h3 mb-3">New employee</h1>
      <EmployeeForm
        mode="create"
        initialValues={EMPTY_EMPLOYEE}
        submitLabel="Create employee"
        submitting={create.isPending}
        error={create.error}
        onSubmit={(values) => create.mutate(toCreateInput(values))}
        onCancel={() => void navigate(backTo)}
      />
    </>
  );
}
