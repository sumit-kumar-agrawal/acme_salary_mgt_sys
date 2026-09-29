import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import EmployeeForm from "@/components/employees/EmployeeForm";
import {
  changedFields,
  valuesFromEmployee,
} from "@/components/employees/employeeFormValues";
import {
  employeeKeys,
  employeeListReturnPath,
  parseEmployeeId,
  useEmployee,
} from "@/components/employees/useEmployees";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isApiError } from "@/services/api";
import { employeeService } from "@/services/employeeService";
import { invalidateAnalyticsAndReports } from "@/services/queryClient";

// Edit an employee, sending only the changed fields (FRONTEND_PLAN.md T7, T9, T10). Salary never changes here.
export default function EmployeeEditPage() {
  useDocumentTitle("Edit employee");
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const id = parseEmployeeId(params.id);
  const employee = useEmployee(id);
  const listPath = employeeListReturnPath(location.state);
  const detailPath = `/employees/${id}`;

  const update = useMutation({
    mutationFn: (changes: Parameters<typeof employeeService.update>[1]) =>
      employeeService.update(id as number, changes),
    onSuccess: async (saved) => {
      queryClient.setQueryData(employeeKeys.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      // Country, department, and status changes move the employee in analytics and reports (F9.1 R1).
      invalidateAnalyticsAndReports(queryClient);
      void navigate(detailPath, {
        state: { notice: "Changes saved.", from: listPath },
      });
    },
  });

  if (
    id === null ||
    (isApiError(employee.error) && employee.error.status === 404)
  ) {
    return (
      <>
        <Link to={listPath} className="d-inline-block mb-3">
          ← Back to employees
        </Link>
        <h1 className="h3">Employee not found</h1>
        <p>This employee does not exist.</p>
      </>
    );
  }
  if (employee.isPending) return <LoadingState label="Loading employee…" />;
  if (employee.isError)
    return (
      <ErrorAlert
        error={employee.error}
        onRetry={() => void employee.refetch()}
      />
    );

  const initialValues = valuesFromEmployee(employee.data);
  const backToDetail = () =>
    void navigate(detailPath, { state: { from: listPath } });

  return (
    <>
      <Link
        to={detailPath}
        state={{ from: listPath }}
        className="d-inline-block mb-3"
      >
        ← Back to employee
      </Link>
      <h1 className="h3 mb-3">
        Edit {employee.data.last_name}, {employee.data.first_name}
      </h1>
      <EmployeeForm
        mode="edit"
        initialValues={initialValues}
        submitLabel="Save changes"
        submitting={update.isPending}
        error={update.error}
        isDirty={(values) =>
          Object.keys(changedFields(initialValues, values)).length > 0
        }
        onSubmit={(values) =>
          update.mutate(changedFields(initialValues, values))
        }
        onCancel={backToDetail}
      />
    </>
  );
}
