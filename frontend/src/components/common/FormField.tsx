import { useId, type InputHTMLAttributes } from "react";
import Form from "react-bootstrap/Form";
import type { FormControlProps } from "react-bootstrap/FormControl";

type FormFieldProps = Omit<FormControlProps, "id" | "isInvalid" | "isValid"> &
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof FormControlProps | "id"> & {
    label: string;
    /** Validation message, e.g. from fieldErrors() for the API's 422 details. */
    error?: string;
    /** Help text shown under the field. */
    hint?: string;
    /** Classes for the wrapping group (spacing). */
    groupClassName?: string;
  };

/**
 * A labelled form control with accessible validation (S10). react-bootstrap's isInvalid only adds a CSS
 * class, so aria-invalid and aria-describedby are set here (lesson from F3.1).
 */
export default function FormField({
  label,
  error,
  hint,
  groupClassName,
  ...controlProps
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <Form.Group className={groupClassName} controlId={id}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        {...controlProps}
        isInvalid={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error && (
        <Form.Control.Feedback type="invalid" id={errorId}>
          {error}
        </Form.Control.Feedback>
      )}
      {hint && (
        <Form.Text id={hintId} className="text-body-secondary">
          {hint}
        </Form.Text>
      )}
    </Form.Group>
  );
}
