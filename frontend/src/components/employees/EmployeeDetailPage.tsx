import { Fragment, type ReactNode } from "react";
import Alert from "react-bootstrap/Alert";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { Link, useLocation, useParams } from "react-router";
import EmploymentStatusBadge from "@/components/common/EmploymentStatusBadge";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import MoneyAmount from "@/components/common/MoneyAmount";
import {
  employeeListReturnPath,
  parseEmployeeId,
  useEmployee,
} from "@/components/employees/useEmployees";
import SalaryHistory from "@/components/salaries/SalaryHistory";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isApiError } from "@/services/api";
import type { EmployeeDetail } from "@/services/employee.types";

// Employee detail (FRONTEND_PLAN.md T5, T6; API §6.2). Salary history and salary actions: SalaryHistory (F6).

function noticeFrom(state: unknown): string | null {
  return typeof state === "object" &&
    state !== null &&
    "notice" in state &&
    typeof state.notice === "string"
    ? state.notice
    : null;
}

function Profile({ employee }: { employee: EmployeeDetail }) {
  const rows: [string, ReactNode][] = [
    ["Employee number", employee.employee_number],
    ["Email", employee.email ?? "—"],
    ["Country", employee.country.name],
    ["Department", employee.department.name],
    [
      "Status",
      <EmploymentStatusBadge
        key="status"
        status={employee.employment_status}
      />,
    ],
    ["Hired on", employee.hired_on ?? "—"],
  ];
  return (
    <Card as="section" aria-labelledby="profile-heading" className="h-100">
      <Card.Body>
        <h2 id="profile-heading" className="h5">
          Profile
        </h2>
        <dl className="row mb-0">
          {rows.map(([term, value]) => (
            <Fragment key={term}>
              <dt className="col-sm-5 fw-normal text-body-secondary">{term}</dt>
              <dd className="col-sm-7">{value}</dd>
            </Fragment>
          ))}
        </dl>
      </Card.Body>
    </Card>
  );
}

function CurrentSalary({ employee }: { employee: EmployeeDetail }) {
  const salary = employee.current_salary;
  return (
    <Card as="section" aria-labelledby="salary-heading" className="h-100">
      <Card.Body>
        <h2 id="salary-heading" className="h5">
          Current salary
        </h2>
        {salary ? (
          <>
            <p className="fs-4 mb-1">
              <MoneyAmount
                amount={salary.amount}
                currencyCode={salary.currency_code}
                monthly
              />
            </p>
            <p className="text-body-secondary mb-0">
              Effective from {salary.effective_from}
            </p>
          </>
        ) : (
          <p className="mb-0">No salary in effect today.</p>
        )}
      </Card.Body>
    </Card>
  );
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const location = useLocation();
  const id = parseEmployeeId(params.id);
  const employee = useEmployee(id);
  const backTo = employeeListReturnPath(location.state);
  const notice = noticeFrom(location.state);

  const name = employee.data
    ? `${employee.data.last_name}, ${employee.data.first_name}`
    : null;
  useDocumentTitle(name ?? "Employee");

  const backLink = (
    <Link to={backTo} className="d-inline-block mb-3">
      ← Back to employees
    </Link>
  );

  const notFound =
    id === null ||
    (isApiError(employee.error) && employee.error.status === 404);
  if (notFound) {
    return (
      <>
        {backLink}
        <h1 className="h3">Employee not found</h1>
        <p>This employee does not exist.</p>
      </>
    );
  }
  if (employee.isPending) return <LoadingState label="Loading employee…" />;
  if (employee.isError) {
    return (
      <>
        {backLink}
        <ErrorAlert
          error={employee.error}
          onRetry={() => void employee.refetch()}
        />
      </>
    );
  }

  const data = employee.data;
  return (
    <>
      {backLink}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">
          {name}{" "}
          <span className="text-body-secondary fs-5">
            ({data.employee_number})
          </span>
        </h1>
        <Link
          to={`/employees/${data.id}/edit`}
          state={{ from: backTo }}
          className="btn btn-outline-primary"
        >
          Edit
        </Link>
      </div>
      {notice && (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      )}
      <Row className="g-3">
        <Col lg={7}>
          <Profile employee={data} />
        </Col>
        <Col lg={5}>
          <CurrentSalary employee={data} />
        </Col>
      </Row>
      <SalaryHistory employeeId={data.id} />
    </>
  );
}
