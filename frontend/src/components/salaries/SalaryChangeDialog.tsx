import { useId, useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import FormField from "@/components/common/FormField";
import { CurrencySelect } from "@/components/common/ReferenceSelects";
import SalarySaveError from "@/components/salaries/SalarySaveError";
import { useSalaryChange } from "@/components/salaries/useSalaryRecords";
import { fieldErrors } from "@/services/api";
import type { SalaryChangeInput } from "@/services/salary.types";

// Record a salary change (FRONTEND_PLAN.md U5, U7; API §7.3). The API closes the previous period and
// validates the amount's decimal places and the start date; only required fields are checked here.

type ChangeField = keyof SalaryChangeInput;
const FIELDS: readonly ChangeField[] = [
  "amount",
  "currency_code",
  "effective_from",
];

interface SalaryChangeDialogProps {
  employeeId: number;
  show: boolean;
  /** Pre-selected currency: the current salary's (or the latest record's). */
  defaultCurrency: string;
  /** The latest record's start date, shown as a hint; the API decides. */
  latestStart: string | null;
  onHide: () => void;
  onSaved: () => void;
}

export default function SalaryChangeDialog({
  employeeId,
  show,
  defaultCurrency,
  latestStart,
  onHide,
  onSaved,
}: SalaryChangeDialogProps) {
  const titleId = useId();
  const change = useSalaryChange(employeeId);
  const close = () => {
    if (!change.isPending) onHide();
  };

  return (
    <Modal
      show={show}
      onHide={close}
      onExited={() => change.reset()}
      aria-labelledby={titleId}
    >
      {/* Rendered only while open, so every opening starts with a fresh form. */}
      <ChangeForm
        titleId={titleId}
        defaultCurrency={defaultCurrency}
        latestStart={latestStart}
        saving={change.isPending}
        error={change.error}
        onCancel={close}
        onSubmit={(input) => change.mutate(input, { onSuccess: onSaved })}
      />
    </Modal>
  );
}

function ChangeForm({
  titleId,
  defaultCurrency,
  latestStart,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  titleId: string;
  defaultCurrency: string;
  latestStart: string | null;
  saving: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (input: SalaryChangeInput) => void;
}) {
  const [values, setValues] = useState<SalaryChangeInput>({
    amount: "",
    currency_code: defaultCurrency,
    effective_from: "",
  });
  const [required, setRequired] = useState<
    Partial<Record<ChangeField, string>>
  >({});
  const apiErrors = fieldErrors(error);
  const errorFor = (field: ChangeField) => required[field] ?? apiErrors[field];
  const set = (field: ChangeField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { ...values, amount: values.amount.trim() };
    const missing = Object.fromEntries(
      FIELDS.filter((field) => !input[field]).map((field) => [
        field,
        "is required",
      ]),
    );
    setRequired(missing);
    if (Object.keys(missing).length === 0) onSubmit(input);
  }

  const dateHint = [
    "The previous period ends the day before. History is kept.",
    latestStart && `Must be after ${latestStart}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Form noValidate onSubmit={handleSubmit}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title id={titleId} as="h2" className="h5">
          Record salary change
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <SalarySaveError error={error} fields={FIELDS} />
        <FormField
          groupClassName="mb-3"
          label="Monthly amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={values.amount}
          onChange={(event) => set("amount", event.target.value)}
          hint="Up to the currency's decimal places, e.g. 92000.00"
          error={errorFor("amount")}
          required
        />
        <div className="mb-3">
          <CurrencySelect
            mode="form"
            value={values.currency_code}
            onChange={(value) => set("currency_code", value)}
            error={errorFor("currency_code")}
          />
        </div>
        <FormField
          label="Effective from"
          type="date"
          value={values.effective_from}
          onChange={(event) => set("effective_from", event.target.value)}
          hint={dateHint}
          error={errorFor("effective_from")}
          required
        />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="outline-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Record change"}
        </Button>
      </Modal.Footer>
    </Form>
  );
}
