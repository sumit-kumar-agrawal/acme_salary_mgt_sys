import { useState, type FormEvent } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import FormField from "@/components/common/FormField";
import {
  CountrySelect,
  CurrencySelect,
  DepartmentSelect,
  EmploymentStatusSelect,
} from "@/components/common/ReferenceSelects";
import {
  requiredFieldErrors,
  type EmployeeFieldErrors,
  type EmployeeFieldName,
  type EmployeeFormValues,
} from "@/components/employees/employeeFormValues";
import { fieldErrors, isApiError, userMessage } from "@/services/api";
import type { EmploymentStatus } from "@/services/reference.types";

// Shared create/edit form (FRONTEND_PLAN.md T7, T8). Required fields are checked here; everything else
// (formats, uniqueness, money scale per currency, hire date vs salary) comes back as the API's 422 details.

/** API field names this form shows under its own fields (the salary ones only while a salary is added). */
const FORM_FIELDS = [
  "employee_number",
  "first_name",
  "last_name",
  "email",
  "hired_on",
  "country_id",
  "department_id",
  "employment_status",
] as const;
const SALARY_FIELDS = [
  "initial_salary.amount",
  "initial_salary.currency_code",
  "initial_salary.effective_from",
] as const;

interface EmployeeFormProps {
  mode: "create" | "edit";
  initialValues: EmployeeFormValues;
  submitLabel: string;
  submitting: boolean;
  /** The last save error (422 details are shown on the fields). */
  error: unknown;
  /** Edit: whether anything changed (Save is disabled otherwise, T9). */
  isDirty?: (values: EmployeeFormValues) => boolean;
  onSubmit: (values: EmployeeFormValues) => void;
  onCancel: () => void;
}

export default function EmployeeForm({
  mode,
  initialValues,
  submitLabel,
  submitting,
  error,
  isDirty,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState(initialValues);
  const [requiredErrors, setRequiredErrors] = useState<EmployeeFieldErrors>({});

  const apiErrors = fieldErrors(error) as EmployeeFieldErrors;
  const errorFor = (field: EmployeeFieldName) =>
    requiredErrors[field] ?? apiErrors[field];
  // 422 messages for fields this form does not show are listed in the alert, so none is lost (F9.1 R3).
  const shownFields: readonly string[] = [
    ...FORM_FIELDS,
    ...(mode === "create" && values.addSalary ? SALARY_FIELDS : []),
  ];
  const unshownApiErrors = Object.entries(apiErrors).filter(
    ([field]) => !shownFields.includes(field),
  );
  const hasApiFieldErrors = Object.keys(apiErrors).length > 0;

  function set<K extends keyof EmployeeFormValues>(
    key: K,
    value: EmployeeFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleSalary(on: boolean) {
    setValues((current) => ({
      ...current,
      addSalary: on,
      // The first salary usually starts on the hire date (T8).
      effective_from:
        on && !current.effective_from
          ? current.hired_on
          : current.effective_from,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = requiredFieldErrors(values, mode);
    setRequiredErrors(errors);
    if (Object.keys(errors).length === 0) onSubmit(values);
  }

  const canSave = !submitting && (isDirty ? isDirty(values) : true);

  return (
    <Form noValidate onSubmit={handleSubmit}>
      {error !== null && error !== undefined && (
        <Alert variant="danger" role="alert">
          {!hasApiFieldErrors
            ? userMessage(error)
            : unshownApiErrors.length === 0
              ? "Please correct the highlighted fields."
              : unshownApiErrors
                  .map(([field, message]) => `${field} ${message}`)
                  .join(". ")}
          {isApiError(error) &&
            error.code === "invalid_csrf_token" &&
            " Reload the page and try again."}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={4}>
          <FormField
            label="Employee number"
            value={values.employee_number}
            onChange={(event) => set("employee_number", event.target.value)}
            maxLength={20}
            autoComplete="off"
            hint="Letters, digits, and '-'"
            error={errorFor("employee_number")}
            required
          />
        </Col>
        <Col md={4}>
          <FormField
            label="First name"
            value={values.first_name}
            onChange={(event) => set("first_name", event.target.value)}
            maxLength={100}
            autoComplete="off"
            error={errorFor("first_name")}
            required
          />
        </Col>
        <Col md={4}>
          <FormField
            label="Last name"
            value={values.last_name}
            onChange={(event) => set("last_name", event.target.value)}
            maxLength={100}
            autoComplete="off"
            error={errorFor("last_name")}
            required
          />
        </Col>
        <Col md={6}>
          <FormField
            label="Email (optional)"
            type="email"
            value={values.email}
            onChange={(event) => set("email", event.target.value)}
            maxLength={255}
            autoComplete="off"
            error={errorFor("email")}
          />
        </Col>
        <Col md={6}>
          <FormField
            label="Hired on (optional)"
            type="date"
            value={values.hired_on}
            onChange={(event) => set("hired_on", event.target.value)}
            error={errorFor("hired_on")}
          />
        </Col>
        <Col md={4}>
          <CountrySelect
            mode="form"
            value={values.country_id}
            onChange={(value) => set("country_id", value)}
            error={errorFor("country_id")}
          />
        </Col>
        <Col md={4}>
          <DepartmentSelect
            mode="form"
            value={values.department_id}
            onChange={(value) => set("department_id", value)}
            error={errorFor("department_id")}
          />
        </Col>
        <Col md={4}>
          <EmploymentStatusSelect
            mode="form"
            label="Status"
            value={values.employment_status}
            onChange={(value) =>
              set("employment_status", value as EmploymentStatus | "")
            }
            error={errorFor("employment_status")}
          />
        </Col>
      </Row>

      {mode === "create" && (
        <Card as="fieldset" className="mt-4">
          <Card.Body>
            <legend className="h6">Initial salary</legend>
            <Form.Check
              type="switch"
              id="add-initial-salary"
              label="Add an initial salary (monthly gross base pay)"
              checked={values.addSalary}
              onChange={(event) => toggleSalary(event.target.checked)}
            />
            {values.addSalary && (
              <Row className="g-3 mt-1">
                <Col md={4}>
                  <FormField
                    label="Monthly amount"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={values.amount}
                    onChange={(event) => set("amount", event.target.value)}
                    hint="Up to the currency's decimal places, e.g. 85000.00"
                    error={errorFor("initial_salary.amount")}
                    required
                  />
                </Col>
                <Col md={4}>
                  <CurrencySelect
                    mode="form"
                    value={values.currency_code}
                    onChange={(value) => set("currency_code", value)}
                    error={errorFor("initial_salary.currency_code")}
                  />
                </Col>
                <Col md={4}>
                  <FormField
                    label="Effective from"
                    type="date"
                    value={values.effective_from}
                    onChange={(event) =>
                      set("effective_from", event.target.value)
                    }
                    error={errorFor("initial_salary.effective_from")}
                    required
                  />
                </Col>
              </Row>
            )}
          </Card.Body>
        </Card>
      )}

      <div className="d-flex gap-2 mt-4">
        <Button type="submit" disabled={!canSave}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        <Button
          variant="outline-secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </Form>
  );
}
