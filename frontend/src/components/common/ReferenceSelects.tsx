import { useId } from "react";
import Form from "react-bootstrap/Form";
import {
  useCountries,
  useCurrencies,
  useDepartments,
} from "@/hooks/useReferenceData";
import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_LABELS,
} from "@/services/reference.types";

// Selects for reference data (FRONTEND_PLAN.md S7). Values are strings (ids or codes), as used in URLs and
// request bodies. "filter" mode adds an "All …" option; "form" mode is required with a "Choose …" placeholder.

interface Option {
  value: string;
  label: string;
}

export interface ReferenceSelectProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "filter" | "form";
  label?: string;
  /** Validation message in form mode (e.g. from the API's 422 details). */
  error?: string;
  disabled?: boolean;
}

interface SelectFieldProps extends ReferenceSelectProps {
  label: string;
  allLabel: string;
  placeholder: string;
  options: Option[];
  loading?: boolean;
  loadError?: string;
}

function SelectField({
  value,
  onChange,
  mode = "filter",
  label,
  error,
  disabled,
  allLabel,
  placeholder,
  options,
  loading = false,
  loadError,
}: SelectFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? loadError;

  return (
    <Form.Group controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || loading || Boolean(loadError)}
        required={mode === "form"}
        isInvalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
      >
        {loading ? (
          <option value={value}>Loading…</option>
        ) : (
          <>
            <option value="">
              {mode === "filter" ? allLabel : placeholder}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </>
        )}
      </Form.Select>
      {message && (
        <Form.Text
          id={messageId}
          className={error ? "text-danger" : "text-body-secondary"}
        >
          {message}
        </Form.Text>
      )}
    </Form.Group>
  );
}

export function CountrySelect({
  label = "Country",
  ...props
}: ReferenceSelectProps) {
  const countries = useCountries();
  return (
    <SelectField
      {...props}
      label={label}
      allLabel="All countries"
      placeholder="Choose a country"
      loading={countries.isPending}
      loadError={
        countries.isError ? "Countries could not be loaded." : undefined
      }
      options={(countries.data ?? []).map((country) => ({
        value: String(country.id),
        label: country.name,
      }))}
    />
  );
}

export function DepartmentSelect({
  label = "Department",
  ...props
}: ReferenceSelectProps) {
  const departments = useDepartments();
  return (
    <SelectField
      {...props}
      label={label}
      allLabel="All departments"
      placeholder="Choose a department"
      loading={departments.isPending}
      loadError={
        departments.isError ? "Departments could not be loaded." : undefined
      }
      options={(departments.data ?? []).map((department) => ({
        value: String(department.id),
        label: department.name,
      }))}
    />
  );
}

export function EmploymentStatusSelect({
  label = "Employment status",
  allLabel = "All statuses",
  ...props
}: ReferenceSelectProps & { allLabel?: string }) {
  return (
    <SelectField
      {...props}
      label={label}
      allLabel={allLabel}
      placeholder="Choose a status"
      options={EMPLOYMENT_STATUSES.map((status) => ({
        value: status,
        label: EMPLOYMENT_STATUS_LABELS[status],
      }))}
    />
  );
}

export function CurrencySelect({
  label = "Currency",
  ...props
}: ReferenceSelectProps) {
  const currencies = useCurrencies();
  return (
    <SelectField
      {...props}
      label={label}
      allLabel="All currencies"
      placeholder="Choose a currency"
      loading={currencies.isPending}
      loadError={
        currencies.isError ? "Currencies could not be loaded." : undefined
      }
      options={(currencies.data ?? []).map((currency) => ({
        value: currency.code,
        label: `${currency.code} — ${currency.name}`,
      }))}
    />
  );
}
