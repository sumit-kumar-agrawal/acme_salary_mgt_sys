import { useId, useState, type FormEvent } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import FormField from "@/components/common/FormField";
import { CurrencySelect } from "@/components/common/ReferenceSelects";
import SalarySaveError from "@/components/salaries/SalarySaveError";
import { useSalaryCorrection } from "@/components/salaries/useSalaryRecords";
import { fieldErrors, isApiError } from "@/services/api";
import type {
  SalaryCorrectionInput,
  SalaryRecord,
} from "@/services/salary.types";

// Correct a data-entry mistake in a current or scheduled record (FRONTEND_PLAN.md U6, U7; API §7.5, D4 + O1).
// Only the changed amount and/or currency are sent; the dates are shown read-only and never sent.

const FIELDS = ["amount", "currency_code"] as const;

interface SalaryCorrectionDialogProps {
  employeeId: number;
  /** The record being corrected; kept while the dialog closes so its content does not vanish mid-fade. */
  record: SalaryRecord | null;
  show: boolean;
  onHide: () => void;
  onSaved: () => void;
}

export default function SalaryCorrectionDialog({
  employeeId,
  record,
  show,
  onHide,
  onSaved,
}: SalaryCorrectionDialogProps) {
  const titleId = useId();
  const correction = useSalaryCorrection(employeeId);
  const close = () => {
    if (!correction.isPending) onHide();
  };

  return (
    <Modal
      show={show && record !== null}
      onHide={close}
      onExited={() => correction.reset()}
      aria-labelledby={titleId}
    >
      {record && (
        <CorrectionForm
          titleId={titleId}
          record={record}
          saving={correction.isPending}
          error={correction.error}
          onCancel={close}
          onSubmit={(changes) =>
            correction.mutate(
              { recordId: record.id, changes },
              { onSuccess: onSaved },
            )
          }
        />
      )}
    </Modal>
  );
}

function CorrectionForm({
  titleId,
  record,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  titleId: string;
  record: SalaryRecord;
  saving: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (changes: SalaryCorrectionInput) => void;
}) {
  const [amount, setAmount] = useState(record.amount);
  const [currencyCode, setCurrencyCode] = useState(record.currency_code);
  const [amountRequired, setAmountRequired] = useState(false);

  const changes: SalaryCorrectionInput = {};
  if (amount.trim() !== record.amount) changes.amount = amount.trim();
  if (currencyCode !== record.currency_code)
    changes.currency_code = currencyCode;
  const notEditable =
    isApiError(error) && error.code === "salary_record_not_editable";
  const canSave = !saving && !notEditable && Object.keys(changes).length > 0;

  const apiErrors = fieldErrors(error);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = !amount.trim();
    setAmountRequired(missing);
    if (!missing && canSave) onSubmit(changes);
  }

  return (
    <Form noValidate onSubmit={handleSubmit}>
      <Modal.Header closeButton={!saving}>
        <Modal.Title id={titleId} as="h2" className="h5">
          Correct salary record
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-body-secondary">
          Corrections fix a data-entry mistake in the current or a scheduled
          record. To record a raise, use Record salary change.
        </p>
        <SalarySaveError error={error} fields={FIELDS} />
        <dl className="row mb-2">
          <dt className="col-5 fw-normal text-body-secondary">
            Effective from
          </dt>
          <dd className="col-7">{record.effective_from}</dd>
          <dt className="col-5 fw-normal text-body-secondary">Effective to</dt>
          <dd className="col-7">{record.effective_to ?? "—"}</dd>
        </dl>
        <FormField
          groupClassName="mb-3"
          label="Monthly amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint="Up to the currency's decimal places"
          error={amountRequired ? "is required" : apiErrors.amount}
          required
        />
        <CurrencySelect
          mode="form"
          value={currencyCode}
          onChange={setCurrencyCode}
          error={apiErrors.currency_code}
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
        <Button type="submit" disabled={!canSave}>
          {saving ? "Saving…" : "Save correction"}
        </Button>
      </Modal.Footer>
    </Form>
  );
}
